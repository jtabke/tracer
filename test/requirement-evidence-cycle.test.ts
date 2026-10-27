import test from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, writeFileSync } from "node:fs";
import { createClient } from "../src/client.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { evidenceCycleFixture, cycleActor } from "./evidence-cycle-fixture.ts";

const impactQuery = (f: Awaited<ReturnType<typeof evidenceCycleFixture>>) => ({
  baselineId: f.baseline.id,
  rootId: f.requirement.id,
  direction: "outgoing" as const,
  relationshipTypes: ["allocated_to", "verified_by", "evaluates", "cites"],
  depth: 2,
});

test("REQ-013/014/015: explicit criteria/article/procedure/material stay distinct through changed, unknown and accepted review states", async () => {
  const f = await evidenceCycleFixture();
  try {
    const t = f.tracer,
      original = structuredClone(f.receipt),
      initial = await t.evidence.compareReceipt(original.id);
    assert.equal(initial.state, "current");
    assert.equal(original.output.id, f.conclusion.id);
    assert.deepEqual(
      original.inputs.map((i) => [i.role, i.entityId]),
      [
        ["acceptance criterion", f.requirement.id],
        ["article under test", f.article.id],
        ["executed procedure", f.plan.id],
        ["activity conditions", f.run.id],
        ["definition source", f.definition.id],
        ["supporting material", f.report.id],
      ],
    );
    assert.equal(original.inputs[1].entity.fields.revision, "A");
    const accepted = await t.evidence.review(
      {
        receiptId: original.id,
        decision: "accepted",
        rationale: "SIMULATED review of the recorded A/P1 inputs",
        expectedComparison: initial.token,
      },
      cycleActor,
    );
    const edited = await t.updateEntity(
      f.requirement.id,
      1,
      { fields: { ...f.requirement.fields, rationale: "Unselected annotation revised" } },
      1,
      cycleActor,
    );
    assert.equal((await t.evidence.compareReceipt(original.id)).token, initial.token);
    assert.equal((await t.evidence.compareReceipt(original.id)).review.decision?.id, accepted.id);
    await t.updateEntity(
      edited.id,
      edited.version,
      { fields: { ...edited.fields, limit_W: 18 } },
      1,
      cycleActor,
    );
    await t.updateEntity(
      f.article.id,
      1,
      { fields: { ...f.article.fields, revision: "B" } },
      1,
      cycleActor,
    );
    const changed = await t.evidence.compareReceipt(original.id);
    assert.equal(changed.state, "changed");
    assert.equal(changed.review.state, "unreviewed");
    assert.equal(changed.review.previous?.id, accepted.id);
    const beforeRejected = await t.exportProject();
    await assert.rejects(
      t.evidence.review(
        {
          receiptId: original.id,
          decision: "accepted",
          rationale: "Stale comparison",
          expectedComparison: initial.token,
        },
        cycleActor,
      ),
      { code: "conflict" },
    );
    assert.deepEqual(await t.exportProject(), beforeRejected);
    await t.evidence.review(
      {
        receiptId: original.id,
        decision: "accepted",
        rationale:
          "SIMULATED judgment of changed context; original result applies only to its recorded inputs",
        expectedComparison: changed.token,
      },
      cycleActor,
    );
    const reviewed = await t.evidence.compareReceipt(original.id);
    assert.equal(reviewed.state, "changed");
    assert.equal(reviewed.review.state, "accepted");
    assert.equal((await t.getEntity(f.requirement.id)).fields.verificationStatus, "not_verified");
    writeFileSync(f.definitionFile, "Section 4.2: Maximum operating power 18 W\n");
    await t.evidence.observe(
      { entityId: f.definition.id, locator: { system: "file", path: f.definitionFile } },
      cycleActor,
    );
    const reference = await t.getReference(f.definitionReference.id);
    assert.equal(reference.selectedObservation?.id, f.definitionObservation.id);
    assert.equal(reference.sourceChanged, true);
    assert.equal(reference.passage, "unknown");
    unlinkSync(f.definitionFile);
    await t.evidence.observe(
      { entityId: f.definition.id, locator: { system: "file", path: f.definitionFile } },
      cycleActor,
    );
    const unknown = await t.evidence.compareReceipt(original.id);
    assert.equal(unknown.state, "unknown");
    assert.equal(unknown.hasChanged, true);
    assert.equal(unknown.hasUnknown, true);
    const beforeUnknownAcceptance = await t.exportProject();
    await assert.rejects(
      t.evidence.review(
        {
          receiptId: original.id,
          decision: "accepted",
          rationale: "Unknown must not become known",
          expectedComparison: unknown.token,
        },
        cycleActor,
      ),
      { code: "validation" },
    );
    assert.deepEqual(await t.exportProject(), beforeUnknownAcceptance);
    const review = await t.evidence.review(
      {
        receiptId: original.id,
        decision: "needs_reevaluation",
        rationale: "SIMULATED: source unavailable and current criterion/article differ",
        expectedComparison: unknown.token,
      },
      cycleActor,
    );
    assert.deepEqual(await t.evidence.getReceipt(original.id), original);
    const saved = await t.exportProject();
    const reopened = f.reopen();
    assert.deepEqual(await reopened.exportProject(), saved);
    assert.equal(
      (await reopened.evidence.compareReceipt(original.id)).review.decision?.id,
      review.id,
    );
    assert.deepEqual(await reopened.evidence.getReceipt(original.id), original);
  } finally {
    f.close();
  }
});

