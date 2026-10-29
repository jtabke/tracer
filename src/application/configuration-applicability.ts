import { ensure, json, knownProperties, record } from "../core/model.ts";
import type {
  ConfigurationReceiptQuery,
  ConfigurationReceiptComparison,
} from "../core/configuration-applicability.ts";
import type { Transaction } from "./ports/repository.ts";
import { configurationEngineeringState } from "./engineering-state.ts";
import type { EngineeringStateReader } from "./engineering-state.ts";
import { compareCapturedInputs, comparisonToken } from "./receipt-comparison.ts";
import { factDigest } from "./fact-digest.ts";

function boundedSelectedReads(state: EngineeringStateReader): EngineeringStateReader {
  let bytes = 0;
  const account = <T>(value: T): T => {
    bytes += new TextEncoder().encode(JSON.stringify(value ?? null)).length;
    ensure(
      bytes <= 4194304,
      "validation",
      "Configuration receipt comparison exceeds its 4 MiB selected-read budget; narrow the declared input population",
    );
    return value;
  };
  return {
    ...state,
    getEntity: async (id) => account(await state.getEntity(id)),
    getRelationship: async (id) => account(await state.getRelationship(id)),
    getObservation: async (id) => account(await state.getObservation(id)),
  };
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
  ensure(
    receipt.inputs.length + (receipt.relationshipInputs?.length ?? 0) <= 100 &&
      receipt.inputs.reduce((n, value) => n + value.links.length, 0) <= 1000,
    "validation",
    "Configuration receipt comparison exceeds its complete dependency population budget",
  );
  const basis = {
    ...input,
    policy: "selected-dependencies-v1" as const,
    configurationDigest: selected.digest,
    receiptDigest: await factDigest(receipt),
  };
  const comparison = await compareCapturedInputs(tx, receipt, boundedSelectedReads(selected));
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
