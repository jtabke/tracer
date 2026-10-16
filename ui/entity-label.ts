import type { Entity } from "../src/core/model.ts";

export const label = (entity: Entity) =>
  entity.key ??
  (typeof entity.fields.title === "string" ? entity.fields.title : entity.id.slice(0, 8));
