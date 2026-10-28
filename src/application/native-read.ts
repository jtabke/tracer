import { ensure } from "../core/model.ts";
import type { StoredByKind } from "../core/model.ts";
import type { Repository } from "./ports/repository.ts";

export async function readNative<K extends "entity" | "relationship">(
  repository: Repository,
  kind: K,
  id: string,
): Promise<StoredByKind[K]> {
  ensure(typeof id === "string" && id.trim().length > 0, "validation", "Object ID is required", {
    kind,
    path: ["id"],
  });
  return repository.transaction(async (tx) => {
    const value = await tx.get(kind, id);
    ensure(value, "not_found", "Object not found", { kind, id });
    return value;
  });
}
