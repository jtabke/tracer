import test from "node:test";
import assert from "node:assert/strict";
import {
  verificationFixture,
  verificationOpening,
  verificationExecution,
  verificationActor as actor,
  verificationMutation as mutation,
  verificationResults as choose,
} from "./verification-fixture.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: explicit selection, immutable conclusion, drift, reopening and revised basis retain original outcomes`, async () => {
    const f = await verificationFixture(domain);
    try {
      const o = await verificationOpening(f);
      await f.tracer.verification.open(o, actor);
      const s = { caseId: o.caseId, openingCommandId: o.commandId },
        failure = await verificationExecution(f, s);
      failure.results[0].outcome = "failed";
      await f.tracer.verification.recordExecution(failure, actor);
      await f.tracer.verification.selectResults(await choose(f, s, failure.executionId), actor);
      let a = await f.tracer.verification.analyze(s);
      assert.equal(a.obligations[0].outcome, "failed");
      assert.equal(a.obligations[0].applicability, "current");
      assert.equal(a.ready, false);
      await assert.rejects(
        f.tracer.verification.conclude(await mutation(f, s), actor),
        /applicable passing/,
      );
      const pass = await verificationExecution(f, s);
      await f.tracer.verification.recordExecution(pass, actor);
      assert.equal((await f.tracer.verification.analyze(s)).selection.state, "incomplete");
      const picked = await choose(f, s, pass.executionId, [failure.executionId]);
      await f.tracer.verification.selectResults(picked, actor);
      a = await f.tracer.verification.analyze(s);
      assert.equal(a.ready, true);
      assert.equal(a.completion.state, "open");
      const close = await mutation(f, s),
        concluded = await f.tracer.verification.conclude(close, actor);
      a = await f.tracer.verification.analyze(s);
      assert.equal(a.completion.state, "verified");
      assert.equal(a.recordedConclusion?.commandId, close.commandId);
      const before = await f.tracer.exportProject();
      f.reopen();
      assert.deepEqual(await f.tracer.verification.conclude(close, actor), concluded);
      assert.deepEqual(await f.tracer.exportProject(), before);
      await assert.rejects(
        f.tracer.verification.recordExecution(await verificationExecution(f, s), actor),
        /Reopen/,
      );
      // A real semantic change requires explicit basis revision and new execution.
      const field = f.definition.requirement.fields.statement;
      await f.tracer.updateEntity(
        f.requirement.id,
        1,
        {
          fields: {
            ...f.requirement.fields,
            [field]: "Use the revised explicit engineering criterion and method",
          },
        },
        1,
        actor,
      );
      a = await f.tracer.verification.analyze(s);
      assert.equal(a.completion.state, "needs_reassessment");
      assert.equal(a.obligations[0].outcome, "passed");
      assert.equal(a.recordedConclusion?.commandId, close.commandId);
      await f.tracer.verification.reopen(await mutation(f, s), actor);
      const revised = structuredClone(f.input);
      revised.requirement.version = 2;
      const revision = {
        ...(await mutation(f, s)),
        basis: revised,
        mapping: revised.criteria.map((c) => ({ fromId: c.id, toId: c.id })),
      };
      await f.tracer.verification.reviseBasis(revision, actor);
      a = await f.tracer.verification.analyze(s);
      assert.equal(a.basis.state, "current");
      assert.equal(a.selection.state, "none");
      assert.equal(
        a.executions.find((x) => x.id === pass.executionId)?.eligibleCriterionIds.length,
        0,
      );
      await assert.rejects(
        f.tracer.verification.selectResults(
          await choose(f, s, pass.executionId, [failure.executionId]),
          actor,
        ),
        /semantic basis/,
      );
      const rerun = await verificationExecution(f, s);
      await f.tracer.verification.recordExecution(rerun, actor);
      await f.tracer.verification.selectResults(
        await choose(f, s, rerun.executionId, [failure.executionId, pass.executionId]),
        actor,
      );
      await f.tracer.verification.conclude(await mutation(f, s), actor);
      a = await f.tracer.verification.analyze(s);
      assert.equal(a.completion.state, "verified");
      assert.equal(a.executions.length, 3);
      assert.equal(
        (await f.tracer.verification.execution(s, failure.executionId)).data.results[0].outcome,
        "failed",
      );
      assert.deepEqual(await f.tracer.evidence.getReceipt(concluded.receipt.id), concluded.receipt);
    } finally {
      f.close();
    }
  });

