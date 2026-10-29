import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationModelFixture,
  assessmentOpenRequest,
  assessmentCommand,
  dispositionProposal,
} from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";
import type { OpenChangeAssessment, AssessmentScope } from "../src/core/change-assessment.ts";

type Fixture = Awaited<ReturnType<typeof applicationModelFixture>>;
async function capture(f: Fixture) {
  const context = await f.tracer.configurations.captureContext();
  const criterion = await f.tracer.getEntity(f.criterion.id);
  return f.tracer.configurations.captureExact(
    {
      id: crypto.randomUUID(),
      name: "Explicit criterion candidate",
      subjectId: f.article.id,
      expectedSubjectVersion: 1,
      members: [{ entityId: criterion.id, version: criterion.version }],
      relationships: [],
      content: [],
      scope: {
        purpose: "Selected criterion state only",
        coverage: "complete",
        rationale:
          "Synthetic bounded fixture; other engineering dependencies remain outside this scope",
      },
      expectedSchemaVersion: context.schema.version,
      expectedProjectRevision: context.projectRevision,
      expectedEvidenceRevision: context.evidenceRevision,
    },
    actor,
  );
}
async function opening(
  f: Fixture,
  beforeId: string,
  afterId: string,
): Promise<OpenChangeAssessment> {
  const base = await assessmentOpenRequest(f);
  return {
    ...base,
    commandId: crypto.randomUUID(),
    query: {
      source: "configuration_pair",
      beforeId,
      afterId,
      policy: "scoped-reference-dependencies-v1",
      rootId: f.criterion.id,
      direction: "outgoing",
      relationshipTypes: [],
      depth: 1,
    },
  };
}

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: pair judgments and closure retain exact selected states through live drift, restart and a separately selected pair`, async () => {
    const f = await applicationModelFixture(domain);
    try {
      const before = await capture(f);
      await f.tracer.updateEntity(
        f.criterion.id,
        1,
        { fields: { ...f.criterion.fields, [f.model.threshold]: f.model.value + 1 } },
        2,
        actor,
      );
      const after = await capture(f),
        request = await opening(f, before.id, after.id);
      const opened = await f.tracer.changeAssessments.open(request, actor);
      const selection = { assessmentId: request.assessmentId, openingCommandId: request.commandId };
      const original = await f.tracer.changeAssessments.analyze(selection);
      assert.equal(original.view.scope.version, 2);
      assert.deepEqual(
        original.view.scope.candidates.map((x) => [x.kind, x.id]),
        [["entity", f.criterion.id]],
      );
      const digest = original.obligations[0].currentDigest;
      await f.tracer.updateEntity(
        f.criterion.id,
        2,
        { fields: { ...f.criterion.fields, [f.model.threshold]: f.model.value + 2 } },
        2,
        actor,
      );
      assert.equal(
        (await f.tracer.changeAssessments.analyze(selection)).obligations[0].currentDigest,
        digest,
      );
      const proposal = await dispositionProposal(f, selection, {
        kind: "entity",
        id: f.criterion.id,
      });
      const judged = await f.tracer.changeAssessments.setDisposition(proposal, actor);
      const detail = await f.tracer.changeAssessments.disposition(selection, proposal.subject);
      assert.equal(detail!.data.basis.version, 2);
      assert.equal(detail!.data.basis.inputs[0].revision, 2);
      assert.ok(
        judged.receipt.inputs.some((x) => x.entityId === f.criterion.id && x.entity.version === 2),
      );
      const closing = await assessmentCommand(f, selection),
        closed = await f.tracer.changeAssessments.close(closing, actor);
      assert.equal(
        (await f.tracer.changeAssessments.analyze(selection)).completion.state,
        "completed",
      );
      const other = await capture(f),
        newRequest = await opening(f, before.id, other.id);
      await f.tracer.changeAssessments.open(newRequest, actor);
      const fresh = await f.tracer.changeAssessments.analyze({
        assessmentId: newRequest.assessmentId,
        openingCommandId: newRequest.commandId,
      });
      assert.equal(fresh.obligations[0].state, "undisposed");
      assert.notEqual(fresh.obligations[0].currentDigest, digest);
      assert.equal(
        (await f.tracer.changeAssessments.analyze(selection)).completion.state,
        "completed",
      );
      const snapshot = await f.tracer.exportProject();
      f.base.reopen();
      assert.deepEqual(await f.tracer.changeAssessments.open(request, actor), opened);
      assert.deepEqual(await f.tracer.changeAssessments.close(closing, actor), closed);
      assert.deepEqual(await f.tracer.exportProject(), snapshot);
      assert.equal(
        (await f.tracer.changeAssessments.analyze(selection)).completion.state,
        "completed",
      );
    } finally {
      f.close();
    }
  });

test("pair scoped receipt accounting keeps full applicability unknown and discovers later superseding work explicitly", async () => {
  const f = await applicationModelFixture();
  try {
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "failed remains failed",
        inputs: [
          { entityId: f.criterion.id, fields: [f.model.threshold] },
          { entityId: f.article.id },
        ],
        relationshipInputs: [],
      },
      actor,
    );
    const before = await capture(f),
      after = await capture(f),
      request = await opening(f, before.id, after.id);
    await f.tracer.changeAssessments.open(request, actor);
    const selection = { assessmentId: request.assessmentId, openingCommandId: request.commandId };
    const full = await f.tracer.configurations.compareDependencies({
      beforeId: before.id,
      afterId: after.id,
    });
    assert.equal(full.evaluations.items[0].after.state, "unknown");
    const analysis = await f.tracer.changeAssessments.analyze(selection);
    assert.equal(analysis.obligations.length, 2);
    assert.ok(analysis.obligations.every((x) => !x.hasUnknown));
    for (const candidate of analysis.obligations)
      await f.tracer.changeAssessments.setDisposition(
        await dispositionProposal(f, selection, candidate.subject),
        actor,
      );
    const closing = await assessmentCommand(f, selection),
      closed = await f.tracer.changeAssessments.close(closing, actor);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).completion.state,
      "completed",
    );
    assert.equal((await f.tracer.evidence.getReceipt(receipt.id)).outcome, "failed remains failed");
    await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "new unexecuted result",
        inputs: [{ entityId: f.criterion.id }],
        relationshipInputs: [],
        supersedes: receipt.id,
      },
      actor,
    );
    const changed = await f.tracer.changeAssessments.analyze(selection);
    assert.equal(changed.discovery, "changed");
    assert.equal(changed.completion.state, "needs_reassessment");
    assert.equal(
      changed.obligations.find((x) => x.subject.kind === "receipt")!.state,
      "stale_basis",
    );
    assert.deepEqual(await f.tracer.evaluations.getOutcome(closing.commandId), closed);
    await f.tracer.changeAssessments.reopen(await assessmentCommand(f, selection), actor);
    await f.tracer.changeAssessments.refresh(await assessmentCommand(f, selection), actor);
    assert.equal((await f.tracer.changeAssessments.analyze(selection)).obligations.length, 3);
    await assert.rejects(
      f.tracer.changeAssessments.close(await assessmentCommand(f, selection), actor),
      { code: "conflict" },
    );
  } finally {
    f.close();
  }
});

test("pair selected native input capture survives deletion and cannot be retargeted by native field edits", async () => {
  const f = await applicationModelFixture();
  try {
    const before = await capture(f),
      after = await capture(f),
      request = await opening(f, before.id, after.id);
    await f.tracer.changeAssessments.open(request, actor);
    const selection = { assessmentId: request.assessmentId, openingCommandId: request.commandId };
    const exported = await f.tracer.exportProject();
    for (const link of exported.current.relationships.filter(
      (x) => x.source === f.criterion.id || x.target === f.criterion.id,
    ))
      await f.tracer.removeRelationship(link.id, link.version, 2, actor);
    await f.tracer.removeEntity(f.criterion.id, 1, 2, actor);
    const proposal = await dispositionProposal(f, selection, {
      kind: "entity",
      id: f.criterion.id,
    });
    await f.tracer.changeAssessments.setDisposition(proposal, actor);
    await f.tracer.changeAssessments.close(await assessmentCommand(f, selection), actor);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).completion.state,
      "completed",
    );
    const entity = await f.tracer.getEntity(request.assessmentId),
      field = f.definition.assessment.fields.scope;
    const scope = structuredClone(entity.fields[field]) as AssessmentScope;
    assert.ok(scope.version === 2);
    scope.query.afterId = before.id;
    scope.basis.pair.afterId = before.id;
    await f.tracer.updateEntity(
      entity.id,
      entity.version,
      { fields: { ...entity.fields, [field]: scope } },
      2,
      actor,
    );
    await assert.rejects(f.tracer.changeAssessments.get(selection), { code: "conflict" });
  } finally {
    f.close();
  }
});

test("selected membership/topology removal is known without pretending the live source was deleted or its old unknown bytes resolved", async () => {
  const f = await applicationModelFixture();
  try {
    const context = await f.tracer.configurations.captureContext();
    const common = {
      name: "Selected source membership",
      subjectId: f.article.id,
      expectedSubjectVersion: 1,
      scope: {
        purpose: "Explicit selected source/traversal scope",
        coverage: "complete" as const,
        rationale:
          "Removing selected membership does not establish live project deletion or old byte availability",
      },
    };
    const before = await f.tracer.configurations.captureExact(
      {
        ...common,
        id: crypto.randomUUID(),
        members: [f.criterion, f.spec.entity].map((e) => ({ entityId: e.id, version: 1 })),
        relationships: [{ relationshipId: f.base.definition.id, version: 1 }],
        content: [
          { entityId: f.spec.entity.id, observationId: null, reason: "No selected original bytes" },
        ],
        expectedSchemaVersion: context.schema.version,
        expectedProjectRevision: context.projectRevision,
        expectedEvidenceRevision: context.evidenceRevision,
      },
      actor,
    );
    const next = await f.tracer.configurations.captureContext();
    const after = await f.tracer.configurations.captureExact(
      {
        ...common,
        id: crypto.randomUUID(),
        members: [{ entityId: f.criterion.id, version: 1 }],
        relationships: [],
        content: [],
        expectedSchemaVersion: next.schema.version,
        expectedProjectRevision: next.projectRevision,
        expectedEvidenceRevision: next.evidenceRevision,
      },
      actor,
    );
    const request = await opening(f, before.id, after.id);
    request.query.relationshipTypes = ["cites"];
    await f.tracer.changeAssessments.open(request, actor);
    const selection = { assessmentId: request.assessmentId, openingCommandId: request.commandId };
    const analysis = await f.tracer.changeAssessments.analyze(selection);
    assert.equal(analysis.obligations.length, 3);
    assert.ok(analysis.obligations.every((x) => !x.hasUnknown));
    for (const obligation of analysis.obligations)
      await f.tracer.changeAssessments.setDisposition(
        await dispositionProposal(f, selection, obligation.subject),
        actor,
      );
    const detail = await f.tracer.changeAssessments.disposition(selection, {
      kind: "entity",
      id: f.spec.entity.id,
    });
    assert.deepEqual(detail!.data.basis.absences, [{ kind: "entity", id: f.spec.entity.id }]);
    assert.equal(detail!.data.basis.version, 2);
    await f.tracer.changeAssessments.close(await assessmentCommand(f, selection), actor);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).completion.state,
      "completed",
    );
    assert.equal((await f.tracer.getEntity(f.spec.entity.id)).id, f.spec.entity.id);
    assert.equal((await f.tracer.getRelationship(f.base.definition.id)).version, 1);
    assert.equal(
      (await f.tracer.configurations.get(before.id)).capture!.content[0].observation,
      null,
    );
  } finally {
    f.close();
  }
});
