import test from "node:test";
import assert from "node:assert/strict";
import {
  verificationFixture,
  verificationActor as actor,
  verificationOpening,
  verificationExecution,
  verificationResults,
  verificationMutation,
} from "./verification-fixture.ts";
import { verificationReceiptOrigin } from "../src/application/verification-receipt-origin.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: controlled failed and unexecuted scope cannot become passed through prior interpretation; performed replacement retains history`, async () => {
    const f = await verificationFixture(domain);
    try {
      const opening = await verificationOpening(f);
      await f.tracer.verification.open(opening, actor);
      const selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
      const failed = await verificationExecution(f, selection);
      failed.results[0].outcome = "failed";
      failed.results[1].outcome = "not_run";
      const original = await f.tracer.verification.recordExecution(failed, actor);
      const bad = await verificationExecution(f, selection);
      bad.source = {
        kind: "prior_receipt",
        receiptId: original.receipt.id,
        rationale: "Attempt a passing reinterpretation without a performed replacement",
      };
      const before = await f.tracer.exportProject();
      await assert.rejects(f.tracer.verification.recordExecution(bad, actor), {
        code: "validation",
        message: /passing controlled source coverage/,
      });
      assert.deepEqual(await f.tracer.exportProject(), before);
      assert.equal(await f.tracer.evaluations.getOutcome(bad.commandId), null);
      bad.source = { kind: "performed" };
      bad.conditions = {
        scope:
          "A separately performed synthetic replacement, not reinterpretation of failed source",
      };
      await f.tracer.verification.recordExecution(bad, actor);
      await f.tracer.verification.selectResults(
        await verificationResults(f, selection, bad.executionId, [failed.executionId]),
        actor,
      );
      await f.tracer.verification.conclude(await verificationMutation(f, selection), actor);
      const analysis = await f.tracer.verification.analyze(selection);
      assert.equal(analysis.completion.state, "verified");
      assert.deepEqual(
        analysis.executions[0].results.map((row) => row.outcome),
        ["failed", "not_run"],
      );
      assert.deepEqual(
        analysis.executions[1].results.map((row) => row.outcome),
        ["passed", "passed"],
      );
      assert.deepEqual(await f.tracer.evidence.getReceipt(original.receipt.id), original.receipt);
    } finally {
      f.close();
    }
  });

test("passing controlled source coverage supports explicit criterion regrouping, including whitespace between original criteria", async () => {
  const f = await verificationFixture();
  try {
    const first = await verificationOpening(f);
    await f.tracer.verification.open(first, actor);
    const firstSelection = { caseId: first.caseId, openingCommandId: first.commandId };
    const performed = await verificationExecution(f, firstSelection),
      source = await f.tracer.verification.recordExecution(performed, actor);
    const opening = await verificationOpening(f),
      field = f.definition.requirement.fields.acceptance[0],
      quote = String(f.requirement.fields[field]);
    opening.basis.criteria = [{ id: "COMBINED", field, start: 0, end: quote.length, quote }];
    opening.basis.methods[0].criterionIds = ["COMBINED"];
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
    const interpretation = await verificationExecution(f, selection);
    interpretation.source = {
      kind: "prior_receipt",
      receiptId: source.receipt.id,
      rationale:
        "Same governing text and method; explicitly regroup both original passing criteria",
    };
    const result = await f.tracer.verification.recordExecution(interpretation, actor);
    const origin = await f.repository.transaction((tx) =>
      verificationReceiptOrigin(tx, result.receipt),
    );
    assert.equal(origin!.data.source.kind, "prior_receipt");
    assert.equal(origin!.inputOffset, 5);
    assert.equal(origin!.basis.criteria[0].id, "COMBINED");
    f.reopen();
    const restored = await f.repository.transaction((tx) =>
      verificationReceiptOrigin(tx, result.receipt),
    );
    assert.deepEqual(restored!.data, origin!.data);
  } finally {
    f.close();
  }
});

test("a controlled source does not cover an unexecuted method assignment merely because it captured the whole requirement", async () => {
  const f = await verificationFixture();
  try {
    const first = await verificationOpening(f);
    first.basis.methods[0].criterionIds = ["AC-1"];
    await f.tracer.verification.open(first, actor);
    const original = await f.tracer.verification.recordExecution(
      await verificationExecution(f, { caseId: first.caseId, openingCommandId: first.commandId }),
      actor,
    );
    const next = await verificationOpening(f);
    await f.tracer.verification.open(next, actor);
    const selection = { caseId: next.caseId, openingCommandId: next.commandId },
      bad = await verificationExecution(f, selection);
    bad.source = {
      kind: "prior_receipt",
      receiptId: original.receipt.id,
      rationale: "Try to claim the unexecuted AC-2 from whole-requirement source metadata",
    };
    const before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.verification.recordExecution(bad, actor), {
      code: "validation",
      message: /passing controlled source coverage/,
    });
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});

