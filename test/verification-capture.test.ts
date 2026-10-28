import test from "node:test";
import assert from "node:assert/strict";
import {
  verificationFixture,
  verificationOpening,
  verificationExecution,
  verificationActor as actor,
} from "./verification-fixture.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: controlled verification opening/execution preserve exact native basis, registry and original recovery`, async () => {
    const f = await verificationFixture(domain);
    try {
      const opening = await verificationOpening(f),
        opened = await f.tracer.verification.open(opening, actor),
        selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
      assert.equal(opened.native?.results.length, 2);
      assert.equal(opened.receipt.output.version, 1);
      assert.deepEqual(
        await f.tracer.verification.locate(opening.caseId),
        await f.tracer.verification.get(selection),
      );
      const first = await verificationExecution(f, selection);
      first.results[0].outcome = "failed";
      const recorded = await f.tracer.verification.recordExecution(first, actor),
        view = await f.tracer.verification.get(selection);
      assert.equal(recorded.native?.results.length, 3);
      assert.equal(view.case.version, 2);
      assert.equal(view.executions.length, 1);
      const detail = await f.tracer.verification.execution(selection, first.executionId);
      assert.equal(detail.data.results[0].outcome, "failed");
      assert.equal(detail.comparison.record.state, "current");
      assert.equal(detail.comparison.source, null);
      assert.equal(detail.data.basisVersion, 1);
      assert.equal(detail.membership.current, true);
      const second = await verificationExecution(f, selection);
      await f.tracer.verification.recordExecution(second, actor);
      assert.equal((await f.tracer.verification.get(selection)).executions.length, 2);
      assert.equal(
        (await f.tracer.verification.execution(selection, first.executionId)).data.results[0]
          .outcome,
        "failed",
      );
      const saved = await f.tracer.exportProject();
      f.reopen();
      assert.deepEqual(await f.tracer.verification.open(opening, actor), opened);
      assert.deepEqual(await f.tracer.verification.recordExecution(first, actor), recorded);
      assert.deepEqual(await f.tracer.exportProject(), saved);
      await assert.rejects(
        f.tracer.verification.recordExecution({ ...first, title: "Changed intent" }, actor),
        { code: "conflict" },
      );
      assert.equal(
        (await f.tracer.verification.get(selection)).case.state,
        f.definition.states.open,
      );
      assert.equal(
        saved.current.entities.find((x) => x.id === opening.caseId)?.fields[
          f.definition.case.fields.conclusion
        ],
        null,
      );
    } finally {
      f.close();
    }
  });

test("verification rejects stale/partial/forged execution proposals without reserving command or native identity", async () => {
  const f = await verificationFixture();
  try {
    const opening = await verificationOpening(f);
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
      valid = await verificationExecution(f, selection),
      before = await f.tracer.exportProject();
    const partial = structuredClone(valid);
    partial.results.pop();
    const duplicate = structuredClone(valid);
    duplicate.results[1].criterionId = duplicate.results[0].criterionId;
    const forged = structuredClone(valid);
    forged.additionalFields[f.definition.execution.fields.data] = { claim: "passed" };
    const stale = { ...valid, expectedEvidenceRevision: valid.expectedEvidenceRevision - 1 };
    for (const request of [partial, duplicate, forged, stale]) {
      await assert.rejects(f.tracer.verification.recordExecution(request, actor));
      assert.equal(await f.tracer.evaluations.getOutcome(valid.commandId), null);
      assert.deepEqual(await f.tracer.exportProject(), before);
    }
    await f.tracer.verification.recordExecution(valid, actor);
    assert.ok(await f.tracer.evaluations.getOutcome(valid.commandId));
  } finally {
    f.close();
  }
});

test("prior receipt attestation retains original source drift separately from current interpretation inputs", async () => {
  const f = await verificationFixture();
  try {
    const material = await f.tracer.createEntity(
      { type: "@resource", fields: { reading: 1 }, resource: { label: "Earlier measurement" } },
      1,
      actor,
    );
    const prior = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "Prose cannot establish typed criterion results",
        inputs: [
          {
            entityId: f.requirement.id,
            facet: "native",
            revision: 1,
            fields: [
              f.definition.requirement.fields.statement,
              ...f.definition.requirement.fields.acceptance,
            ],
          },
          {
            entityId: f.method.id,
            facet: "native",
            revision: 1,
            fields: [f.definition.method.fields.procedure, f.definition.method.fields.expected],
          },
          { entityId: material.id, facet: "native", revision: 1, fields: ["reading"] },
        ],
      },
      actor,
    );
    const opening = await verificationOpening(f);
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
      request = await verificationExecution(f, selection);
    request.source = {
      kind: "prior_receipt",
      receiptId: prior.id,
      rationale:
        "Explicitly attest the original activity and its criterion-level result; not a new execution",
    };
    request.results[0].outcome = "failed";
    await f.tracer.verification.recordExecution(request, actor);
    const initial = await f.tracer.verification.execution(selection, request.executionId);
    assert.equal(initial.data.source.recordedAt, prior.at);
    assert.equal(initial.data.source.actor, prior.actor);
    await f.tracer.updateEntity(material.id, 1, { fields: { reading: 2 } }, 1, actor);
    const changed = await f.tracer.verification.execution(selection, request.executionId);
    assert.equal(changed.comparison.record.state, "current");
    assert.equal(changed.comparison.source?.state, "changed");
    assert.equal(changed.data.results[0].outcome, "failed");
    await f.tracer.removeEntity(material.id, 2, 1, actor);
    assert.equal(
      (await f.tracer.verification.execution(selection, request.executionId)).comparison.source
        ?.hasUnknown,
      true,
    );
    assert.deepEqual(await f.tracer.evidence.getReceipt(prior.id), prior);
  } finally {
    f.close();
  }
});