test("REQ-016/017 and bounded impact: native history, reference state and scope stay exact without inferring content dependencies", async () => {
  const f = await evidenceCycleFixture();
  let server: Awaited<ReturnType<typeof startLocalServer>> | undefined;
  try {
    const t = f.tracer,
      query = impactQuery(f),
      before = await t.exportProject();
    const baselinePage = await t.baselines.contents({
      baselineId: f.baseline.id,
      kind: "entity",
      limit: 2,
    });
    assert.equal(baselinePage.objects.items.length, 2);
    assert.ok(baselinePage.objects.nextAfter);
    assert.equal(baselinePage.baseline.projectRevision, f.baseline.projectRevision);
    const originalPin = await t.getNativePin(f.requirement.id, 1);
    assert.equal(originalPin.entity.fields.limit_W, 20);
    const initialImpact = await t.getChangeImpact(query);
    assert.equal(initialImpact.summary.current, 1);
    assert.deepEqual(
      initialImpact.native.relationships.find((d) => d.id === f.definitionReference.id)?.after,
      f.definitionReference,
    );
    await t.updateEntity(
      f.requirement.id,
      1,
      { fields: { ...f.requirement.fields, rationale: "Only unselected rationale changed" } },
      1,
      cycleActor,
    );
    const annotationImpact = await t.getChangeImpact(query);
    assert.equal(
      annotationImpact.native.entities.find((d) => d.id === f.requirement.id)?.state,
      "modified",
    );
    assert.equal(annotationImpact.evaluations.items[0].scope.state, "current");
    await t.updateRelationship(
      f.definitionReference.id,
      1,
      {
        ...f.definitionReference,
        reference: {
          ...f.definitionReference.reference!,
          explanation: "A different interpretation, preserved as a relationship revision",
        },
      },
      1,
      cycleActor,
    );
    const changed = await t.getChangeImpact(query);
    assert.equal(changed.evaluations.items[0].scope.hasChanged, true);
    assert.equal(
      changed.evaluations.items[0].comparison.relationshipInputs?.find(
        (r) => r.id === f.definitionReference.id,
      )?.state,
      "changed",
    );
    assert.equal(changed.native.entities.filter((d) => d.id === f.article.id).length, 1);
    assert.equal(changed.native.before.paths.filter((p) => p.entityId === f.article.id).length, 1);
    const bounded = await t.getChangeImpact({ ...query, depth: 1 });
    assert.equal(bounded.native.after.paths.length, 4);
    assert.deepEqual(bounded.native.after.expandedIds, [f.requirement.id]);
    const history = (await t.history({ kind: "relationship", id: f.definitionReference.id })).items;
    assert.deepEqual(
      history.map((r) => r.version),
      [1, 2],
    );
    assert.deepEqual(history[0].snapshot, f.definitionReference);
    await t.removeRelationship(f.definitionReference.id, 2, 1, cycleActor);
    assert.deepEqual(
      (await t.history({ kind: "relationship", id: f.definitionReference.id })).items.map((r) => [
        r.version,
        r.snapshot === null,
      ]),
      [
        [1, false],
        [2, false],
        [3, true],
      ],
    );
    const oldLinks = await t.baselines.contents({
      baselineId: f.baseline.id,
      kind: "relationship",
      limit: 100,
    });
    assert.deepEqual(
      oldLinks.objects.items.find((l) => l.id === f.definitionReference.id),
      f.definitionReference,
    );
    assert.equal((await t.getChangeImpact(query)).evaluations.items[0].scope.hasUnknown, true);
    assert.deepEqual(await t.evidence.getReceipt(f.receipt.id), f.receipt);
    const saved = await t.exportProject();
    server = await startLocalServer(t, undefined, 0, undefined, [], { actor: "headless-read" });
    const client = createClient({ baseUrl: server.origin });
    assert.deepEqual(
      await client.read("/api/impact", {
        ...query,
        relationshipTypes: query.relationshipTypes,
      }),
      await t.getChangeImpact(query),
    );
    assert.deepEqual(await t.exportProject(), saved);
    assert.equal(saved.provenance.revisions.length > before.provenance.revisions.length, true);
  } finally {
    await server?.close();
    f.close();
  }
});

