import type { ComparedState, InputComparison } from "../../core/evidence.ts";

function validateReferenceUse(input: InputComparison, referenceUses: boolean) {
  const use = input.referenceUse;
  if (!use) return;
  if (!referenceUses) throw Error("Reference-use state requires its explicit target policy");
  for (const entity of [input.current.entity, use.resourceDefault.entity])
    if (entity && entity.id !== input.entityId)
      throw Error("Reference-use resource identity mismatch");
  for (const observation of [input.current.observation, use.resourceDefault.observation])
    if (observation && observation.entityId !== input.entityId)
      throw Error("Reference-use observation identity mismatch");
  if (input.recorded.referenceId !== undefined && input.recorded.referenceId !== use.relationshipId)
    throw Error("Reference-use declaration mismatch");
  if (use.selection === "unavailable" && !input.hasUnknown)
    throw Error("Unavailable reference use cannot establish known applicability");
}
export function validateSelectedComparison(value: ComparedState, referenceUses: boolean) {
  for (const input of value.inputs) {
    validateReferenceUse(input, referenceUses);
    if (
      input.entityId !== input.recorded.entityId ||
      input.current.links.length !== input.recorded.links.length
    )
      throw Error("Invalid selected support input correspondence");
  }
  const rows = [...value.inputs, ...(value.relationshipInputs ?? [])],
    unknown = rows.some((x) => x.hasUnknown),
    changed = rows.some((x) => x.hasChanged);
  if (
    value.hasUnknown !== unknown ||
    value.hasChanged !== changed ||
    value.state !== (unknown ? "unknown" : changed ? "changed" : "current")
  )
    throw Error("Contradictory selected support comparison");
}
