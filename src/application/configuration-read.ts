import { ensure } from "../core/model.ts";
import { validateConfigurationCapture } from "../core/configuration-capture-validation.ts";
import type { Transaction } from "./ports/repository.ts";

export async function readConfiguration(tx: Transaction, id: string) {
  const value = await tx.getConfiguration(id);
  ensure(value, "not_found", "Configuration not found");
  validateConfigurationCapture(value);
  return value;
}
