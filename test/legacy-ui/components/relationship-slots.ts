import type { SchemaObject } from "../../../src/core/model.ts";

export type RelationshipSlot = import("../../../src/core/presentation.ts").TraceColumn;

/** Explicit endpoint permissions, not inferred hierarchy or required coverage. */
export function relationshipSlots(schema: SchemaObject, type: string): RelationshipSlot[] {
  const all = Object.keys(schema.entityTypes);
  return Object.entries(schema.relationshipTypes).flatMap(([relationshipType, definition]) => {
    const slots: RelationshipSlot[] = [];
    if (!definition.source || definition.source.includes(type))
      for (const targetType of definition.target ?? all)
        slots.push({ relationshipType, targetType, direction: "outgoing" });
    if (!definition.target || definition.target.includes(type))
      for (const targetType of definition.source ?? all)
        slots.push({ relationshipType, targetType, direction: "incoming" });
    return slots;
  });
}
