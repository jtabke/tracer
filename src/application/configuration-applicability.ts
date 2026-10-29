import { ensure, json, knownProperties, record } from "../core/model.ts";
import type {
  ConfigurationReceiptQuery,
  ConfigurationReceiptComparison,
} from "../core/configuration-applicability.ts";
import type { Transaction } from "./ports/repository.ts";
import { configurationEngineeringState, boundedEngineeringState } from "./engineering-state.ts";
import { compareCapturedInputs, comparisonToken } from "./receipt-comparison.ts";
import { factDigest } from "./fact-digest.ts";
import type { Receipt } from "../core/evidence.ts";

export function validateReceiptDependencyPopulation(receipt: Receipt) {
  ensure(
    receipt.inputs.length + (receipt.relationshipInputs?.length ?? 0) <= 100 &&
      receipt.inputs.reduce((n, value) => n + value.links.length, 0) <= 1000,
    "validation",
    "Configuration receipt comparison exceeds its complete dependency population budget",
  );
}

export function validateConfigurationReceiptQuery(input: ConfigurationReceiptQuery) {
  ensure(record(input) && json(input), "validation", "Choose a configuration and receipt");
  knownProperties(input, ["configurationId", "receiptId"]);
  for (const id of [input.configurationId, input.receiptId])
    ensure(
      typeof id === "string" && !!id.trim() && id.length <= 200,
      "validation",
      "Choose bounded configuration/receipt identities",
    );
}
export async function compareConfigurationReceipt(
  tx: Transaction,
  input: ConfigurationReceiptQuery,
): Promise<ConfigurationReceiptComparison> {
  const selected = await configurationEngineeringState(tx, input.configurationId);
  const receipt = await tx.getEvidence("receipt", input.receiptId);
  ensure(receipt, "not_found", "Receipt not found");
  validateReceiptDependencyPopulation(receipt);
  const basis = {
    ...input,
    policy: "selected-dependencies-v1" as const,
    configurationDigest: selected.digest,
    receiptDigest: await factDigest(receipt),
  };
  const comparison = await compareCapturedInputs(
    tx,
    receipt,
    boundedEngineeringState(
      selected,
      4194304,
      "Configuration receipt comparison exceeds its 4 MiB selected-read budget; narrow the declared input population",
    ),
  );
  const result: ConfigurationReceiptComparison = {
    contract: "configuration_receipt_comparison",
    version: 1,
    basis,
    token: await factDigest({ basis, comparison: comparisonToken(comparison) }),
    scope: selected.configuration.capture!.intent.scope,
    receipt,
    comparison,
    completeness: {
      inputs: "all_declared",
      relationships: receipt.relationshipInputs === undefined ? "legacy_unknown" : "all_declared",
      engineeringImpact: "not_assessed",
      externalBytes: "not_retained",
    },
  };
  ensure(
    new TextEncoder().encode(JSON.stringify(result)).length <= 4194304,
    "validation",
    "Configuration receipt comparison exceeds 4 MiB; narrow the declared dependency scope",
  );
  return result;
}
