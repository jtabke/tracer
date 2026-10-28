import type { Entity, Relationship, SchemaObject, Provenance } from "./model.ts";
import type { Observation } from "./evidence.ts";

/** An exact native revision, resolved from history rather than a user-supplied snapshot. */
export type PinnedEntity = {
  entity: Entity;
  revisionId: string;
  changesetId: string;
  projectRevision: number;
  schema: SchemaObject;
};
export type ConfigurationInput = {
  name: string;
  subjectId: string;
  expectedSubjectVersion: number;
  members: { entityId: string; version: number }[];
  /** Explicit native connection revisions; omitted legacy captures contain members only. */
  relationships?: { relationshipId: string; version: number }[];
};
export type PinnedRelationship = {
  relationship: Relationship;
  revisionId: string;
  changesetId: string;
  projectRevision: number;
  schema: SchemaObject;
};
export type Configuration = Provenance & {
  id: string;
  at: string;
  name: string;
  subject: Entity;
  members: PinnedEntity[];
  relationships?: PinnedRelationship[];
  /** Absent on legacy native-only captures; absence never asserts content completeness. */
  capture?: ConfigurationCapture;
};

export type ConfigurationContentSelection = {
  entityId: string;
  /** Null deliberately records unknown/unselected content, with a required explanation. */
  observationId: string | null;
  reason?: string;
};
export type ExactConfigurationInput = ConfigurationInput & {
  id: string;
  relationships: NonNullable<ConfigurationInput["relationships"]>;
  content: ConfigurationContentSelection[];
  scope: { purpose: string; coverage: "complete" | "partial"; rationale: string };
  expectedSchemaVersion: number;
  expectedProjectRevision: number;
  expectedEvidenceRevision: number;
};
export type ConfigurationCapture = {
  contract: "configuration_capture";
  version: 1;
  /** Original invocation intent, including guards and array order, for exact identity recovery. */
  intent: ExactConfigurationInput;
  context: ConfigurationCaptureContext;
  content: { entityId: string; observation: Observation | null; reason?: string }[];
};
export type ConfigurationCaptureContext = {
  schema: SchemaObject;
  projectRevision: number;
  evidenceRevision: number;
};