test("superseding results, evidence-scoped cursors and baseline pages retain historical truth and explicit boundaries", async () => {
  const f = await evidenceCycleFixture();
  try {
    const t = f.tracer,
      original = structuredClone(f.receipt);
    const run = await t.createEntity(
      {
        type: "verification_run",
        key: "RUN-B",
        fields: {
          title: "Simulated repeat at different conditions",
          conditions: { ambient_C: 25, mode: "normal", peak_W: 21 },
        },
      },
      1,
      cycleActor,
    );
    writeFileSync(f.reportFile, "SIMULATED repeat: article A, procedure P1, 25 C, peak 21 W\n");
    const observation = await t.evidence.observe(
      { entityId: f.report.id, locator: { system: "file", path: f.reportFile } },
      cycleActor,
    );
    const reference = await t.createRelationship(
      {
        ...f.reportReference,
        source: run.id,
        reference: {
          ...f.reportReference.reference!,
          state: { mode: "pinned", observationId: observation.id },
        },
      },
      1,
      cycleActor,
    );
    const replacementInput = {
      outputId: f.conclusion.id,
      outcome: "SIMULATED FAIL: repeat at 25 C, 21 W > 20 W. Workflow fixture only.",
      supersedes: original.id,
      inputs: f.inputs.map((input) =>
        input.entityId === f.report.id
          ? { ...input, observationId: observation.id }
          : input.entityId === f.run.id
            ? { ...input, entityId: run.id }
            : input,
      ),
      relationshipInputs: [{ id: f.definitionReference.id }, { id: reference.id }],
    };
    const beforeInvalid = await t.exportProject();
    await assert.rejects(
      t.evidence.recordReceipt({ ...replacementInput, outputId: run.id }, cycleActor),
      { code: "validation" },
    );
    assert.deepEqual(await t.exportProject(), beforeInvalid);
    const replacement = await t.evidence.recordReceipt(replacementInput, cycleActor);
    const comparison = await t.evidence.compareReceipt(replacement.id);
    assert.equal(comparison.state, "current");
    assert.match(replacement.outcome, /FAIL/);
    assert.equal(
      replacement.inputs.find((input) => input.role === "activity conditions")?.entityId,
      run.id,
    );
    const old = await t.evidence.compareReceipt(original.id);
    assert.equal(old.state, "changed");
    assert.deepEqual(old.supersededBy, [replacement.id]);
    assert.equal(
      (await t.getReference(f.reportReference.id)).selectedObservation?.id,
      f.reportObservation.id,
    );
    const query = { ...impactQuery(f), limit: 1 };
    const first = await t.getChangeImpact(query);
    assert.equal(first.summary.scope, "page");
    assert.equal(first.summary.evaluated, 1);
    assert.ok(first.evaluations.nextAfter);
    assert.equal(first.evaluations.items[0].comparison.state, "changed");
    assert.equal(
      first.evaluations.items[0].scope.state,
      "current",
      "Out-of-scope report content is not a selected criterion/article dependency",
    );
    assert.equal(
      first.native.entities.some((d) => d.id === f.report.id),
      false,
    );
    const head = (await t.timeline()).head;
    await t.evidence.review(
      {
        receiptId: original.id,
        expectedComparison: old.token,
        decision: "acknowledged",
        rationale:
          "SIMULATED acknowledgment of later report state; original selected pin is retained",
      },
      cycleActor,
    );
    assert.equal((await t.timeline()).head, head);
    const beforeStale = await t.exportProject();
    await assert.rejects(t.getChangeImpact({ ...query, after: first.evaluations.nextAfter }), {
      code: "conflict",
    });
    assert.deepEqual(await t.exportProject(), beforeStale);
    const all = await t.getChangeImpact({ ...query, limit: 10 });
    assert.equal(all.evaluations.items.length, 2);
    assert.deepEqual(
      all.evaluations.items.find((item) => item.receipt.id === original.id)?.supersession,
      { count: 1, ids: [replacement.id] },
    );
    const contents = await t.baselines.contents({
      baselineId: f.baseline.id,
      kind: "entity",
      limit: 2,
    });
    await assert.rejects(
      t.baselines.contents({
        baselineId: f.baseline.id,
        kind: "relationship",
        limit: 2,
        after: contents.objects.nextAfter,
      }),
      { code: "validation" },
    );
    assert.deepEqual(await t.evidence.getReceipt(original.id), original);
    assert.equal((await t.getEntity(f.requirement.id)).fields.verificationStatus, "not_verified");
  } finally {
    f.close();
  }
});
