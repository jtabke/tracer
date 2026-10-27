import type { Fields, Provenance, Schema } from "../core/model.ts";
export type EntityInput = {
  type: string;
  key?: string;
  fields: Fields;
  resource?: import("../core/references.ts").Resource;
};
export type EntityEdit = {
  fields: Fields;
  key?: string;
  type?: string;
  resource?: import("../core/references.ts").Resource;
};
export type RelationshipInput = {
  type: string;
  source: string;
  target: string;
  fields: Fields;
  reference?: import("../core/references.ts").Reference;
};
export type ReferenceCreate = {
  op: "reference.create";
  id?: string;
  input: {
    type: string;
    source: string;
    sourceVersion: number;
    target?: string;
    targetVersion?: number;
    resource?: import("../core/references.ts").Resource;
    fields: Fields;
    reference: import("../core/references.ts").Reference;
  };
};
export type Operation =
  | ReferenceCreate
  | { op: "entity.create"; id?: string; input: EntityInput }
  | { op: "entity.update"; id: string; expectedVersion: number; input: EntityEdit }
  | { op: "entity.remove"; id: string; expectedVersion: number; cascade?: boolean }
  | {
      op: "relationship.create";
      id?: string;
      input: RelationshipInput;
      expectedEndpoints?: { sourceVersion: number; targetVersion: number };
      rejectExisting?: boolean;
    }
  | { op: "relationship.update"; id: string; expectedVersion: number; input: RelationshipInput }
  | { op: "relationship.remove"; id: string; expectedVersion: number };
export type ChangesetInput = {
  /** Stable project-scoped identity for recovering/repeating this exact command. */
  commandId?: string;
  expectedSchemaVersion: number;
  /** Optional exact native head captured by a reviewed proposal. */
  expectedProjectRevision?: number;
  operations: Operation[];
};
export type { Deletion } from "../core/changeset.ts";

export type WriteContext = { expectedSchemaVersion: number; provenance: Provenance };
export type CreateEntityCommand = EntityInput & WriteContext & { id?: string };
/** Fields replace the entire previous fields object; this is not a partial patch. */
export type UpdateEntityCommand = EntityEdit &
  WriteContext & { id: string; expectedVersion: number };
export type RemoveEntityCommand = WriteContext & {
  id: string;
  expectedVersion: number;
  cascade?: boolean;
};
export type CreateRelationshipCommand = RelationshipInput &
  WriteContext & {
    id?: string;
    expectedEndpoints?: { sourceVersion: number; targetVersion: number };
    rejectExisting?: boolean;
  };
export type UpdateRelationshipCommand = RelationshipInput &
  WriteContext & { id: string; expectedVersion: number };
export type RemoveRelationshipCommand = WriteContext & { id: string; expectedVersion: number };
export type SetSchemaCommand = {
  schema: Schema;
  expectedVersion: number;
  provenance: Provenance;
  initialViews?: import("../core/presentation.ts").InitialView[];
};
export type ChangesetCommand = ChangesetInput & { provenance: Provenance };
export type { ChangesetResult } from "../core/changeset.ts";
