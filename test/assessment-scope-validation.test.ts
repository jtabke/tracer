import test from "node:test";
import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import { applicationModelFixture, assessmentOpenRequest } from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";
import { parseAssessmentScope } from "../src/core/assessment-scope-validation.ts";
import type { OpenChangeAssessment } from "../src/core/change-assessment.ts";

test("scope validation preserves legacy metadata absence and rejects corrupt population/provenance", async () => {
  const f = await applicationModelFixture();
  try {
    const opening = await assessmentOpenRequest(f),
      result = await f.tracer.changeAssessments.open(opening, actor);
    const original = parseAssessmentScope(
      result.receipt.output.fields[f.definition.assessment.fields.scope],
    );
    const legacy = structuredClone(original);
    delete legacy.control;
    assert.deepEqual(parseAssessmentScope(legacy), legacy);
    const samples: unknown[] = [
      { ...original, candidates: [] },
      { ...original, candidates: [...original.candidates, original.candidates[0]] },
      { ...original, candidates: [{ ...original.candidates[0], change: "removed" }] },
      {
        ...original,
        basis: { ...original.basis, baselineRevision: original.basis.projectRevision + 1 },
      },
      {
        ...original,
        retained: [{ kind: "entity", id: "outside-population", basis: original.basis }],
      },
      {
        ...original,
        discovery: {
          ...original.discovery,
          before: {
            ...original.discovery.before,
            paths: [{ entityId: f.criterion.id, depth: 1, relationshipIds: [] }],
          },
        },
      },
      { ...original, query: { ...original.query, relationshipTypes: ["x", "x"] } },
      { ...original, control: { commandId: opening.commandId } },
      { ...original, refresh: { reason: "", previousAssessmentVersion: 1 } },
    ];
    for (const sample of samples)
      assert.throws(() => parseAssessmentScope(sample), { code: "validation" });
  } finally {
    f.close();
  }
});

test("unknown observed inputs remain explicit in controlled scope without establishing acceptance", async () => {
  const f = await applicationModelFixture();
  try {
    await f.tracer.evidence.recordReceipt(
      {
        outputId: f.criterion.id,
        outcome: "Synthetic result using available source",
        inputs: [{ entityId: f.spec.entity.id, observationId: f.spec.observation.id }],
      },
      actor,
    );
    unlinkSync(f.specFile);
    const observation = await f.tracer.evidence.observe(
      { entityId: f.spec.entity.id, locator: { system: "file", path: f.specFile } },
      actor,
    );
    assert.equal(observation.availability, "unknown");
    const opening: OpenChangeAssessment = await assessmentOpenRequest(f);
    opening.query.relationshipTypes = ["cites"];
    await f.tracer.changeAssessments.open(opening, actor);
    const view = await f.tracer.changeAssessments.get({
      assessmentId: opening.assessmentId,
      openingCommandId: opening.commandId,
    });
    const receipt = view.scope.candidates.find((item) => item.kind === "receipt");
    assert.ok(receipt?.kind === "receipt");
    assert.equal(receipt.scope.state, "unknown");
    assert.equal(receipt.scope.hasUnknown, true);
    assert.equal(view.assessment.state, f.definition.states.open);
    const corrupt = structuredClone(view.scope);
    const item = corrupt.candidates.find((item) => item.kind === "receipt");
    assert.ok(item?.kind === "receipt");
    item.scope.state = "current";
    assert.throws(() => parseAssessmentScope(corrupt), { code: "validation" });
  } finally {
    f.close();
  }
});