test("new results and stale guards cannot bypass complete accounting or reserve rejected command identities", async () => {
  const f = await verificationFixture();
  try {
    const o = await verificationOpening(f);
    await f.tracer.verification.open(o, actor);
    const s = { caseId: o.caseId, openingCommandId: o.commandId };
    const pass = await verificationExecution(f, s);
    await f.tracer.verification.recordExecution(pass, actor);
    const choice = await choose(f, s, pass.executionId),
      before = await f.tracer.exportProject();
    for (const request of [
      { ...choice, accounting: [] },
      { ...choice, selections: [choice.selections[0], choice.selections[0]] },
      { ...choice, expectedAnalysisDigest: "sha256:" + "0".repeat(64) },
      { ...choice, expectedEvidenceRevision: choice.expectedEvidenceRevision - 1 },
    ]) {
      await assert.rejects(f.tracer.verification.selectResults(request, actor));
      assert.deepEqual(await f.tracer.exportProject(), before);
      assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
    }
    await f.tracer.verification.selectResults(choice, actor);
    const close = await mutation(f, s),
      failure = await verificationExecution(f, s);
    failure.results[0].outcome = "failed";
    await f.tracer.verification.recordExecution(failure, actor);
    await assert.rejects(f.tracer.verification.conclude(close, actor));
    const a = await f.tracer.verification.analyze(s);
    assert.equal(a.selection.state, "incomplete");
    assert.deepEqual(a.selection.unassessedExecutionIds, [failure.executionId]);
    await assert.rejects(
      f.tracer.verification.conclude(await mutation(f, s), actor),
      /selection is incomplete/,
    );
  } finally {
    f.close();
  }
});

