import type { Receipt } from "../core/evidence.ts";
import type { VerificationCaseView, VerificationTargetSupport } from "../core/verification-case.ts";
import type { Transaction } from "./ports/repository.ts";
import { boundedEngineeringState } from "./engineering-state.ts";
import { verificationEngineeringState } from "./verification-target.ts";
import { verificationGoverningBasis } from "./verification-governing.ts";
import { verificationSupport, verificationWorkBudget } from "./verification-support.ts";

/** Uses the same projected dependencies and source closure as controlled case analysis. */
export async function inspectVerificationTargetSupport(
  tx: Transaction,
  view: VerificationCaseView,
  executionId: string,
  receipt: Receipt,
  source: Receipt | null,
): Promise<VerificationTargetSupport | undefined> {
  if (!view.scope.target) return undefined;
  const state = boundedEngineeringState(
    await verificationEngineeringState(tx, view.scope),
    16777216,
    "Verification support inspection exceeds its 16 MiB resolved-state read budget",
  );
  const governing = await verificationGoverningBasis(tx, view, state);
  const result: VerificationTargetSupport = {
    target: view.scope.target,
    basisDigest: governing.digest,
    layers: [],
  };
  const inspection = { layers: result.layers, executionId, basisDigest: governing.digest },
    work = verificationWorkBudget();
  work(receipt);
  await verificationSupport(tx, view, receipt, false, !!source, state, work, [], inspection);
  result.layers[0].nextSourceReceiptId = source?.id ?? null;
  if (source) {
    work(source);
    await verificationSupport(tx, view, source, true, true, state, work, [], inspection);
  }
  return result;
}
