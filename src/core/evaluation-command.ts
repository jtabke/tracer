import type { ChangesetResult } from "./changeset.ts";
import type { Receipt } from "./evidence.ts";

/** Exact successful application result; operational recovery data, not a new engineering record. */
export type EvaluationResult = {
  commandId: string;
  native: ChangesetResult | null;
  receipt: Receipt;
};
