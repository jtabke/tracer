import test from "node:test";
import assert from "node:assert/strict";
import type { AssessmentScope } from "../src/core/change-assessment.ts";
import { canonical } from "../src/core/evidence.ts";
import { applicationModelFixture, assessmentOpenRequest } from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";

for (const domain of ["engineering", "research"] as const)
  test(`assessment opening: ${domain} binds genesis to exact model and exhausts receipt pages`, async () => {
    const f = await applicationModelFixture(domain);
    try {
      const command = {
        ...f.command,
        expectedSchemaVersion: 2,
        expectedProjectRevision: (await f.tracer.timeline()).head,
      };
      const oldResult = await f.tracer.evaluations.commit(command, actor);
      await f.tracer.evidence.recordReceipt(
        { ...command.receipt, supersedes: oldResult.receipt.id },
        actor,
      );
      const request = await assessmentOpenRequest(f);
      const calls = f.base.observations;
      const result = await f.tracer.changeAssessments.open(request, actor);
      const fields = result.receipt.output.fields;
      assert.equal(result.native?.changeset.projectRevision, request.expectedProjectRevision + 1);
      assert.equal(result.native?.results.length, 1);
      assert.equal(result.receipt.output.type, f.definition.assessment.type);
      assert.equal(fields[f.definition.assessment.fields.state], f.definition.states.open);
      assert.equal(fields[f.definition.assessment.fields.closure], null);
      assert.deepEqual(fields[f.definition.assessment.fields.model], request.model);
      const scope = fields[f.definition.assessment.fields.scope] as AssessmentScope;
      assert.equal(scope.candidates.length, 3);
      assert.deepEqual(
        scope.candidates.map((item) => item.kind),
        ["entity", "receipt", "receipt"],
      );
      assert.deepEqual(scope.basis, {
        projectRevision: request.expectedProjectRevision,
        evidenceRevision: request.expectedEvidenceRevision,
        schemaVersion: 2,
        baselineRevision: f.baseline.projectRevision,
      });
      assert.equal(scope.discovery.complete, true);
      assert.equal(scope.discovery.interpretation, "selected_traversal");
      assert.equal(scope.discovery.excludedReceiptOutputId, request.assessmentId);
      assert.deepEqual(
        result.receipt.inputs.map((input) => [input.entityId, input.revision, input.facet]),
        [[f.profile.id, 1, "native"]],
      );
      assert.equal(f.base.observations, calls, "no observer IO in application command");
      const oldIntent = await f.repository.transaction((tx) =>
        tx.getEvaluationCommand(command.commandId),
      );
      assert.equal(
        oldIntent?.intent,
        canonical(JSON.parse(JSON.stringify({ input: command, provenance: actor }))),
      );
      // The caller's request, not generated native operations or discovery counters, owns recovery.
      await f.tracer.updateEntity(
        f.profile.id,
        1,
        {
          fields: {
            ...f.profile.fields,
            [f.pin.field]: { ...f.definition, states: { open: "new_open", closed: "new_closed" } },
          },
        },
        2,
        actor,
      );
      await f.tracer.evidence.observe(
        { entityId: f.spec.entity.id, locator: { system: "file", path: f.specFile } },
        actor,
      );
      await f.tracer.removeEntity(request.assessmentId, 1, 2, actor);
      f.base.reopen();
      const preserved = await f.tracer.exportProject();
      assert.deepEqual(await f.tracer.changeAssessments.open(request, actor), result);
      assert.deepEqual(await f.tracer.evaluations.getOutcome(request.commandId), result);
      assert.deepEqual(await f.tracer.exportProject(), preserved);
      await assert.rejects(
        f.tracer.changeAssessments.open({ ...request, title: "Different intent" }, actor),
        { code: "conflict" },
      );
      await assert.rejects(
        f.tracer.changeAssessments.open(request, {
          ...actor,
          reason: "Different actor intent",
        }),
        { code: "conflict" },
      );
      assert.deepEqual(await f.tracer.evaluations.commit(command, actor), oldResult);
    } finally {
      f.close();
    }
  });

