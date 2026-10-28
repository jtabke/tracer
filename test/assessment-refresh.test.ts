import test from "node:test";
import assert from "node:assert/strict";
import { applicationModelFixture, assessmentOpenRequest } from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";
import type {
  OpenChangeAssessment,
  RefreshChangeAssessment,
} from "../src/core/change-assessment.ts";
import { parseAssessmentScope } from "../src/core/assessment-scope-validation.ts";

async function refreshRequest(
  f: Awaited<ReturnType<typeof applicationModelFixture>>,
  opened: OpenChangeAssessment,
  id = "refresh-assessment",
): Promise<RefreshChangeAssessment> {
  const view = await f.tracer.changeAssessments.get({
    assessmentId: opened.assessmentId,
    openingCommandId: opened.commandId,
  });
  return {
    assessmentId: opened.assessmentId,
    openingCommandId: opened.commandId,
    commandId: id,
    expectedSchemaVersion: view.model.context.schemaVersion,
    expectedProjectRevision: view.model.context.projectRevision,
    expectedEvidenceRevision: view.model.context.evidenceRevision,
    expectedAssessmentVersion: view.assessment.version,
    reason: "Explicitly rediscover impact while retaining unresolved obligations",
  };
}

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: refresh retains lost traversal members, adds new receipts and pins the original model`, async () => {
    const f = await applicationModelFixture(domain);
    try {
      const article = await f.tracer.createEntity(
        { type: f.model.article, fields: { title: "Added after baseline" } },
        2,
        actor,
      );
      const link = await f.tracer.createRelationship(
        { type: f.model.allocation, source: f.criterion.id, target: article.id, fields: {} },
        2,
        actor,
      );
      const lost = await f.tracer.evidence.recordReceipt(
        {
          outputId: f.criterion.id,
          outcome: "Synthetic dependency of an added article",
          inputs: [{ entityId: article.id, facet: "native" }],
        },
        actor,
      );
      const opening: OpenChangeAssessment = await assessmentOpenRequest(f);
      opening.query.relationshipTypes = [f.model.allocation];
      const first = await f.tracer.changeAssessments.open(opening, actor);
      const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
      const before = await f.tracer.changeAssessments.get(selection);
      assert.equal(before.scope.candidates.length, 6);
      assert.equal(before.control.receiptId, first.receipt.id);
      await f.tracer.removeRelationship(link.id, 1, 2, actor);
      const added = await f.tracer.evidence.recordReceipt(
        {
          outputId: f.criterion.id,
          outcome: "New captured criterion use",
          inputs: [{ entityId: f.criterion.id, facet: "native" }],
        },
        actor,
      );
      const own = await f.tracer.evidence.recordReceipt(
        {
          outputId: opening.assessmentId,
          outcome: "Own assessment source use is explicitly excluded",
          inputs: [{ entityId: f.criterion.id, facet: "native" }],
        },
        actor,
      );
      await f.tracer.updateEntity(
        f.profile.id,
        1,
        {
          fields: {
            ...f.profile.fields,
            [f.pin.field]: {
              ...f.definition,
              states: { open: "replacement_open", closed: "replacement_closed" },
            },
          },
        },
        2,
        actor,
      );
      const request = await refreshRequest(f, opening);
      const result = await f.tracer.changeAssessments.refresh(request, actor);
      const view = await f.tracer.changeAssessments.get(selection);
      assert.equal(view.assessment.version, 2);
      assert.equal(view.assessment.state, f.definition.states.open);
      assert.equal(view.model.source.currentVersion, 2);
      assert.equal(view.model.pin.version, 1);
      assert.equal(view.scope.candidates.length, 7);
      assert.deepEqual(
        new Set(view.scope.retained!.map((item) => item.id)),
        new Set([article.id, link.id, lost.id]),
      );
      assert.ok(view.scope.candidates.some((item) => item.id === added.id));
      assert.ok(!view.scope.candidates.some((item) => item.id === own.id));
      for (const entry of view.scope.retained!) assert.deepEqual(entry.basis, before.scope.basis);
      assert.deepEqual(
        view.scope.candidates.slice(0, 6).map((item) => item.id),
        before.scope.candidates.map((item) => item.id),
      );
      assert.equal(view.control.receiptId, result.receipt.id);
      assert.deepEqual(
        (await f.tracer.getNativePin(opening.assessmentId, 1)).entity,
        first.receipt.output,
      );
      // Previous scope is deliberately captured as a historical input. Its generic drift is not application invalidity.
      assert.equal((await f.tracer.evidence.compareReceipt(result.receipt.id)).state, "changed");
      const next = await refreshRequest(f, opening, "second-refresh");
      await f.tracer.changeAssessments.refresh(next, actor);
      const again = await f.tracer.changeAssessments.get(selection);
      assert.equal(again.scope.candidates.length, 7);
      assert.deepEqual(again.scope.retained, view.scope.retained);
      const saved = await f.tracer.exportProject();
      f.base.reopen();
      assert.deepEqual(await f.tracer.changeAssessments.refresh(request, actor), result);
      assert.deepEqual(await f.tracer.changeAssessments.get(selection), again);
      assert.deepEqual(await f.tracer.exportProject(), saved);
      await assert.rejects(
        f.tracer.changeAssessments.refresh({ ...request, reason: "Changed intent" }, actor),
        { code: "conflict" },
      );
    } finally {
      f.close();
    }
  });

test("managed assessment reads reject authored closed/scope/model edits and forged opening results", async () => {
  const f = await applicationModelFixture();
  try {
    const opening = await assessmentOpenRequest(f),
      result = await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    const fields = f.definition.assessment.fields;
    let version = 1;
    for (const tamper of [
      { [fields.state]: f.definition.states.closed },
      { [fields.model]: { ...f.pin, version: 2 } },
      {
        [fields.scope]: {
          ...parseAssessmentScope(result.receipt.output.fields[fields.scope]),
          purpose: "Authored scope override",
        },
      },
    ]) {
      await f.tracer.updateEntity(
        opening.assessmentId,
        version++,
        { fields: { ...result.receipt.output.fields, ...tamper } },
        2,
        actor,
      );
      await assert.rejects(f.tracer.changeAssessments.get(selection), { code: "conflict" });
      await f.tracer.updateEntity(
        opening.assessmentId,
        version++,
        { fields: { ...result.receipt.output.fields, [fields.title]: "Allowed authored title" } },
        2,
        actor,
      );
    }
    const view = await f.tracer.changeAssessments.get(selection);
    assert.equal(view.assessment.title, "Allowed authored title");
    assert.equal(view.assessment.version, 7);
    assert.equal(view.control.assessmentVersion, 1);
    const forgedId = crypto.randomUUID();
    await f.tracer.evaluations.commit(
      {
        commandId: "forged-opening",
        expectedSchemaVersion: 2,
        operations: [
          {
            op: "entity.create",
            id: forgedId,
            input: { type: f.definition.assessment.type, fields: result.receipt.output.fields },
          },
        ],
        receipt: {
          outputId: forgedId,
          outcome: result.receipt.outcome,
          inputs: [{ entityId: f.profile.id, facet: "native" }],
        },
      },
      actor,
    );
    await assert.rejects(
      f.tracer.changeAssessments.get({
        assessmentId: forgedId,
        openingCommandId: "forged-opening",
      }),
      { code: "conflict" },
    );
    await assert.rejects(f.tracer.changeAssessments.get({ ...selection, assessmentId: forgedId }), {
      code: "conflict",
    });
    const request = await refreshRequest(f, opening);
    await f.tracer.changeAssessments.refresh(request, actor);
    assert.equal((await f.tracer.changeAssessments.get(selection)).assessment.version, 8);
  } finally {
    f.close();
  }
});

test("refresh rejects stale guards and retains a reusable command identity after rejection", async () => {
  const f = await applicationModelFixture();
  try {
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const request = await refreshRequest(f, opening),
      before = await f.tracer.exportProject();
    for (const [change, code] of [
      [{ expectedSchemaVersion: 99 }, "schema_conflict"],
      [{ expectedProjectRevision: 0 }, "conflict"],
      [{ expectedEvidenceRevision: 0 }, "conflict"],
      [{ expectedAssessmentVersion: 99 }, "conflict"],
      [{ reason: " " }, "validation"],
      [{ openingCommandId: "missing" }, "not_found"],
    ] as const) {
      await assert.rejects(f.tracer.changeAssessments.refresh({ ...request, ...change }, actor), {
        code,
      });
      assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
      assert.deepEqual(await f.tracer.exportProject(), before);
    }
    await f.tracer.changeAssessments.refresh(request, actor);
  } finally {
    f.close();
  }
});

test("refresh refuses an oversized union rather than deleting earlier obligations", async () => {
  const f = await applicationModelFixture();
  try {
    const create = async (prefix: string) => {
      const links: string[] = [];
      for (let index = 0; index < 6; index++) {
        const item = await f.tracer.createEntity(
          { type: f.model.article, fields: { title: prefix + index } },
          2,
          actor,
        );
        const link = await f.tracer.createRelationship(
          { type: f.model.allocation, source: f.criterion.id, target: item.id, fields: {} },
          2,
          actor,
        );
        links.push(link.id);
      }
      return links;
    };
    const old = await create("Original");
    const opening: OpenChangeAssessment = await assessmentOpenRequest(f);
    opening.query.relationshipTypes = [f.model.allocation];
    await f.tracer.changeAssessments.open(opening, actor);
    for (const id of old) await f.tracer.removeRelationship(id, 1, 2, actor);
    await create("New");
    const request = await refreshRequest(f, opening),
      before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.changeAssessments.refresh(request, actor), {
      code: "validation",
    });
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
  } finally {
    f.close();
  }
});

test("own-output receipts are excluded before pagination so assessment history cannot exhaust discovery", async () => {
  const f = await applicationModelFixture();
  try {
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    for (let i = 0; i < 26; i++)
      await f.tracer.evidence.recordReceipt(
        {
          outputId: opening.assessmentId,
          outcome: "Own source use " + i,
          inputs: [{ entityId: f.criterion.id, facet: "native" }],
        },
        actor,
      );
    const request = await refreshRequest(f, opening),
      before = await f.tracer.exportProject();
    const transact = f.repository.transaction.bind(f.repository);
    let examined = 0;
    f.repository.transaction = (work) =>
      transact(async (tx) => {
        const read = tx.impactReceipts;
        tx.impactReceipts = async (query) => {
          examined++;
          return read(query);
        };
        return work(tx);
      });
    await f.tracer.changeAssessments.refresh(request, actor);
    assert.equal(examined, 1);
    const view = await f.tracer.changeAssessments.get({
      assessmentId: opening.assessmentId,
      openingCommandId: opening.commandId,
    });
    assert.equal(view.scope.candidates.length, 1);
    assert.equal(before.projectRevision + 1, (await f.tracer.exportProject()).projectRevision);
  } finally {
    f.close();
  }
});

test("historical model remains readable while current-schema incompatibility blocks refresh", async () => {
  const f = await applicationModelFixture();
  try {
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const schema = structuredClone(f.schema);
    delete schema.relationshipTypes[f.definition.relationships.member];
    await f.tracer.setSchema(schema, 2, actor);
    const request = await refreshRequest(f, opening);
    const view = await f.tracer.changeAssessments.get({
      assessmentId: opening.assessmentId,
      openingCommandId: opening.commandId,
    });
    assert.equal(view.model.compatibility.writable, false);
    assert.deepEqual(view.model.definition, f.definition);
    const before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.changeAssessments.refresh(request, actor), {
      code: "validation",
    });
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});
