import type { Entity } from "../src/core/model.ts";
import { label } from "./fields.tsx";
export const title = (entity: Entity) =>
  typeof entity.fields.title === "string" ? entity.fields.title : label(entity);
export const readable = (name: string) => name.replaceAll("_", " ");