test("case/result JSON and generic receipts cannot forge controlled verification ownership", async () => {
  const f = await verificationFixture();
  try {
    const opening = await verificationOpening(f);
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
      view = await f.tracer.verification.get(selection),
      schema = await f.tracer.getProjectSnapshot();
    const current = schema.entities.find((x) => x.id === opening.caseId)!;
    await f.tracer.updateEntity(
      current.id,
      current.version,
      {
        fields: { ...current.fields, [f.definition.case.fields.state]: f.definition.states.closed },
      },
      1,
      actor,
    );
    await assert.rejects(f.tracer.verification.get(selection), { code: "conflict" });
    assert.equal(
      (await f.tracer.evidence.getReceipt(view.opening.receiptId)).output.fields[
        f.definition.case.fields.state
      ],
      f.definition.states.open,
    );
  } finally {
    f.close();
  }
});

test("execution response overflow rolls back native results, receipt, dependency index and recovery journal", async () => {
  const f = await verificationFixture();
  try {
    const material = await f.tracer.createEntity(
      {
        type: "@resource",
        fields: { blob: "x".repeat(600000) },
        resource: { label: "Large supporting snapshot" },
      },
      1,
      actor,
    );
    const opening = await verificationOpening(f);
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
      request = await verificationExecution(f, selection),
      before = await f.tracer.exportProject();
    request.inputs = [{ entityId: material.id, facet: "native", revision: 1 }];
    await assert.rejects(
      f.tracer.verification.recordExecution(request, actor),
      /response byte budget/,
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
    request.inputs = [];
    await f.tracer.verification.recordExecution(request, actor);
  } finally {
    f.close();
  }
});

test("a post-capture storage failure rolls back the complete controlled command and permits exact identity reuse", async () => {
  const f = await verificationFixture();
  try {
    const opening = await verificationOpening(f);
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
    const request = await verificationExecution(f, selection),
      before = await f.tracer.exportProject();
    const transaction = f.repository.transaction.bind(f.repository);
    let fail = true;
    f.repository.transaction = (work) =>
      transaction((tx) =>
        work({
          ...tx,
          impactSupersession: async (id) => {
            if (fail) throw Error("Post-capture read unavailable");
            return tx.impactSupersession(id);
          },
        }),
      );
    await assert.rejects(f.tracer.verification.recordExecution(request, actor));
    fail = false;
    assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
    assert.deepEqual(await f.tracer.exportProject(), before);
    await f.tracer.verification.recordExecution(request, actor);
    assert.ok(await f.tracer.evaluations.getOutcome(request.commandId));
  } finally {
    f.close();
  }
});

test("removed execution membership/output retains historical results without claiming current availability", async () => {
  const f = await verificationFixture();
  try {
    const opening = await verificationOpening(f);
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
    const request = await verificationExecution(f, selection),
      recorded = await f.tracer.verification.recordExecution(request, actor);
    await f.tracer.removeRelationship(request.membershipId, 1, 1, actor);
    await f.tracer.removeEntity(request.executionId, 1, 1, actor);
    const detail = await f.tracer.verification.execution(selection, request.executionId);
    assert.equal(detail.execution.currentVersion, null);
    assert.equal(detail.membership.current, false);
    assert.equal(detail.comparison.record.hasUnknown, true);
    assert.equal(detail.data.results[0].outcome, "passed");
    assert.deepEqual(await f.tracer.evidence.getReceipt(recorded.receipt.id), recorded.receipt);
  } finally {
    f.close();
  }
});

test("prior source without the exact requirement/method declarations cannot acquire execution authority", async () => {
  const f = await verificationFixture();
  try {
    const prior = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "PASS in prose",
        inputs: [
          {
            entityId: f.requirement.id,
            facet: "native",
            revision: 1,
            fields: [f.definition.requirement.fields.title],
          },
        ],
      },
      actor,
    );
    const opening = await verificationOpening(f);
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
    const request = await verificationExecution(f, selection),
      before = await f.tracer.exportProject();
    request.source = {
      kind: "prior_receipt",
      receiptId: prior.id,
      rationale: "Attempt to use unrelated prose as criterion evidence",
    };
    await assert.rejects(
      f.tracer.verification.recordExecution(request, actor),
      /explicitly capture/,
    );
    assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});
