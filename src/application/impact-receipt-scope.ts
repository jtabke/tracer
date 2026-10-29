import type { ComparedState } from "../core/evidence.ts";
import type { ImpactReceipt } from "../core/impact.ts";
import { scopedInputState } from "./receipt-comparison.ts";

export function receiptScope(
  comparison: ComparedState,
  entityIds: Set<string>,
  relationshipIds: Set<string>,
  source: "current" | "configuration" = "current",
): ImpactReceipt["scope"] {
  const inputs = comparison.inputs.filter(
    (input) =>
      entityIds.has(input.entityId) ||
      input.recorded.links.some((link) => relationshipIds.has(link.id)),
  );
  const states = inputs.map((input) =>
    scopedInputState(input, entityIds.has(input.entityId), relationshipIds, source),
  );
  const direct = (comparison.relationshipInputs ?? []).filter((r) => relationshipIds.has(r.id));
  const hasChanged = direct.some((r) => r.hasChanged) || states.some((state) => state.hasChanged),
    hasUnknown = direct.some((r) => r.hasUnknown) || states.some((state) => state.hasUnknown);
  return {
    inputIds: inputs.map((input) => input.entityId),
    relationshipIds: [
      ...new Set([
        ...direct.map((r) => r.id),
        ...inputs.flatMap((input) =>
          input.recorded.links
            .filter((link) => relationshipIds.has(link.id))
            .map((link) => link.id),
        ),
      ]),
    ].sort(),
    hasChanged,
    hasUnknown,
    state: hasUnknown ? "unknown" : hasChanged ? "changed" : "current",
  };
}
