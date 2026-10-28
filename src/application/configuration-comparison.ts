import { ensure, json, knownProperties, record } from "../core/model.ts";
import { validateConfigurationCapture } from "../core/configuration-capture-validation.ts";
import type {
  ConfigurationComparison,
  ConfigurationPair,
} from "../core/configuration-comparison.ts";
import type { Transaction } from "./ports/repository.ts";
import { factDigest } from "./fact-digest.ts";
import { configurationDifferenceView } from "../core/configuration-comparison.ts";

export function validateConfigurationPair(input: ConfigurationPair) {
  ensure(record(input) && json(input), "validation", "Choose two configuration identities");
  knownProperties(input, ["beforeId", "afterId"]);
  for (const id of [input.beforeId, input.afterId])
    ensure(
      typeof id === "string" && !!id.trim() && id.length <= 200,
      "validation",
      "Choose bounded configuration identities",
    );
}
async function required(tx: Transaction, id: string) {
  const value = await tx.getConfiguration(id);
  ensure(value, "not_found", "Selected configuration is unavailable");
  validateConfigurationCapture(value);
  ensure(
    value.members.length <= 100 && (value.relationships?.length ?? 0) <= 200,
    "validation",
    "Configuration comparison exceeds its native population budget",
  );
  return value;
}
/** Read only the two immutable rows. Never consult live native/evidence state or perform observer IO. */
export async function compareConfigurations(
  tx: Transaction,
  input: ConfigurationPair,
): Promise<ConfigurationComparison> {
  const before = await required(tx, input.beforeId),
    after = await required(tx, input.afterId);
  const basis = {
    ...input,
    policy: "exact-selected-state-v1" as const,
    beforeDigest: await factDigest(before),
    afterDigest: await factDigest(after),
  };
  const result: ConfigurationComparison = {
    contract: "configuration_comparison",
    version: 1,
    basis: { ...basis, digest: await factDigest(basis) },
    before,
    after,
    ...configurationDifferenceView(before, after),
  };
  ensure(
    new TextEncoder().encode(JSON.stringify(result)).length <= 4194304,
    "validation",
    "Configuration comparison exceeds 4 MiB; narrow the selected scope",
  );
  return result;
}
