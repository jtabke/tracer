import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { evaluationFixture, evaluationActor as actor } from "./evaluation-fixture.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: evidence-dependent evaluation rejects catalogue drift and recovers exact success`, async () => {
    const f = await evaluationFixture(domain);
    try {
      const initial = await f.tracer.exportProject();
      const command = { ...f.command, expectedEvidenceRevision: initial.evidenceRevision };
      await f.tracer.evidence.observe(
        { entityId: f.spec.entity.id, locator: { system: "file", path: f.specFile } },
        actor,
      );
      const before = await f.tracer.exportProject();
      assert.equal(before.projectRevision, initial.projectRevision);
      await assert.rejects(f.tracer.evaluations.commit(command, actor), {
        code: "conflict",
        details: {
          path: ["expectedEvidenceRevision"],
          expectedVersion: initial.evidenceRevision,
          actualVersion: before.evidenceRevision,
        },
      });
      for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, null, "invalid"])
        await assert.rejects(
          f.tracer.evaluations.commit(
            { ...command, expectedEvidenceRevision: value } as never,
            actor,
          ),
          { code: "validation" },
        );
      assert.deepEqual(await f.tracer.exportProject(), before);
      assert.equal(await f.tracer.evaluations.getOutcome(command.commandId), null);
      command.expectedEvidenceRevision = before.evidenceRevision;
      const result = await f.tracer.evaluations.commit(command, actor);
      const comparison = await f.tracer.evidence.compareReceipt(result.receipt.id);
      const head = (await f.tracer.timeline()).head;
      const watermark = (await f.tracer.exportProject()).evidenceRevision;
      await f.tracer.evidence.review(
        {
          receiptId: result.receipt.id,
          expectedComparison: comparison.token,
          decision: "acknowledged",
          rationale: "Record the exact current comparison",
        },
        actor,
      );
      assert.equal((await f.tracer.timeline()).head, head);
      const afterReview = await f.tracer.exportProject();
      const repeat = {
        ...command,
        commandId: domain + "-guarded-repeat",
        expectedProjectRevision: head,
        operations: [],
        expectedEvidenceRevision: watermark,
      };
      await assert.rejects(f.tracer.evaluations.commit(repeat, actor), { code: "conflict" });
      assert.deepEqual(await f.tracer.exportProject(), afterReview);
      assert.equal(await f.tracer.evaluations.getOutcome(repeat.commandId), null);
      const reopened = f.reopen();
      assert.deepEqual(await reopened.evaluations.commit(command, actor), result);
      assert.deepEqual(await reopened.evaluations.getOutcome(command.commandId), result);
      await assert.rejects(
        reopened.evaluations.commit(
          { ...command, expectedEvidenceRevision: afterReview.evidenceRevision },
          actor,
        ),
        { code: "conflict", details: { path: ["commandId"] } },
      );
      assert.deepEqual(await reopened.exportProject(), afterReview);
      const receiptOnly = await reopened.evaluations.commit(
        { ...repeat, expectedEvidenceRevision: afterReview.evidenceRevision },
        actor,
      );
      assert.equal(receiptOnly.native, null);
      assert.equal((await reopened.timeline()).head, head);
    } finally {
      f.close();
    }
  });

test("typed headless evidence guards reject stale/invalid proposals before writes and expose capability", async () => {
  const f = await evaluationFixture();
  const server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
  try {
    const client = createClient({
      baseUrl: server.origin,
      require: { features: ["evidence-revision-guards"] },
    });
    await client.checkCompatibility();
    await client.connect();
    const before = await f.tracer.exportProject();
    const command = { ...f.command, expectedEvidenceRevision: before.evidenceRevision };
    await f.tracer.evidence.observe(
      { entityId: f.spec.entity.id, locator: { system: "file", path: f.specFile } },
      actor,
    );
    const observed = await f.tracer.exportProject();
    await assert.rejects(client.write("/api/evaluation-commands", command), { code: "conflict" });
    await assert.rejects(
      client.write("/api/evaluation-commands", { ...command, expectedEvidenceRevision: -1 }),
      { code: "validation" },
    );
    assert.deepEqual(await f.tracer.exportProject(), observed);
    assert.equal(
      await client.read("/api/evaluation-outcome", { commandId: command.commandId }),
      null,
    );
    const corrected = { ...command, expectedEvidenceRevision: observed.evidenceRevision };
    const result = await client.write("/api/evaluation-commands", corrected);
    assert.deepEqual(await client.write("/api/evaluation-commands", corrected), result);
  } finally {
    await server.close();
    f.close();
  }
});
