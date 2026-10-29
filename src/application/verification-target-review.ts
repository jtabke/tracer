import { ensure, record } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type { ComparedState, Review } from "../core/evidence.ts";
import type { VerificationCaseView, VerificationTargetSupport } from "../core/verification-case.ts";
import { verificationBytes } from "../core/verification-case-validation.ts";
import { comparisonToken, reviewState } from "./receipt-comparison.ts";
import { factDigest } from "./fact-digest.ts";
import type { Transaction } from "./ports/repository.ts";

export type TargetSupportContext = {
  executionId: string;
  basisDigest: string;
  layers?: VerificationTargetSupport["layers"];
};
async function authenticatedReview(
  tx: Transaction,
  view: VerificationCaseView,
  context: TargetSupportContext,
  review: Review,
  token: (comparison: ComparedState) => Promise<string>,
  account: (value: unknown) => void,
) {
  account(review);
  verificationBytes(review, 1048576);
  const command = await tx.getEvaluationCommand(review.id);
  ensure(command, "storage", "Qualified verification review has no durable command origin");
  account(command);
  verificationBytes(command, 1048576);
  const intent: unknown = JSON.parse(command.intent);
  ensure(record(intent) && record(intent.input), "storage", "Invalid qualified review origin");
  const input = intent.input;
  ensure(
    intent.operation === "verification.review_support" &&
      input.caseId === view.case.id &&
      input.openingCommandId === view.opening.commandId &&
      input.executionId === context.executionId &&
      input.receiptId === review.receiptId &&
      input.commandId === review.id &&
      input.decision === review.decision &&
      input.reason === review.rationale &&
      input.expectedComparison === review.token &&
      canonical(intent.provenance) ===
        canonical({
          actor: review.actor,
          ...(review.reason === undefined ? {} : { reason: review.reason }),
        }) &&
      command.result.commandId === review.id &&
      command.result.native === null &&
      command.result.receipt.output.id === view.case.id &&
      review.token === (await token(review.comparison)),
    "storage",
    "Qualified verification review differs from its authenticated command",
  );
}
/** Shared semantic context for authoring, case analysis and complete support inspection. */
export async function targetSupportReview(
  tx: Transaction,
  view: VerificationCaseView,
  comparison: ComparedState,
  context: TargetSupportContext,
  account: (value: unknown) => void,
) {
  ensure(view.scope.target, "validation", "Qualified support review requires an explicit target");
  const basis = {
    contract: "verification_target_support",
    version: 1,
    caseId: view.case.id,
    openingCommandId: view.opening.commandId,
    executionId: context.executionId,
    target: view.scope.target,
    basisDigest: context.basisDigest,
  };
  const qualification = {
    ownerId: view.case.id,
    contract: basis.contract,
    version: basis.version,
    basisDigest: await factDigest(basis),
  };
  const tokenFor = (value: ComparedState) =>
    factDigest({ ...basis, comparison: comparisonToken(value) });
  const token = await tokenFor(comparison),
    latest = await tx.latestReview(comparison.receiptId, qualification);
  if (latest) await authenticatedReview(tx, view, context, latest, tokenFor, account);
  return { qualification, token, review: reviewState(latest, token) };
}
