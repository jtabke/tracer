import type { ChangeImpact, ImpactReceipt } from "../core/impact.ts";
import type {
  AssessmentNativeCandidate,
  AssessmentReceiptCandidate,
} from "../core/change-assessment.ts";

export function receiptCandidate(
  item: ImpactReceipt,
  entityIds: Set<string>,
): AssessmentReceiptCandidate {
  return {
    kind: "receipt",
    id: item.receipt.id,
    contentIds: [
      ...new Set(
        item.comparison.inputs
          .filter((input) => entityIds.has(input.entityId))
          .map((input) => input.entityId),
      ),
    ],
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

export async function nativeCandidates(
  native: ChangeImpact["native"],
  observe: (id: string) => Promise<import("../core/evidence.ts").Observation | undefined | null>,
) {
  const candidates: AssessmentNativeCandidate[] = [];
  for (const kind of ["entity", "relationship"] as const) {
    const items = kind === "entity" ? native.entities : native.relationships;
    for (const item of items) {
      const observation = kind === "entity" ? await observe(item.id) : undefined;
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
