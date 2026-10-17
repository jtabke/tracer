import type { Schema } from "../../src/core/model.ts";

export function allowedTypes(schema: Schema, source?: { type: string }, target?: { type: string }) {
  if (!source || !target) return [];
  return Object.entries(schema.relationshipTypes)
    .filter(
      ([, rule]) =>
        (!rule.source || rule.source.includes(source.type)) &&
        (!rule.target || rule.target.includes(target.type)),
    )
    .map(([type]) => type);
}
