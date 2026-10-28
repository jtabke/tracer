import { ensure, json } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";

export function evidenceText(value: unknown, label: string): asserts value is string {
  ensure(
    typeof value === "string" && value.trim() && json(value),
    "validation",
    label + " must be nonempty text",
  );
}
export async function evidenceEntity(tx: Transaction, id: string) {
  evidenceText(id, "Entity ID");
  const value = await tx.get("entity", id);
  ensure(value, "not_found", "Active entity not found: " + id);
  return value;
}
