import { ensure } from "../core/model.ts";
import type { Receipt } from "../core/evidence.ts";
import { workRecord, type WorkEvidence, type WorkQueue } from "../core/next-work.ts";
import type { Transaction } from "./ports/repository.ts";
import { compareReceiptState } from "./receipt-comparison.ts";
import { workByteBudget } from "./next-work-budget.ts";

export async function evidenceWork(tx: Transaction) {
  const receipts = await recordedReceipts(tx);
  const superseded = new Set(
    receipts.flatMap((receipt) => (receipt.supersedes ? [receipt.supersedes] : [])),
  );
  const current = receipts.filter((receipt) => !superseded.has(receipt.id));
  const changedEvidence: WorkQueue<WorkEvidence> = {
    available: true,
    explanation:
      "Non-superseded results with a confirmed difference in declared input content or dependency links. Unknown alone is not a confirmed change. Decisions do not clear drift; outcomes remain separate.",
    evaluated: current.length,
    items: [],
  };
  const reviews: WorkQueue<WorkEvidence> = {
    available: true,
    explanation:
      "Non-superseded results with no applicable review, or a current Needs reevaluation decision. Applicable Accepted and Acknowledged decisions resolve this review queue only.",
    evaluated: current.length,
    items: [],
  };
  const account = workByteBudget();
  for (const receipt of current) {
    const comparison = await compareReceiptState(tx, receipt);
    const row: WorkEvidence = {
      receiptId: receipt.id,
      output: workRecord(receipt.output),
      outcome: receipt.outcome,
      changedInputs: comparison.inputs.filter((input) => input.hasChanged).length,
      unknownInputs: comparison.inputs.filter((input) => input.hasUnknown).length,
      reviewState: comparison.review.state,
      reviewReason: reviewReason(comparison.review),
    };
    if (comparison.hasChanged) {
      account(row);
      changedEvidence.items.push(row);
    }
    if (["unreviewed", "needs_reevaluation"].includes(comparison.review.state)) {
      account(row);
      reviews.items.push(row);
    }
  }
  return { changedEvidence, reviews };
}
function reviewReason(review: Awaited<ReturnType<typeof compareReceiptState>>["review"]) {
  if (review.decision) return `${review.state}: ${review.decision.rationale}`;
  return review.previous
    ? `Previous ${review.previous.decision} decision no longer applies to these input versions.`
    : "No review has been recorded for these input versions.";
}
async function recordedReceipts(tx: Transaction) {
  const receipts: Receipt[] = [];
  const account = workByteBudget(32);
  let after: string | undefined,
    inputs = 0,
    links = 0;
  do {
    const page = await tx.evidence("receipt", { after, limit: 100 });
    account(page.items);
    for (const receipt of page.items) {
      inputs += receipt.inputs.length + (receipt.relationshipInputs?.length ?? 0);
      links += receipt.inputs.reduce((sum, input) => sum + input.links.length, 0);
      receipts.push(receipt);
    }
    ensure(
      receipts.length <= 2000 && inputs <= 10_000 && links <= 20_000,
      "validation",
      "Next work exceeds 2,000 recorded results, 10,000 declared inputs or 20,000 dependency links; no partial queues were returned. Use paged evidence queries for this project.",
    );
    after = page.nextAfter;
  } while (after !== undefined);
  return receipts;
}