test("unselected historical support drift does not retire a chosen current result; selected support drift does", async () => {
  const f = await verificationFixture();
  try {
    const material = await f.tracer.createEntity(
      { type: "@resource", fields: { value: 1 }, resource: { label: "Candidate" } },
      1,
      actor,
    );
    const o = await verificationOpening(f);
    await f.tracer.verification.open(o, actor);
    const s = { caseId: o.caseId, openingCommandId: o.commandId };
    const old = await verificationExecution(f, s);
    old.inputs = [{ entityId: material.id, facet: "native", revision: 1, fields: ["value"] }];
    old.results[0].outcome = "failed";
    await f.tracer.verification.recordExecution(old, actor);
    const pass = await verificationExecution(f, s);
    await f.tracer.verification.recordExecution(pass, actor);
    await f.tracer.verification.selectResults(
      await choose(f, s, pass.executionId, [old.executionId]),
      actor,
    );
    await f.tracer.verification.conclude(await mutation(f, s), actor);
    await f.tracer.updateEntity(material.id, 1, { fields: { value: 2 } }, 1, actor);
    let a = await f.tracer.verification.analyze(s);
    assert.equal(a.executions[0].support.changed, true);
    assert.equal(a.completion.state, "verified");
    await f.tracer.verification.reopen(await mutation(f, s), actor);
    const current = await verificationExecution(f, s);
    current.inputs = [{ entityId: material.id, facet: "native", revision: 2, fields: ["value"] }];
    await f.tracer.verification.recordExecution(current, actor);
    await f.tracer.verification.selectResults(
      await choose(f, s, current.executionId, [old.executionId, pass.executionId]),
      actor,
    );
    await f.tracer.verification.conclude(await mutation(f, s), actor);
    await f.tracer.updateEntity(material.id, 2, { fields: { value: 3 } }, 1, actor);
    a = await f.tracer.verification.analyze(s);
    assert.equal(a.completion.state, "needs_reassessment");
    assert.equal(a.obligations[0].outcome, "passed");
    assert.equal(a.obligations[0].applicability, "changed");
  } finally {
    f.close();
  }
});

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: assessed design drift obeys pinned policy, unknown inputs and explicit reevaluation remain blocking`, async () => {
    const f = await verificationFixture(domain);
    try {
      const material = await f.tracer.createEntity(
        { type: "@resource", fields: { value: 1 }, resource: { label: "Design input" } },
        1,
        actor,
      );
      const o = await verificationOpening(f);
      await f.tracer.verification.open(o, actor);
      const s = { caseId: o.caseId, openingCommandId: o.commandId };
      const run = await verificationExecution(f, s);
      run.inputs = [{ entityId: material.id, facet: "native", revision: 1, fields: ["value"] }];
      const recorded = await f.tracer.verification.recordExecution(run, actor);
      await f.tracer.updateEntity(material.id, 1, { fields: { value: 2 } }, 1, actor);
      let comparison = await f.tracer.evidence.compareReceipt(recorded.receipt.id);
      await f.tracer.evidence.review(
        {
          receiptId: recorded.receipt.id,
          decision: "accepted",
          rationale: "Declared method remains applicable to this exact revised design state",
          expectedComparison: comparison.token,
        },
        actor,
      );
      await f.tracer.verification.selectResults(await choose(f, s, run.executionId), actor);
      let a = await f.tracer.verification.analyze(s);
      assert.equal(a.ready, domain === "research");
      assert.equal(a.obligations[0].applicability, domain === "research" ? "assessed" : "changed");
      comparison = await f.tracer.evidence.compareReceipt(recorded.receipt.id);
      await f.tracer.evidence.review(
        {
          receiptId: recorded.receipt.id,
          decision: "needs_reevaluation",
          rationale: "Explicit rerun required despite previous scoped acceptance",
          expectedComparison: comparison.token,
        },
        actor,
      );
      a = await f.tracer.verification.analyze(s);
      assert.equal(a.ready, false);
      assert.equal(a.executions[0].support.reviewRequired, true);
      await f.tracer.removeEntity(material.id, 2, 1, actor);
      await f.tracer.verification.selectResults(await choose(f, s, run.executionId), actor);
      a = await f.tracer.verification.analyze(s);
      assert.equal(a.obligations[0].applicability, "unknown");
      assert.equal(a.ready, false);
      assert.ok(JSON.stringify(a.recordedSelection?.facts).includes('"kind":"entity"'));
    } finally {
      f.close();
    }
  });

test("partial source and unassigned criteria remain blockers even with explicit passing selections", async () => {
  const f = await verificationFixture();
  try {
    const o = await verificationOpening(f);
    o.basis.coverage.kind = "partial";
    o.basis.methods[0].criterionIds = ["AC-1"];
    await f.tracer.verification.open(o, actor);
    const s = { caseId: o.caseId, openingCommandId: o.commandId },
      run = await verificationExecution(f, s);
    await f.tracer.verification.recordExecution(run, actor);
    await f.tracer.verification.selectResults(await choose(f, s, run.executionId), actor);
    const a = await f.tracer.verification.analyze(s);
    assert.equal(a.ready, false);
    assert.ok(a.blockers.includes("Source coverage is explicitly partial"));
    assert.ok(a.blockers.includes("Some criteria have no assigned method"));
    await assert.rejects(f.tracer.verification.conclude(await mutation(f, s), actor));
  } finally {
    f.close();
  }
});

test("basis mapping preserves unchanged criterion meaning while changed clauses require new execution", async () => {
  const f = await verificationFixture();
  try {
    const o = await verificationOpening(f);
    await f.tracer.verification.open(o, actor);
    const s = { caseId: o.caseId, openingCommandId: o.commandId };
    const run = await verificationExecution(f, s);
    await f.tracer.verification.recordExecution(run, actor);
    const revised = structuredClone(f.input),
      field = f.definition.requirement.fields.acceptance[0],
      first = revised.criteria[0],
      second = revised.criteria[1];
    const text = first.quote + " " + second.quote + " Explain uncertainty.";
    await f.tracer.updateEntity(
      f.requirement.id,
      1,
      { fields: { ...f.requirement.fields, [field]: text } },
      1,
      actor,
    );
    revised.requirement.version = 2;
    second.id = "AC-2-revised";
    second.quote += " Explain uncertainty.";
    second.end = text.length;
    revised.methods[0].criterionIds = ["AC-1", second.id];
    const request = {
      ...(await mutation(f, s)),
      basis: revised,
      mapping: [
        { fromId: "AC-1", toId: "AC-1" },
        { fromId: "AC-2", toId: second.id },
      ],
    };
    const before = await f.tracer.exportProject();
    for (const mapping of [
      request.mapping.slice(1),
      [request.mapping[0], request.mapping[0]],
      request.mapping.map((x) => ({ ...x, toId: "missing" })),
    ]) {
      await assert.rejects(f.tracer.verification.reviseBasis({ ...request, mapping }, actor));
      assert.deepEqual(await f.tracer.exportProject(), before);
    }
    await f.tracer.verification.reviseBasis(request, actor);
    let a = await f.tracer.verification.analyze(s);
    assert.deepEqual(a.executions[0].eligibleCriterionIds, ["AC-1"]);
    const rerun = await verificationExecution(f, s);
    await f.tracer.verification.recordExecution(rerun, actor);
    const selection = await choose(f, s, rerun.executionId);
    selection.selections[0].executionId = run.executionId;
    selection.accounting.push({
      executionId: run.executionId,
      decision: "selected",
      rationale: "Unchanged criterion and method; explicit native mapping retains this execution",
    });
    await f.tracer.verification.selectResults(selection, actor);
    await f.tracer.verification.conclude(await mutation(f, s), actor);
    a = await f.tracer.verification.analyze(s);
    assert.equal(a.completion.state, "verified");
  } finally {
    f.close();
  }
});

test("self-referential selection support and post-capture conclusion failure roll back all state and command recovery", async () => {
  const f = await verificationFixture();
  try {
    const o = await verificationOpening(f);
    await f.tracer.verification.open(o, actor);
    const s = { caseId: o.caseId, openingCommandId: o.commandId };
    const run = await verificationExecution(f, s);
    run.inputs = [
      {
        entityId: o.caseId,
        facet: "native",
        revision: 1,
        fields: [f.definition.case.fields.selection],
      },
    ];
    await f.tracer.verification.recordExecution(run, actor);
    const pick = await choose(f, s, run.executionId),
      before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.verification.selectResults(pick, actor), /changes its own/);
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal(await f.tracer.evaluations.getOutcome(pick.commandId), null);
    const pass = await verificationExecution(f, s);
    await f.tracer.verification.recordExecution(pass, actor);
    await f.tracer.verification.selectResults(
      await choose(f, s, pass.executionId, [run.executionId]),
      actor,
    );
    const close = await mutation(f, s),
      saved = await f.tracer.exportProject(),
      transaction = f.repository.transaction.bind(f.repository);
    let fail = true;
    f.repository.transaction = (work) =>
      transaction((tx) =>
        work({
          ...tx,
          appendEvaluationCommand: async (...args) => {
            await tx.appendEvaluationCommand(...args);
            if (fail) throw Error("Injected post-journal failure");
          },
        }),
      );
    await assert.rejects(f.tracer.verification.conclude(close, actor), { code: "storage" });
    fail = false;
    assert.deepEqual(await f.tracer.exportProject(), saved);
    assert.equal(await f.tracer.evaluations.getOutcome(close.commandId), null);
    await f.tracer.verification.conclude(close, actor);
    assert.equal((await f.tracer.verification.analyze(s)).completion.state, "verified");
  } finally {
    f.close();
  }
});

test("superseded selected receipt cannot establish current verification and missing membership retains historical outcomes", async () => {
  const f = await verificationFixture();
  try {
    const o = await verificationOpening(f);
    await f.tracer.verification.open(o, actor);
    const s = { caseId: o.caseId, openingCommandId: o.commandId };
    const run = await verificationExecution(f, s),
      recorded = await f.tracer.verification.recordExecution(run, actor);
    await f.tracer.evidence.recordReceipt(
      {
        outputId: run.executionId,
        outcome: "A distinct receipt explicitly replaces this result",
        inputs: [{ entityId: f.requirement.id, facet: "native", revision: 1 }],
        supersedes: recorded.receipt.id,
      },
      actor,
    );
    await f.tracer.verification.selectResults(await choose(f, s, run.executionId), actor);
    let a = await f.tracer.verification.analyze(s);
    assert.equal(a.obligations[0].outcome, "passed");
    assert.equal(a.obligations[0].applicability, "superseded");
    assert.equal(a.ready, false);
    await f.tracer.removeRelationship(run.membershipId, 1, 1, actor);
    a = await f.tracer.verification.analyze(s);
    assert.equal(a.obligations[0].applicability, "unavailable");
    await assert.rejects(f.tracer.verification.conclude(await mutation(f, s), actor));
    assert.equal(
      (await f.tracer.verification.execution(s, run.executionId)).data.results[0].outcome,
      "passed",
    );
  } finally {
    f.close();
  }
});

test("bounded 100-execution population is complete, read-only and explicitly accounted; overflow rejects atomically", async (t) => {
  const f = await verificationFixture();
  try {
    const o = await verificationOpening(f);
    await f.tracer.verification.open(o, actor);
    const s = { caseId: o.caseId, openingCommandId: o.commandId },
      ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      const run = await verificationExecution(f, s);
      await f.tracer.verification.recordExecution(run, actor);
      ids.push(run.executionId);
    }
    const before = await f.tracer.exportProject(),
      start = performance.now(),
      a = await f.tracer.verification.analyze(s),
      elapsed = performance.now() - start;
    assert.equal(a.executions.length, 100);
    assert.equal(a.selection.unassessedExecutionIds.length, 100);
    assert.equal(a.ready, false);
    assert.deepEqual(await f.tracer.exportProject(), before);
    const overflow = await verificationExecution(f, s);
    await assert.rejects(f.tracer.verification.recordExecution(overflow, actor));
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal(await f.tracer.evaluations.getOutcome(overflow.commandId), null);
    await f.tracer.verification.selectResults(await choose(f, s, ids[99], ids.slice(0, 99)), actor);
    await f.tracer.verification.conclude(await mutation(f, s), actor);
    assert.equal((await f.tracer.verification.analyze(s)).completion.state, "verified");
    t.diagnostic(
      JSON.stringify({
        synthetic: true,
        executions: 100,
        analysisMs: Math.round(elapsed),
        responseBytes: Buffer.byteLength(JSON.stringify(a)),
        complete: true,
      }),
    );
  } finally {
    f.close();
  }
});

test("unrelated native annotation edits retain current scoped verification without replacing the original conclusion", async () => {
  const f = await verificationFixture();
  try {
    const o = await verificationOpening(f);
    await f.tracer.verification.open(o, actor);
    const s = { caseId: o.caseId, openingCommandId: o.commandId };
    const run = await verificationExecution(f, s);
    await f.tracer.verification.recordExecution(run, actor);
    await f.tracer.verification.selectResults(await choose(f, s, run.executionId), actor);
    const closed = await f.tracer.verification.conclude(await mutation(f, s), actor),
      before = await f.tracer.verification.analyze(s);
    const snapshot = await f.tracer.getProjectSnapshot();
    for (const [id, title] of [
      [f.requirement.id, f.definition.requirement.fields.title],
      [f.method.id, f.definition.method.fields.title],
      [run.executionId, f.definition.execution.fields.title],
      [o.caseId, f.definition.case.fields.title],
    ] as const) {
      const entity = snapshot.entities.find((x) => x.id === id)!;
      await f.tracer.updateEntity(
        id,
        entity.version,
        { fields: { ...entity.fields, [title]: "Updated display annotation" } },
        1,
        actor,
      );
    }
    const after = await f.tracer.verification.analyze(s);
    assert.equal(after.completion.state, "verified");
    assert.equal(after.basis.digest, before.basis.digest);
    assert.equal(after.selection.evidenceDigest, before.selection.evidenceDigest);
    assert.equal(after.recordedConclusion?.commandId, closed.commandId);
    assert.deepEqual(await f.tracer.evidence.getReceipt(closed.receipt.id), closed.receipt);
  } finally {
    f.close();
  }
});
