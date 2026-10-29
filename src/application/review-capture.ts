import { ensure, json, record } from "../core/model.ts";
import type { Provenance } from "../core/model.ts";
import type { ComparedState, Review, ReviewInput, ReviewQualification } from "../core/evidence.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import type { Transaction } from "./ports/repository.ts";
import { evidenceText } from "./evidence-validation.ts";
import { comparisonToken } from "./receipt-comparison.ts";

export function prepareReview(input: ReviewInput): ReviewInput {
  input = snapshotInput(input);
  ensure(
    record(input) &&
      json(input) &&
      ["accepted", "acknowledged", "needs_reevaluation"].includes(input.decision),
    "validation",
    "Invalid review decision",
  );
  evidenceText(input.receiptId, "Receipt ID");
  evidenceText(input.rationale, "Review rationale");
  evidenceText(input.expectedComparison, "Expected comparison");
  return input;
}

/** Existing Review primitive, composable inside an application's atomic transaction. */
export async function captureReview(
  tx: Transaction,
  input: ReviewInput,
  comparison: ComparedState,
  actor: Provenance,
  newId: () => string,
  context?: { qualification: ReviewQualification; token: string },
): Promise<Review> {
  input = prepareReview(input);
  const token = context?.token ?? comparisonToken(comparison);
  if (context) {
    evidenceText(token, "Qualified comparison token");
    for (const key of ["ownerId", "contract", "basisDigest"] as const)
      evidenceText(context.qualification[key], "Review qualification " + key);
    ensure(
      Number.isSafeInteger(context.qualification.version) && context.qualification.version > 0,
      "validation",
      "Review qualification needs a positive contract version",
    );
  }
  ensure(
    input.receiptId === comparison.receiptId,
    "validation",
    "Review comparison receipt mismatch",
  );
  ensure(
    token === input.expectedComparison,
    "conflict",
    "Inputs changed since comparison; compare again before reviewing",
  );
  ensure(
    input.decision !== "accepted" || !comparison.hasUnknown,
    "validation",
    "Cannot accept unresolved unknown inputs; acknowledge or request reevaluation",
  );
  const value: Review = {
    ...actor,
    ...(context ? { qualification: snapshotInput(context.qualification) } : {}),
    id: newId(),
    at: new Date().toISOString(),
    receiptId: input.receiptId,
    decision: input.decision,
    rationale: input.rationale,
    comparison,
    token,
  };
  await tx.appendEvidence("review", input.receiptId, value);
  return value;
}
