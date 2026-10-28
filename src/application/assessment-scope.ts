import type { ChangeImpact, ImpactReceipt } from "../core/impact.ts";
import { ensure } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";
import { readChangeImpact } from "./impact.ts";
import { changeAssessmentLimits } from "../core/change-assessment.ts";
import type {
  AssessmentScope,
  AssessmentNativeCandidate,
  AssessmentReceiptCandidate,
  OpenChangeAssessment,
} from "../core/change-assessment.ts";

function receiptCandidate(item: ImpactReceipt): AssessmentReceiptCandidate {
  return {
    kind: "receipt",
    id: item.receipt.id,
    scope: item.scope,
    supersession: item.supersession,
    inputs: item.comparison.inputs.map((input) => ({
      entityId: input.entityId,
      version: input.current.entity?.version ?? null,
      observationId: input.current.observation?.id ?? null,
      links: input.recorded.links.map((link, index) => ({
        id: link.id,
        version: input.current.links[index]?.version ?? null,
      })),
    })),
    relationshipInputs: (item.comparison.relationshipInputs ?? []).map((input) => ({
      id: input.id,
      version: input.current?.version ?? null,
    })),
  };
}

async function nativeCandidates(tx: Transaction, native: ChangeImpact["native"]) {
  const candidates: AssessmentNativeCandidate[] = [];
  for (const kind of ["entity", "relationship"] as const) {
    const items = kind === "entity" ? native.entities : native.relationships;
    for (const item of items) {
      const observation =
        kind === "entity" ? await tx.latestEvidence("observation", item.id) : undefined;
      candidates.push({
        kind,
        id: item.id,
        change: item.state,
        beforeVersion: item.before?.version ?? null,
        version: item.after?.version ?? null,
        ...(kind === "entity" ? { observationId: observation?.id ?? null } : {}),
      });
    }
  }
  return candidates;
}

/** Exact selected traversal, not a claim of exhaustive engineering consequences. */
export async function discoverAssessmentScope(
  tx: Transaction,
  request: Pick<OpenChangeAssessment, "assessmentId" | "purpose" | "query">,
): Promise<AssessmentScope> {
  // One receipt per page bounds comparison work even for receipts with 100 declarations.
  let impact = await readChangeImpact(tx, { ...request.query, limit: 1 });
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
    candidates: await nativeCandidates(tx, impact.native),
  };
  // Stop after a bounded number of examined rows, including excluded own-output receipts.
  for (let rows = 1; ; rows++) {
    for (const item of impact.evaluations.items) {
      if (item.receipt.output.id === request.assessmentId) continue;
      scope.candidates.push(receiptCandidate(item));
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
    impact = await readChangeImpact(tx, {
      ...request.query,
      limit: 1,
      after: impact.evaluations.nextAfter,
    });
  }
  ensure(
    new TextEncoder().encode(JSON.stringify(scope)).byteLength <= changeAssessmentLimits.scopeBytes,
    "validation",
    "Assessment scope exceeds 64 KiB; narrow the scope",
  );
  return scope;
}
