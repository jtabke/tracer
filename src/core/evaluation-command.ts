import type { ChangesetResult } from "./changeset.ts";
import type { Receipt } from "./evidence.ts";

/** Journal discriminators belong to application command recovery, not one capability. */
export type ApplicationOperation =
  | "change-assessment.open"
  | "change-assessment.refresh"
  | "change-assessment.disposition"
  | "change-assessment.close"
  | "change-assessment.reopen"
  | "verification.open"
  | "verification.execute";

/** Exact successful application result; operational recovery data, not a new engineering record. */
export type EvaluationResult = {
  commandId: string;
  native: ChangesetResult | null;
  receipt: Receipt;
};
