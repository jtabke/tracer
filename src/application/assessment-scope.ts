import { receiptCandidate, nativeCandidates } from "./assessment-candidates.ts";
import { discoverPairAssessmentScope } from "./pair-assessment-scope.ts";
import { ensure } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";
import { readChangeImpact } from "./impact.ts";
import { changeAssessmentLimits, isPairAssessmentQuery } from "../core/change-assessment.ts";
import type {
  AssessmentScope,
  OpenChangeAssessment,
  AssessmentBaselineQuery,
} from "../core/change-assessment.ts";

/** Exact selected traversal, not a claim of exhaustive engineering consequences. */
export async function discoverAssessmentScope(
  tx: Transaction,
  request: Pick<OpenChangeAssessment, "assessmentId" | "purpose" | "query">,
): Promise<AssessmentScope> {
  if (isPairAssessmentQuery(request.query))
    return discoverPairAssessmentScope(tx, { ...request, query: request.query });
  return discoverBaselineAssessmentScope(tx, { ...request, query: request.query });
}
async function discoverBaselineAssessmentScope(
  tx: Transaction,
  request: Pick<OpenChangeAssessment, "assessmentId" | "purpose"> & {
    query: AssessmentBaselineQuery;
  },
): Promise<AssessmentScope> {
  // One receipt per page bounds comparison work even for receipts with 100 declarations.
  let impact = await readChangeImpact(tx, { ...request.query, limit: 1 }, request.assessmentId);
  ensure(
    impact.native.entities.length + impact.native.relationships.length <=
      changeAssessmentLimits.candidates,
    "validation",
    "Assessment exceeds 25 candidates; narrow the scope",
  );
  const scope: AssessmentScope = {
    contract: "change_assessment_scope",
    version: 1,
    purpose: request.purpose,
    query: { baselineId: request.query.baselineId, ...impact.scope },
    basis: {
      projectRevision: impact.context.projectRevision,
      evidenceRevision: impact.context.evidenceRevision,
      schemaVersion: impact.context.afterSchema.version,
      baselineRevision: impact.context.baseline.projectRevision,
    },
    discovery: {
      complete: true,
      interpretation: "selected_traversal",
      excludedReceiptOutputId: request.assessmentId,
      before: impact.native.before,
      after: impact.native.after,
    },
    candidates: await nativeCandidates(impact.native, (id) => tx.latestEvidence("observation", id)),
  };
  // Stop after a bounded number of examined rows, including excluded own-output receipts.
  for (let rows = 1; ; rows++) {
    for (const item of impact.evaluations.items) {
      if (item.receipt.output.id === request.assessmentId) continue;
      scope.candidates.push(
        receiptCandidate(item, new Set(impact.native.entities.map((item) => item.id))),
      );
    }
    ensure(
      scope.candidates.length <= changeAssessmentLimits.candidates,
      "validation",
      "Assessment exceeds 25 candidates; narrow the scope",
    );
    if (!impact.evaluations.nextAfter) break;
    ensure(
      rows < changeAssessmentLimits.candidates,
      "validation",
      "Assessment receipt discovery exceeds 25 rows; narrow the scope",
    );
    impact = await readChangeImpact(
      tx,
      {
        ...request.query,
        limit: 1,
        after: impact.evaluations.nextAfter,
      },
      request.assessmentId,
    );
  }
  ensure(
    new TextEncoder().encode(JSON.stringify(scope)).byteLength <= changeAssessmentLimits.scopeBytes,
    "validation",
    "Assessment scope exceeds 64 KiB; narrow the scope",
  );
  return scope;
}
