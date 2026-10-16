import type { Entity } from "../src/core/model.ts";

/** Match the primary field choice without losing structured native values. */
export function statementText(entity: Pick<Entity, "fields">) {
  const value = entity.fields.statement ?? entity.fields.title;
  return typeof value === "string" ? value : (JSON.stringify(value) ?? "");
}
