import type { CapturedInput } from "../core/evidence.ts";
import type { Relationship } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";
import type { EngineeringStateReader } from "./engineering-state.ts";
import { selectedReferenceState } from "./reference-state.ts";

/** Explicit V2 correspondence: default identity and a qualifying use are independent selections. */
export function referenceEngineeringState(
  tx: Transaction,
  state: EngineeringStateReader,
): EngineeringStateReader {
  return {
    ...state,
    resolveInput: async (input: CapturedInput, reference?: Relationship) => {
      const entity = await state.getEntity(input.entityId),
        observation = input.observation ? await state.getObservation(input.entityId) : null;
      if (input.referenceId === undefined && !reference?.reference) return { entity, observation };
      const relationshipId = input.referenceId ?? reference!.id;
      const link =
        reference?.reference && reference.target === input.entityId
          ? await state.getRelationship(relationshipId)
          : undefined;
      const selected = await selectedReferenceState(
        tx,
        link,
        entity,
        observation,
        input.observation ? "content" : "native",
      );
      return {
        entity: selected.entity,
        observation: selected.observation,
        referenceUse: {
          relationshipId,
          selection: selected.selection,
          resourceDefault: { entity: entity ?? null, observation },
          passage: (link?.reference ?? reference?.reference)?.selector
            ? ("unknown" as const)
            : ("whole-resource" as const),
          ...(selected.reason ? { reason: selected.reason } : {}),
        },
      };
    },
  };
}
