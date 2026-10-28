import type { ApplicationModelPin } from "./application-model.ts";
import type { Relationship } from "./model.ts";

export type VerificationCriterion = {
  id: string;
  field: string;
  start: number;
  end: number;
  quote: string;
};
export type VerificationMethodSelection = {
  entityId: string;
  version: number;
  relationship: { id: string; version: number };
  criterionIds: string[];
};
export type PrepareVerificationBasis = {
  model: ApplicationModelPin;
  requirement: { entityId: string; version: number };
  coverage: { kind: "complete" | "partial"; rationale: string };
  criteria: VerificationCriterion[];
  methods: VerificationMethodSelection[];
};
export type VerificationBasis = {
  contract: "verification_basis";
  version: 1;
  model: ApplicationModelPin;
  at: { projectRevision: number; schemaVersion: number; evidenceRevision: number };
  requirement: {
    entityId: string;
    version: number;
    title: string;
    statement: string;
    acceptance: Record<string, string>;
  };
  coverage: PrepareVerificationBasis["coverage"] & {
    sourceComplete: boolean;
    unassignedCriterionIds: string[];
  };
  criteria: VerificationCriterion[];
  methods: {
    entityId: string;
    version: number;
    title: string;
    procedure: string;
    expected: string;
    relationship: Relationship;
    criterionIds: string[];
  }[];
};
