import type { Entity, Relationship, SchemaObject, Provenance } from "./model.ts";

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
};