test("assessment opening rejects stale, invalid and controlled-field proposals without reserving success", async () => {
  const f = await applicationModelFixture();
  try {
    const request = await assessmentOpenRequest(f),
      before = await f.tracer.exportProject();
    for (const [change, code] of [
      [{ expectedSchemaVersion: 99 }, "schema_conflict"],
      [{ expectedProjectRevision: 0 }, "conflict"],
      [{ expectedEvidenceRevision: 99 }, "conflict"],
      [{ expectedEvidenceRevision: -1 }, "validation"],
      [{ additionalFields: { [f.definition.assessment.fields.state]: "closed" } }, "validation"],
      [{ additionalFields: { unknown: true } }, "validation"],
      [{ query: { ...request.query, limit: 1 } }, "validation"],
      [{ purpose: " " }, "validation"],
    ] as const) {
      const invalid = { ...request, ...change };
      await assert.rejects(f.tracer.changeAssessments.open(invalid, actor), {
        code,
      });
      assert.deepEqual(await f.tracer.exportProject(), before);
      assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
    }
    await f.tracer.changeAssessments.open(request, actor);
    const after = await f.tracer.exportProject();
    const next = await assessmentOpenRequest(f);
    await assert.rejects(
      f.tracer.changeAssessments.open(
        { ...next, commandId: "duplicate-identity", assessmentId: request.assessmentId },
        actor,
      ),
      { code: "conflict" },
    );
    assert.deepEqual(await f.tracer.exportProject(), after);
  } finally {
    f.close();
  }
});

test("assessment opening refuses populations beyond its budget instead of freezing a partial page", async () => {
  const f = await applicationModelFixture();
  try {
    for (let index = 0; index < 25; index++)
      await f.tracer.evidence.recordReceipt(
        {
          outputId: f.criterion.id,
          outcome: "Synthetic input use " + index,
          inputs: [{ entityId: f.criterion.id, facet: "native" }],
        },
        actor,
      );
    const request = await assessmentOpenRequest(f),
      before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.changeAssessments.open(request, actor), {
      code: "validation",
    });
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
  } finally {
    f.close();
  }
});

test("assessment opening captures caller intent before waiting for the repository", async () => {
  const f = await applicationModelFixture();
  let release!: () => void, entered!: () => void;
  try {
    const request = await assessmentOpenRequest(f),
      original = structuredClone(request),
      origin = { ...actor };
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const held = f.repository.transaction(async (tx) => {
      await tx.headRevision();
      entered();
      await gate;
    });
    await ready;
    const pending = f.tracer.changeAssessments.open(request, origin);
    request.title = "Changed after invocation";
    request.model.version = 999;
    origin.reason = "Changed caller provenance";
    release();
    await held;
    const result = await pending;
    assert.equal(
      result.receipt.output.fields[f.definition.assessment.fields.title],
      original.title,
    );
    assert.equal(result.receipt.reason, actor.reason);
    assert.deepEqual(await f.tracer.changeAssessments.open(original, actor), result);
  } finally {
    release?.();
    f.close();
  }
});

test("assessment scope retains removed native candidates without inventing a current capture", async () => {
  const f = await applicationModelFixture();
  try {
    await f.tracer.removeEntity(f.criterion.id, 1, 2, actor, true);
    const request = await assessmentOpenRequest(f);
    const result = await f.tracer.changeAssessments.open(request, actor);
    const scope = result.receipt.output.fields[
      f.definition.assessment.fields.scope
    ] as AssessmentScope;
    assert.deepEqual(scope.candidates, [
      {
        kind: "entity",
        id: f.criterion.id,
        change: "removed",
        beforeVersion: 1,
        version: null,
        observationId: null,
      },
    ]);
    assert.equal(scope.discovery.before.paths[0].entityId, f.criterion.id);
    assert.equal(scope.discovery.after.paths.length, 0);
    assert.deepEqual(
      result.receipt.inputs.map((input) => input.entityId),
      [f.profile.id],
    );
  } finally {
    f.close();
  }
});
