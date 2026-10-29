import { ensure } from "../core/model.ts";
import { TracerError } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type { Receipt } from "../core/evidence.ts";
import type {
  VerificationCaseView,
  RecordVerificationExecution,
  VerificationExecutionData,
} from "../core/verification-case.ts";
import type { VerificationCriterion } from "../core/verification-basis.ts";
import type { VerificationBasis } from "../core/verification-basis.ts";
import type { Transaction } from "./ports/repository.ts";
import { verificationReceiptOrigin } from "./verification-receipt-origin.ts";
import { verificationBytes } from "../core/verification-case-validation.ts";
import { verificationCaseLimits } from "../core/verification-case.ts";

type Origin = NonNullable<Awaited<ReturnType<typeof verificationReceiptOrigin>>>;
type Interpretation = Pick<RecordVerificationExecution, "methodId" | "results">;
function passedCoverage(origin: Origin, criterion: VerificationCriterion) {
  const text = origin.basis.requirement.acceptance[criterion.field];
  if (typeof text !== "string") return false;
  const passed = new Set(
    origin.data.results.filter((row) => row.outcome === "passed").map((row) => row.criterionId),
  );
  const ranges = origin.basis.criteria
    .filter((row) => row.field === criterion.field && passed.has(row.id))
    .sort((a, b) => a.start - b.start);
  let cursor = criterion.start;
  for (const range of ranges) {
    if (range.end <= cursor) continue;
    const gapEnd = Math.min(range.start, criterion.end);
    if (gapEnd > cursor && /\S/.test(text.slice(cursor, gapEnd))) return false;
    cursor = Math.max(cursor, range.end);
    if (cursor >= criterion.end) return true;
  }
  return !/\S/.test(text.slice(cursor, criterion.end));
}
function validateOrigin(origin: Origin, view: VerificationCaseView, input: Interpretation) {
  const old = origin.basis.methods.find((method) => method.entityId === origin.data.methodId);
  const selected = view.scope.basis.methods.find((method) => method.entityId === input.methodId);
  ensure(
    origin.basis.requirement.entityId === view.scope.basis.requirement.entityId &&
      origin.data.methodId === input.methodId &&
      old &&
      selected &&
      old.procedure === selected.procedure &&
      old.expected === selected.expected &&
      canonical(old.relationship) === canonical(selected.relationship),
    "validation",
    "Controlled prior execution must match the same requirement and method semantic scope; changed scope requires performed execution",
  );
  for (const result of input.results) {
    if (result.outcome !== "passed") continue;
    const criterion = view.scope.basis.criteria.find((row) => row.id === result.criterionId);
    ensure(
      criterion && passedCoverage(origin, criterion),
      "validation",
      "A passing prior interpretation needs complete passing controlled source coverage; failed, blocked, unexecuted or uncovered scope requires performed execution",
    );
  }
}

export async function validateTypedPriorResults(
  tx: Transaction,
  receipt: Receipt,
  view: VerificationCaseView,
  input: Interpretation,
) {
  const seen = new Set<string>();
  let source = receipt;
  for (let depth = 0; ; depth++) {
    ensure(
      depth < 25 && !seen.has(source.id),
      "validation",
      "Controlled prior-source chain exceeds 25 receipts or repeats an identity; use a performed execution",
    );
    seen.add(source.id);
    verificationBytes(source, verificationCaseLimits.priorReceiptBytes);
    const origin = await verificationReceiptOrigin(tx, source);
    if (!origin) return;
    validateOrigin(origin, view, input);
    if (origin.data.source.kind === "performed") return;
    const previous = await tx.getEvidence("receipt", origin.data.source.receiptId);
    ensure(previous, "storage", "Controlled prior execution source is missing");
    source = previous;
  }
}

/** Old successful commands remain historical; unsupported prior scope is no longer eligible now. */
export async function supportedPriorResults(
  tx: Transaction,
  view: VerificationCaseView,
  basis: VerificationBasis,
  data: VerificationExecutionData,
) {
  if (data.source.kind === "performed") return true;
  const source = await tx.getEvidence("receipt", data.source.receiptId);
  ensure(source, "storage", "Original verification source receipt is missing");
  try {
    await validateTypedPriorResults(tx, source, { ...view, scope: { ...view.scope, basis } }, data);
    return true;
  } catch (error) {
    if (error instanceof TracerError && error.code === "validation") return false;
    throw error;
  }
}
