import type { OpenChangeAssessment } from "../src/core/change-assessment.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { applicationModelFixture, assessmentOpenRequest } from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";

test("assessment rejects a wide native traversal before writing an incomplete population", async () => {
  const f = await applicationModelFixture();
  try {
    await f.tracer.applyChangeset(
      {
        expectedSchemaVersion: 2,
        operations: Array.from({ length: 25 }, (_, index) => {
          const id = crypto.randomUUID();
          return [
            {
              op: "entity.create",
              id,
              input: { type: f.model.article, fields: { title: "Candidate " + index } },
            },
            {
              op: "relationship.create",
              input: { type: f.model.allocation, source: f.criterion.id, target: id, fields: {} },
            },
          ] as const;
        }).flat(),
      },
      actor,
    );
    const request: OpenChangeAssessment = await assessmentOpenRequest(f);
    request.query.relationshipTypes = [f.model.allocation];
    const before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.changeAssessments.open(request, actor), /exceeds 25 candidates/);
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
  } finally {
    f.close();
  }
});

test("assessment rejects oversized captured-use scope even when candidate counts are small", async () => {
  const f = await applicationModelFixture();
  try {
    for (let index = 0; index < 5; index++)
      await f.tracer.evidence.recordReceipt(
        {
          outputId: f.criterion.id,
          outcome: "Synthetic many-role evaluation " + index,
          inputs: Array.from({ length: 100 }, (_, role) => ({
            entityId: f.criterion.id,
            facet: "native" as const,
            role: "independent declared use " + role,
          })),
        },
        actor,
      );
    const request = await assessmentOpenRequest(f),
      before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.changeAssessments.open(request, actor), /exceeds 64 KiB/);
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
  } finally {
    f.close();
  }
});