test("controlled source method mapping identity cannot be reinterpreted through a different mapping", async () => {
  const f = await verificationFixture();
  try {
    const first = await verificationOpening(f);
    await f.tracer.verification.open(first, actor);
    const original = await f.tracer.verification.recordExecution(
      await verificationExecution(f, { caseId: first.caseId, openingCommandId: first.commandId }),
      actor,
    );
    const mapping = await f.tracer.createRelationship(
      {
        type: f.definition.relationships.requirementMethod,
        source: f.requirement.id,
        target: f.method.id,
        fields: {},
      },
      1,
      actor,
    );
    const next = await verificationOpening(f);
    next.basis.methods[0].relationship = { id: mapping.id, version: mapping.version };
    await f.tracer.verification.open(next, actor);
    const bad = await verificationExecution(f, {
      caseId: next.caseId,
      openingCommandId: next.commandId,
    });
    bad.source = {
      kind: "prior_receipt",
      receiptId: original.receipt.id,
      rationale: "Matching scalar text cannot substitute a different controlled method mapping",
    };
    await assert.rejects(f.tracer.verification.recordExecution(bad, actor), {
      code: "validation",
      message: /same requirement and method semantic scope/,
    });
  } finally {
    f.close();
  }
});

test("authored receipt labels and payloads do not acquire controlled execution authority", async () => {
  const f = await verificationFixture();
  try {
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "A raw report with no controlled result authority",
        inputs: [{ entityId: f.requirement.id }, { entityId: f.method.id }],
      },
      actor,
    );
    assert.equal(
      await f.repository.transaction((tx) => verificationReceiptOrigin(tx, receipt)),
      null,
    );
    const model = await f.tracer.verification.resolveModel(f.input.model);
    const other = await f.tracer.evaluations.commit(
      {
        commandId: "other-application-source",
        expectedSchemaVersion: model.context.schemaVersion,
        expectedProjectRevision: model.context.projectRevision,
        operations: [],
        receipt: {
          outputId: f.method.id,
          outcome: "Another application's atomic receipt is not a typed verification execution",
          inputs: [{ entityId: f.requirement.id }, { entityId: f.method.id }],
        },
      },
      actor,
    );
    assert.equal(
      await f.repository.transaction((tx) => verificationReceiptOrigin(tx, other.receipt)),
      null,
    );
    const opening = await verificationOpening(f);
    await f.tracer.verification.open(opening, actor);
    const input = await verificationExecution(f, {
      caseId: opening.caseId,
      openingCommandId: opening.commandId,
    });
    input.source = {
      kind: "prior_receipt",
      receiptId: receipt.id,
      rationale:
        "Explicit typed interpretation of raw supporting material, not outcome-string parsing",
    };
    const result = await f.tracer.verification.recordExecution(input, actor);
    assert.equal(
      (await f.repository.transaction((tx) => verificationReceiptOrigin(tx, result.receipt)))!.data
        .results[0].outcome,
      "passed",
    );
  } finally {
    f.close();
  }
});

test("controlled prior interpretation chains refuse beyond 25 inspected receipts without partial execution or reserved identity", async () => {
  const f = await verificationFixture();
  try {
    const opening = await verificationOpening(f);
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
    let source = await f.tracer.verification.recordExecution(
      await verificationExecution(f, selection),
      actor,
    );
    for (let i = 0; i < 25; i++) {
      const next = await verificationExecution(f, selection);
      next.source = {
        kind: "prior_receipt",
        receiptId: source.receipt.id,
        rationale: "Explicit bounded passing source interpretation",
      };
      source = await f.tracer.verification.recordExecution(next, actor);
    }
    const bad = await verificationExecution(f, selection);
    bad.source = {
      kind: "prior_receipt",
      receiptId: source.receipt.id,
      rationale: "One more source than the declared inspection bound",
    };
    const before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.verification.recordExecution(bad, actor), {
      code: "validation",
      message: /25 receipts/,
    });
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal(await f.tracer.evaluations.getOutcome(bad.commandId), null);
  } finally {
    f.close();
  }
});
