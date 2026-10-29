import type {
  ConfigurationReceiptQuery,
  ConfigurationReceiptComparison,
} from "../../core/configuration-applicability.ts";
import { canonical } from "../../core/evidence.ts";
import { ensure } from "../../core/model.ts";
import { comparedState, receipt } from "../api-models.ts";
import { literal, object, text } from "../decode.ts";
import { exactConfigurationInputFields } from "./configuration-input.ts";

const decode = object({
  contract: literal("configuration_receipt_comparison"),
  version: literal(1),
  basis: object({
    configurationId: text,
    receiptId: text,
    policy: literal("selected-dependencies-v1"),
    configurationDigest: text,
    receiptDigest: text,
  }),
  token: text,
  scope: exactConfigurationInputFields.scope,
  receipt,
  comparison: comparedState,
  completeness: object({
    inputs: literal("all_declared"),
    relationships: literal("all_declared", "legacy_unknown"),
    engineeringImpact: literal("not_assessed"),
    externalBytes: literal("not_retained"),
  }),
});
export function configurationReceiptComparison(
  value: unknown,
  query: ConfigurationReceiptQuery,
): ConfigurationReceiptComparison {
  const result = decode(value);
  ensure(
    result.basis.configurationId === query.configurationId &&
      result.basis.receiptId === query.receiptId &&
      result.receipt.id === query.receiptId &&
      result.comparison.receiptId === query.receiptId,
    "validation",
    "Configuration receipt comparison belongs to another selected context",
  );
  ensure(
    canonical(result.comparison.inputs.map((row) => row.recorded)) ===
      canonical(result.receipt.inputs) &&
      canonical(result.comparison.relationshipInputs?.map((row) => row.recorded)) ===
        canonical(result.receipt.relationshipInputs),
    "validation",
    "Configuration receipt comparison has an incomplete declared dependency population",
  );
  ensure(
    result.completeness.relationships ===
      (result.receipt.relationshipInputs === undefined ? "legacy_unknown" : "all_declared"),
    "validation",
    "Configuration receipt comparison misstates legacy relationship completeness",
  );
  ensure(
    [result.token, result.basis.configurationDigest, result.basis.receiptDigest].every((value) =>
      /^sha256:[a-f0-9]{64}$/.test(value),
    ),
    "validation",
    "Invalid configuration receipt comparison digest",
  );
  return result;
}
