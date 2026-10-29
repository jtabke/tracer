import type { ExactConfigurationInput } from "./configuration.ts";
import type { Receipt, ComparedState } from "./evidence.ts";

export type ConfigurationReceiptQuery = { configurationId: string; receiptId: string };
/** Fixed selected input state only: outcomes, supersession and engineering judgments stay distinct. */
export type ConfigurationReceiptComparison = {
  contract: "configuration_receipt_comparison";
  version: 1;
  basis: ConfigurationReceiptQuery & {
    policy: "selected-dependencies-v1";
    configurationDigest: string;
    receiptDigest: string;
  };
  token: string;
  scope: ExactConfigurationInput["scope"];
  receipt: Receipt;
  /** `current` fields resolve to the explicit target, never to the live project head. */
  comparison: ComparedState;
  completeness: {
    inputs: "all_declared";
    relationships: "all_declared" | "legacy_unknown";
    engineeringImpact: "not_assessed";
    externalBytes: "not_retained";
  };
};
