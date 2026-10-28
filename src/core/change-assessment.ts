import type { ApplicationModelPin } from "./application-model.ts";
import type { ChangeImpact, ChangeImpactQuery, ImpactReceipt } from "./impact.ts";
import type { Fields } from "./model.ts";
import type { ResolvedApplicationModel } from "./application-model.ts";
import type { AssessmentDecision } from "./application-model.ts";
import type { InputDeclaration, RelationshipDeclaration } from "./evidence.ts";

export const changeAssessmentLimits = { candidates: 25, scopeBytes: 65536, viewBytes: 262144 };
export type AssessmentScopeQuery = Pick<
  ChangeImpactQuery,
  "baselineId" | "rootId" | "direction" | "relationshipTypes" | "depth"
>;
export type OpenChangeAssessment = {
  commandId: string;
  assessmentId: string;
  title: string;
  purpose: string;
  model: ApplicationModelPin;
  query: AssessmentScopeQuery;
  additionalFields: Fields;
  expectedSchemaVersion: number;
  expectedProjectRevision: number;
  expectedEvidenceRevision: number;
};
export type AssessmentNativeCandidate = {
  kind: "entity" | "relationship";
  id: string;
  change: "added" | "removed" | "modified" | "unchanged";
  beforeVersion: number | null;
  version: number | null;
  observationId?: string | null;
};
export type AssessmentReceiptCandidate = {
  kind: "receipt";
  id: string;
  contentIds?: string[];
  scope: ImpactReceipt["scope"];
  supersession: ImpactReceipt["supersession"];
  inputs: {
    entityId: string;
    version: number | null;
    observationId: string | null;
    links: { id: string; version: number | null }[];
  }[];
  relationshipInputs: { id: string; version: number | null }[];
};
export type AssessmentScope = {
  contract: "change_assessment_scope";
  version: 1;
  purpose: string;
  query: AssessmentScopeQuery & { depth: number };
  basis: {
    projectRevision: number;
    evidenceRevision: number;
    schemaVersion: number;
    baselineRevision: number;
  };
  discovery: {
    complete: true;
    interpretation: "selected_traversal";
    excludedReceiptOutputId: string;
    before: ChangeImpact["native"]["before"];
    after: ChangeImpact["native"]["after"];
  };
  candidates: (AssessmentNativeCandidate | AssessmentReceiptCandidate)[];
  /** Additive metadata; original openings have neither property. */
  control?: { commandId: string; openingCommandId: string };
  retained?: {
    kind: AssessmentScope["candidates"][number]["kind"];
    id: string;
    basis: AssessmentScope["basis"];
  }[];
  refresh?: { reason: string; previousAssessmentVersion: number };
  dispositions?: DispositionRegistration[];
  reopened?: { fromCommandId: string; reason: string };
};

export type CandidateKey = { kind: "entity" | "relationship" | "receipt"; id: string };
export type DispositionRegistration = {
  subject: CandidateKey;
  id: string;
  membershipId: string;
  commandId: string;
};
export type SupportReference = (
  | { kind: "entity" | "relationship"; id: string; version: number }
  | { kind: "receipt" | "observation"; id: string }
) & { mode: "historical" | "current" };
export type AssessmentAction = {
  id: string;
  kind: "revise" | "reverify" | "investigate";
  title: string;
  state: "open" | "done" | "waived";
  resolution: string;
  support: SupportReference[];
};
export type CapturedBasis = {
  contract: "assessment_basis";
  version: 1;
  digest: string;
  hasUnknown: boolean;
  at: { projectRevision: number; evidenceRevision: number };
  inputs: InputDeclaration[];
  relationshipInputs: RelationshipDeclaration[];
  absences: CandidateKey[];
};
export type ResolvedSupport = CapturedBasis & { reference: SupportReference };
export type DispositionData = {
  subject: CandidateKey;
  basis: CapturedBasis;
  support: ResolvedSupport[];
  actionSupport: { id: string; support: ResolvedSupport[] }[];
};
export type DispositionView = {
  assessment: AssessmentSelection;
  id: string;
  version: number;
  membershipId: string;
  title: string;
  decision: AssessmentDecision;
  rationale: string;
  actions: AssessmentAction[];
  data: DispositionData;
};
export type SetAssessmentDisposition = Omit<RefreshChangeAssessment, "reason"> & {
  subject: CandidateKey;
  dispositionId: string;
  membershipId: string;
  expectedDispositionVersion: number;
  expectedBasisDigest: string;
  title: string;
  decision: AssessmentDecision;
  rationale: string;
  actions: AssessmentAction[];
  support: SupportReference[];
  additionalFields: Fields;
};
export type AssessmentObligation = {
  subject: CandidateKey;
  /** Bounded presentation context; never part of the assessed fingerprint. */
  label?: string;
  currentDigest: string;
  hasUnknown: boolean;
  disposition: {
    id: string;
    version: number;
    membershipId: string;
    decision: AssessmentDecision;
    rationalePreview: string;
  } | null;
  state: "undisposed" | "open_actions" | "stale_basis" | "unknown" | "accounted";
  openActions: number;
  waivedActions: number;
};
export type AssessmentAnalysis = {
  view: ChangeAssessmentView;
  obligations: AssessmentObligation[];
  discovery: "current" | "changed" | "unknown";
  discoveryReason: string | null;
  completion: { state: "open" | "completed" | "needs_reassessment"; receiptId: string | null };
};
export type AssessmentClosure = {
  contract: "change_assessment_closure";
  version: 1;
  commandId: string;
  openingCommandId: string;
  rationale: string;
  at: { projectRevision: number; evidenceRevision: number };
  population: { subject: CandidateKey; digest: string }[];
  judgments: {
    id: string;
    version: number;
    membershipId: string;
    membershipVersion: number;
    digest: string;
  }[];
};
export type AssessmentOperation = Extract<
  import("./evaluation-command.ts").ApplicationOperation,
  `change-assessment.${string}`
>;

export type AssessmentSelection = { assessmentId: string; openingCommandId: string };
export type RefreshChangeAssessment = AssessmentSelection & {
  commandId: string;
  expectedSchemaVersion: number;
  expectedProjectRevision: number;
  expectedEvidenceRevision: number;
  expectedAssessmentVersion: number;
  reason: string;
};
export type ChangeAssessmentView = {
  assessment: { id: string; type: string; version: number; title: string; state: string };
  model: ResolvedApplicationModel;
  opening: { commandId: string; receiptId: string };
  control: { commandId: string; receiptId: string; assessmentVersion: number };
  scope: AssessmentScope;
};
