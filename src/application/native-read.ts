import { ensure } from "../core/model.ts";
import type { Entity, Relationship } from "../core/model.ts";
import type { Repository } from "./ports/repository.ts";

type NativeObject = { entity: Entity; relationship: Relationship };
export async function readNative<K extends keyof NativeObject>(
  repository: Repository,
  kind: K,
  id: string,
): Promise<NativeObject[K]> {
  ensure(typeof id === "string" && id.trim().length > 0, "validation", "Object ID is required", {
    kind,
    path: ["id"],
  });
  return repository.transaction(async (tx) => {
    const value = await tx.get(kind, id);
    ensure(value, "not_found", "Object not found", { kind, id });
    return value as NativeObject[K];
  });
}
