import { ensure } from "../core/model.ts";
import type { Provenance } from "../core/model.ts";
import type { ReviewVerificationSupport } from "../core/verification-lifecycle.ts";
import { verificationCaseLimits } from "../core/verification-case.ts";
import type { Transaction } from "./ports/repository.ts";
import { verificationMutationContext, verificationMutationFacts } from "./verification-mutation.ts";
import { inspectVerificationTargetSupport } from "./verification-support-inspection.ts";
import { captureReview } from "./review-capture.ts";

export async function reviewVerificationSupport(
  tx: Transaction,
  request: ReviewVerificationSupport,
  actor: Provenance,
) {
  const result = await verificationMutationContext(tx, request),
    { analysis, entries } = result;
  ensure(
    analysis.view.scope.target,
    "validation",
    "Qualified support review requires an explicit target",
  );
  const entry = entries.find((x) => x.summary.id === request.executionId);
  ensure(entry, "not_found", "Execution is outside this controlled case registry");
  const inspect = () =>
    inspectVerificationTargetSupport(
      tx,
      analysis.view,
      request.executionId,
      entry.raw.receipt,
      entry.raw.source ?? null,
    );
  const support = await inspect(),
    layer = support!.layers.find((x) => x.receiptId === request.receiptId);
  ensure(
    layer,
    "validation",
    "Review receipt is outside this execution's complete support source chain",
  );
  ensure(
    request.decision !== "accepted" || analysis.basis.state === "current",
    "validation",
    "Cannot accept support under an unresolved governing basis",
  );
  await captureReview(
    tx,
    {
      receiptId: request.receiptId,
      decision: request.decision,
      rationale: request.reason,
      expectedComparison: request.expectedComparison,
    },
    layer.comparison,
    actor,
    () => request.commandId,
    layer,
  );
  const { declarations } = verificationMutationFacts(result, new Set([request.executionId]));
  return {
    operations: [],
    maxResultBytes: verificationCaseLimits.responseBytes,
    receipt: {
      outputId: analysis.view.case.id,
      expectedOutputVersion: analysis.view.case.version,
      outcome:
        "Recorded qualified verification support judgment; no execution outcome or verified conclusion established",
      ...declarations,
    },
    assertComplete: async () => {
      const saved = (await inspect())!.layers.find((x) => x.receiptId === request.receiptId);
      ensure(
        saved?.review.decision?.id === request.commandId && saved.token === layer.token,
        "conflict",
        "Review changes its own qualified context; no review was saved",
      );
    },
  };
}
