import type { Entity } from "./model.ts";
import { canonical } from "./evidence.ts";
import type { ComparedState } from "./evidence.ts";

export function nativeState(value: Entity, fields?: string[]) {
  return fields
    ? fields.map((name) => ({
        name,
        present: Object.hasOwn(value.fields, name),
        ...(Object.hasOwn(value.fields, name) ? { value: value.fields[name] } : {}),
      }))
    : value;
}

// Review applicability follows only declared dependencies, not observation IDs,
// timestamps, unrelated commits, external annotations or unselected native fields.
export function comparisonToken(value: ComparedState) {
  return canonical({
    receiptId: value.receiptId,
    ...(value.relationshipInputs === undefined
      ? {}
      : {
          relationshipInputs: value.relationshipInputs.map((r) => ({
            id: r.id,
            current: r.current,
            state: r.state,
          })),
        }),
    inputs: value.inputs.map((input) => ({
      ...(input.recorded.referenceId === undefined
        ? {}
        : { referenceId: input.recorded.referenceId }),
      ...(input.referenceUse
        ? {
            referenceUse: {
              relationshipId: input.referenceUse.relationshipId,
              selection: input.referenceUse.selection,
              passage: input.referenceUse.passage,
            },
          }
        : {}),
      entityId: input.entityId,
      exists: input.current.entity !== null,
      state: input.state,
      source: input.recorded.observation
        ? {
            availability: input.current.observation?.availability ?? "unknown",
            hash: input.current.observation?.hash ?? null,
          }
        : input.current.entity
          ? nativeState(input.current.entity, input.recorded.fields)
          : null,
      links: input.current.links,
    })),
  });
}
