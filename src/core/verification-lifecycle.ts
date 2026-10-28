import type {
  VerificationSelection,
  VerificationGuards,
  VerificationOutcome,
  VerificationCaseView,
} from "./verification-case.ts";
import type { PrepareVerificationBasis } from "./verification-basis.ts";
import type { Json } from "./model.ts";

export type VerificationChoice = { criterionId: string; methodId: string; executionId: string };
export type VerificationAccounting = {
  executionId: string;
  decision: "selected" | "historical" | "superseded";
  rationale: string;
  replacementId?: string;
};
export type VerificationMutation = VerificationSelection &
  VerificationGuards & {
    expectedCaseVersion: number;
    expectedAnalysisDigest: string;
    reason: string;
  };
export type SelectVerificationResults = VerificationMutation & {
  selections: VerificationChoice[];
  accounting: VerificationAccounting[];
};
export type ReviseVerificationBasis = VerificationMutation & {
  basis: PrepareVerificationBasis;
  mapping: { fromId: string; toId: string | null }[];
};
export type VerificationResultSelection = {
  contract: "verification_result_selection";
  version: 1;
  reason: string;
  selections: VerificationChoice[];
  accounting: VerificationAccounting[];
  evidenceDigest: string;
  facts: Json;
};
export type VerificationConclusion = {
  contract: "verification_conclusion";
  version: 1;
  commandId: string;
  openingCommandId: string;
  rationale: string;
  at: { projectRevision: number; evidenceRevision: number };
  evidenceDigest: string;
  basisDigest: string;
  obligations: VerificationChoice[];
};
export type VerificationObligation = {
  criterionId: string;
  methodId: string;
  executionId: string | null;
  outcome: VerificationOutcome | null;
  applicability:
    | "unselected"
    | "current"
    | "assessed"
    | "changed"
    | "unknown"
    | "unavailable"
    | "wrong_basis"
    | "superseded";
  reasons: string[];
};
export type VerificationExecutionSummary = {
  id: string;
  receiptId: string;
  methodId: string;
  immutableDigest: string;
  stateDigest: string;
  current: boolean;
  eligibleCriterionIds: string[];
  results: {
    criterionId: string;
    currentCriterionId: string | null;
    outcome: VerificationOutcome;
  }[];
  support: {
    changed: boolean;
    unknown: boolean;
    assessed: boolean;
    reviewRequired: boolean;
    superseded: boolean;
  };
};
export type VerificationAnalysis = {
  view: VerificationCaseView;
  basis: { state: "current" | "changed" | "unknown"; digest: string; reasons: string[] };
  recordedSelection: VerificationResultSelection | null;
  recordedConclusion: VerificationConclusion | null;
  executions: VerificationExecutionSummary[];
  obligations: VerificationObligation[];
  proposalDigest: string;
  selection: {
    state: "none" | "incomplete" | "stale" | "current";
    evidenceDigest: string | null;
    unassessedExecutionIds: string[];
  };
  ready: boolean;
  blockers: string[];
  completion: {
    state: "open" | "verified" | "needs_reassessment";
    commandId: string | null;
    receiptId: string | null;
  };
};
