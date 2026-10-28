import type { Fields } from "./model.ts";
import type { Json } from "./model.ts";
import type { PrepareVerificationBasis, VerificationBasis } from "./verification-basis.ts";
import type { ResolvedVerificationModel } from "./verification-model.ts";
import type { InputDeclaration, RelationshipDeclaration } from "./evidence.ts";

export const verificationCaseLimits = {
  priorReceiptBytes: 1048576,
  executions: 100,
  commandBytes: 131072,
  scopeBytes: 65536,
  viewBytes: 262144,
  executionBytes: 131072,
  responseBytes: 524288,
  supportInputs: 20,
} as const;
export type VerificationSelection = { caseId: string; openingCommandId: string };
export type VerificationGuards = {
  commandId: string;
  expectedSchemaVersion: number;
  expectedProjectRevision: number;
  expectedEvidenceRevision: number;
};
export type OpenVerificationCase = VerificationGuards & {
  caseId: string;
  membershipId: string;
  title: string;
  purpose: string;
  basis: PrepareVerificationBasis;
  additionalFields: Fields;
};
export type VerificationCaseScope = {
  contract: "verification_case_scope";
  version: 1;
  purpose: string;
  basis: VerificationBasis;
  membershipId: string;
  control: { commandId: string; openingCommandId: string };
};
export type VerificationExecutionRegistration = {
  executionId: string;
  membershipId: string;
  commandId: string;
};
export type VerificationOutcome = "passed" | "failed" | "blocked" | "not_run";
export type VerificationCriterionResult = {
  criterionId: string;
  outcome: VerificationOutcome;
  actual: string;
  rationale: string;
};
export type VerificationExecutionSource =
  { kind: "performed" } | { kind: "prior_receipt"; receiptId: string; rationale: string };
export type RecordVerificationExecution = VerificationGuards &
  VerificationSelection & {
    expectedCaseVersion: number;
    executionId: string;
    membershipId: string;
    title: string;
    methodId: string;
    source: VerificationExecutionSource;
    conditions: Json;
    results: VerificationCriterionResult[];
    inputs: InputDeclaration[];
    relationshipInputs: RelationshipDeclaration[];
    additionalFields: Fields;
  };
export type VerificationExecutionData = {
  contract: "verification_execution";
  version: 1;
  caseId: string;
  openingCommandId: string;
  commandId: string;
  methodId: string;
  methodVersion: number;
  membershipId: string;
  basisVersion: number;
  source: VerificationExecutionSource & { recordedAt?: string; actor?: string };
  conditions: Json;
  results: VerificationCriterionResult[];
};
export type VerificationCaseView = {
  case: { id: string; type: string; version: number; title: string; state: string };
  model: ResolvedVerificationModel;
  scope: VerificationCaseScope;
  opening: { commandId: string; receiptId: string };
  control: { commandId: string; receiptId: string; caseVersion: number };
  executions: VerificationExecutionRegistration[];
};
export type VerificationExecutionView = {
  caseId: string;
  openingCommandId: string;
  execution: {
    id: string;
    type: string;
    recordedVersion: number;
    currentVersion: number | null;
    title: string;
  };
  receiptId: string;
  membership: { id: string; currentVersion: number | null; current: boolean };
  data: VerificationExecutionData;
  comparison: { record: VerificationInputState; source: VerificationInputState | null };
};
export type VerificationInputState = {
  receiptId: string;
  state: "current" | "changed" | "unknown";
  hasChanged: boolean;
  hasUnknown: boolean;
  supersededByCount: number;
};
