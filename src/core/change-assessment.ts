import type { ApplicationModelPin } from "./application-model.ts";
import type { ChangeImpact, ChangeImpactQuery, ImpactReceipt } from "./impact.ts";
import type { Fields } from "./model.ts";
import type { ResolvedApplicationModel } from "./application-model.ts";

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
};

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
