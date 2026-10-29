import test from "node:test";
import assert from "node:assert/strict";
import { captureReview } from "../src/application/review-capture.ts";
import { ensure } from "../src/core/model.ts";
import { compareCapturedInputs, comparisonToken } from "../src/application/receipt-comparison.ts";
import {
  verificationFixture,
  verificationActor as actor,
  verificationOpening,
  verificationExecution,
} from "./verification-fixture.ts";

test("composed Review capture shares guards and rolls back with its owning application transaction", async () => {
  const f = await verificationFixture();
  try {
    const opening = await verificationOpening(f);
    await f.tracer.verification.open(opening, actor);
    const request = await verificationExecution(f, {
      caseId: opening.caseId,
      openingCommandId: opening.commandId,
    });
    const execution = await f.tracer.verification.recordExecution(request, actor);
    const before = await f.tracer.exportProject();
    let allocated = 0;
    const id = () => `composed-review-${++allocated}`;
    await f.repository.transaction(async (tx) => {
      const comparison = await compareCapturedInputs(tx, execution.receipt);
      const input = {
        receiptId: execution.receipt.id,
        decision: "accepted" as const,
        rationale: "Synthetic judgment in a composed transaction",
        expectedComparison: "stale",
      };
      await assert.rejects(captureReview(tx, input, comparison, actor, id), { code: "conflict" });
      input.expectedComparison = comparisonToken(comparison);
      await assert.rejects(
        captureReview(tx, { ...input, receiptId: "different-receipt" }, comparison, actor, id),
        { code: "validation" },
      );
      const unknown = { ...comparison, hasUnknown: true, state: "unknown" as const };
      await assert.rejects(captureReview(tx, input, unknown, actor, id), {
        code: "validation",
        message: /unresolved unknown/,
      });
      assert.equal(allocated, 0);
    });
    await assert.rejects(
      f.repository.transaction(async (tx) => {
        const comparison = await compareCapturedInputs(tx, execution.receipt);
        const review = await captureReview(
          tx,
          {
            receiptId: execution.receipt.id,
            decision: "accepted",
            rationale: "Synthetic acceptance; the enclosing command will fail",
            expectedComparison: comparisonToken(comparison),
          },
          comparison,
          actor,
          id,
        );
        assert.equal((await tx.getEvidence("review", review.id))!.id, review.id);
        ensure(false, "validation", "later application validation fails");
      }),
      /later application validation fails/,
    );
    assert.equal(allocated, 1);
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal(
      (await f.tracer.evidence.compareReceipt(execution.receipt.id)).review.state,
      "unreviewed",
    );
  } finally {
    f.close();
  }
});
