import test from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, writeFileSync } from "node:fs";
import { evaluationFixture, evaluationActor as actor } from "./evaluation-fixture.ts";
for (const domain of ["engineering", "research"] as const)
  test(`application model: ${domain} retains project semantics through atomic capture, scoped impact and review`, async () => {
    const f = await evaluationFixture(domain);
    try {
      const t = f.tracer,
        before = await t.exportProject();
      assert.equal(
        (await t.coverage.evaluate({ expectationId: "method" })).rows.items[0].state,
        "missing",
      );
      const calls = f.observations,
        result = await t.evaluations.commit(f.command, actor);
      assert.equal(
        f.observations,
        calls,
        "Commit uses explicit observations; it performs no external IO",
      );
      assert.equal(result.native?.changeset.projectRevision, before.projectRevision + 1);
      assert.equal(result.native?.results.length, 5);
      assert.deepEqual(
        result.receipt.inputs.map((i) => i.role),
        [
          "criterion",
          "candidate",
          "method",
          "activity conditions",
          "criterion source",
          "supporting material",
        ],
      );
      assert.equal(result.receipt.output.type, f.model.conclusion);
      assert.equal(result.receipt.inputs[0].entity.type, f.model.criterion);
      assert.equal(result.receipt.outcome, f.model.outcome);
      assert.deepEqual((await t.getEntity(f.criterion.id)).fields, f.criterion.fields);
      assert.equal(
        (await t.coverage.evaluate({ expectationId: "method" })).rows.items[0].state,
        "covered",
      );
      const original = structuredClone(result),
        head = (await t.timeline()).head;
      await t.evaluations.commit(
        {
          ...f.command,
          commandId: domain + "-repeat",
          expectedProjectRevision: head,
          operations: [],
          receipt: {
            ...f.command.receipt,
            outcome: "SIMULATED repeat",
            supersedes: result.receipt.id,
          },
        },
        actor,
      );
      assert.equal((await t.timeline()).head, head);
      const first = await t.getChangeImpact(f.impact);
      assert.equal(first.summary.scope, "page");
      assert.equal(first.evaluations.items.length, 1);
      assert.ok(first.evaluations.nextAfter);
      const compared = await t.evidence.compareReceipt(result.receipt.id);
      const accepted = await t.evidence.review(
        {
          receiptId: result.receipt.id,
          expectedComparison: compared.token,
          decision: "accepted",
          rationale: "SIMULATED assessment of original context",
        },
        actor,
      );
      const afterReview = await t.exportProject();
      await assert.rejects(t.getChangeImpact({ ...f.impact, after: first.evaluations.nextAfter }), {
        code: "conflict",
      });
      assert.deepEqual(await t.exportProject(), afterReview);
      const annotated = await t.updateEntity(
        f.criterion.id,
        1,
        { fields: { ...f.criterion.fields, [f.model.annotation]: "Only annotation changed" } },
        1,
        actor,
      );
      assert.equal(
        (await t.evidence.compareReceipt(result.receipt.id)).review.decision?.id,
        accepted.id,
      );
      writeFileSync(f.reportFile, "SIMULATED later report material\n");
      await t.evidence.observe(
        { entityId: f.report.entity.id, locator: { system: "file", path: f.reportFile } },
        actor,
      );
      const scope = await t.getChangeImpact({ ...f.impact, limit: 10 });
      assert.equal(
        scope.evaluations.items.find((i) => i.receipt.id === result.receipt.id)?.comparison.state,
        "changed",
      );
      assert.equal(
        scope.evaluations.items.find((i) => i.receipt.id === result.receipt.id)?.scope.state,
        "current",
      );
      await t.updateEntity(
        annotated.id,
        2,
        { fields: { ...annotated.fields, [f.model.threshold]: f.model.value / 2 } },
        1,
        actor,
      );
      assert.equal(
        (await t.getChangeImpact({ ...f.impact, limit: 10 })).evaluations.items.find(
          (i) => i.receipt.id === result.receipt.id,
        )?.scope.hasChanged,
        true,
      );
      const beforeStale = await t.exportProject();
      await assert.rejects(
        t.evidence.review(
          {
            receiptId: result.receipt.id,
            expectedComparison: compared.token,
            decision: "accepted",
            rationale: "Stale context",
          },
          actor,
        ),
        { code: "conflict" },
      );
      assert.deepEqual(await t.exportProject(), beforeStale);
      unlinkSync(f.specFile);
      await t.evidence.observe(
        { entityId: f.spec.entity.id, locator: { system: "file", path: f.specFile } },
        actor,
      );
      const unknown = await t.evidence.compareReceipt(result.receipt.id);
      assert.equal(unknown.hasChanged, true);
      assert.equal(unknown.hasUnknown, true);
      const beforeUnknown = await t.exportProject();
      await assert.rejects(
        t.evidence.review(
          {
            receiptId: result.receipt.id,
            expectedComparison: unknown.token,
            decision: "accepted",
            rationale: "Unresolved source",
          },
          actor,
        ),
        { code: "validation" },
      );
      assert.deepEqual(await t.exportProject(), beforeUnknown);
      const review = await t.evidence.review(
        {
          receiptId: result.receipt.id,
          expectedComparison: unknown.token,
          decision: "needs_reevaluation",
          rationale: "Relevant criterion and source state require reassessment",
        },
        actor,
      );
      assert.equal(
        (await t.getReference(f.definition.id)).selectedObservation?.id,
        f.spec.observation.id,
      );
      assert.equal((await t.getReference(f.definition.id)).passage, "unknown");
      const saved = await t.exportProject(),
        reopened = f.reopen();
      assert.deepEqual(await reopened.evaluations.getOutcome(f.command.commandId), original);
      assert.deepEqual(await reopened.evaluations.commit(f.command, actor), original);
      assert.equal(
        (await reopened.evidence.compareReceipt(result.receipt.id)).review.decision?.id,
        review.id,
      );
      assert.deepEqual(await reopened.evidence.getReceipt(result.receipt.id), original.receipt);
      assert.deepEqual(await reopened.exportProject(), saved);
      const baseline = await reopened.baselines.contents({
        baselineId: f.baseline.id,
        kind: "entity",
        limit: 100,
      });
      assert.equal(
        baseline.objects.items.find((e) => e.id === f.criterion.id)?.fields[f.model.threshold],
        f.model.value,
      );
    } finally {
      f.close();
    }
  });
