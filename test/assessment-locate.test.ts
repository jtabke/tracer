import test from "node:test";
import assert from "node:assert/strict";
import { applicationModelFixture, assessmentOpenRequest } from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: assessment identity resolves original opening after later receipts and restart`, async () => {
    const f = await applicationModelFixture(domain);
    try {
      const request = await assessmentOpenRequest(f);
      await f.tracer.changeAssessments.open(request, actor);
      await f.tracer.evidence.recordReceipt(
        {
          outputId: request.assessmentId,
          outcome: "Later historical result",
          inputs: [{ entityId: f.profile.id, facet: "native" }],
        },
        actor,
      );
      const selection = { assessmentId: request.assessmentId, openingCommandId: request.commandId };
      const before = await f.tracer.exportProject();
      f.base.reopen();
      assert.deepEqual(
        await f.tracer.changeAssessments.locate(request.assessmentId),
        await f.tracer.changeAssessments.get(selection),
      );
      await assert.rejects(f.tracer.changeAssessments.locate(f.criterion.id), {
        code: "not_found",
      });
      await f.tracer.evidence.recordReceipt(
        {
          outputId: f.criterion.id,
          outcome: "Not a controlled opening",
          inputs: [{ entityId: f.profile.id, facet: "native" }],
        },
        actor,
      );
      const recorded = await f.tracer.exportProject();
      await assert.rejects(f.tracer.changeAssessments.locate(f.criterion.id), { code: "conflict" });
      assert.deepEqual(await f.tracer.exportProject(), recorded);
      assert.equal(recorded.projectRevision, before.projectRevision);
    } finally {
      f.close();
    }
  });
