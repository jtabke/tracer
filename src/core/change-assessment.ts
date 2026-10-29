import type { ApplicationModelPin } from "./application-model.ts";
import type { ChangeImpact, ChangeImpactQuery, ImpactReceipt } from "./impact.ts";
import type { Fields } from "./model.ts";
import type { ResolvedApplicationModel } from "./application-model.ts";
import type { AssessmentDecision } from "./application-model.ts";
import type { InputDeclaration, RelationshipDeclaration } from "./evidence.ts";
import type { ConfigurationComparison } from "./configuration-comparison.ts";

export const changeAssessmentLimits = { candidates: 25, scopeBytes: 65536, viewBytes: 262144 };
export type AssessmentBaselineQuery = Pick<
  ChangeImpactQuery,
  "baselineId" | "rootId" | "direction" | "relationshipTypes" | "depth"
>;
export type AssessmentPairQuery = Omit<AssessmentBaselineQuery, "baselineId"> & {
  source: "configuration_pair";
  beforeId: string;
  afterId: string;
  policy: "scoped-reference-dependencies-v1";
};
export type AssessmentScopeQuery = AssessmentBaselineQuery | AssessmentPairQuery;
export function isPairAssessmentQuery(query: AssessmentScopeQuery): query is AssessmentPairQuery {
  return "source" in query && query.source === "configuration_pair";
}
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
type ScopeClock = { projectRevision: number; evidenceRevision: number; schemaVersion: number };
type ScopeTraversal = {
  complete: true;
  excludedReceiptOutputId: string;
  before: ChangeImpact["native"]["before"];
  after: ChangeImpact["native"]["after"];
};
type ScopeSource =
  | {
      version: 1;
      query: AssessmentBaselineQuery & { depth: number };
      basis: ScopeClock & { baselineRevision: number };
      discovery: ScopeTraversal & { interpretation: "selected_traversal" };
    }
  | {
      version: 2;
      query: AssessmentPairQuery & { depth: number };
      basis: ScopeClock & { pair: ConfigurationComparison["basis"] };
      discovery: ScopeTraversal & {
        interpretation: "selected_configuration_pair";
        comparability: ConfigurationComparison["comparability"];
      };
    };
export type AssessmentScope = ScopeSource & {
  contract: "change_assessment_scope";
  purpose: string;
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
export function assessmentCandidateKey(value: CandidateKey) {
  return value.kind + ":" + value.id;
}
export type DispositionRegistration = {
  subject: CandidateKey;
  id: string;
  membershipId: string;
  commandId: string;
};
export type SupportReference =
  | ((
      | { kind: "entity" | "relationship"; id: string; version: number }
      | { kind: "receipt" | "observation"; id: string }
    ) & { mode: "historical" | "current" })
  | { kind: "receipt"; id: string; mode: "configuration"; configurationId: string };
export type AssessmentAction = {
  id: string;
  kind: "revise" | "reverify" | "investigate";
  title: string;
  state: "open" | "done" | "waived";
  resolution: string;
  support: SupportReference[];
};
export type AssessmentPairContext = {
  query: AssessmentPairQuery & { depth: number };
  pairDigest: string;
};
export type CapturedBasis = {
  contract: "assessment_basis";
  digest: string;
  hasUnknown: boolean;
  at: { projectRevision: number; evidenceRevision: number };
  inputs: InputDeclaration[];
  relationshipInputs: RelationshipDeclaration[];
  absences: CandidateKey[];
} & ({ version: 1 } | { version: 2; context: AssessmentPairContext });
export type ResolvedSupport = CapturedBasis & {
  reference: SupportReference;
  applicability?: "applicable" | "not_applicable" | "unknown";
};
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
