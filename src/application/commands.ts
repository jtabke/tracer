import type { Fields, Provenance, Schema, Changeset } from "../core/model.ts";
export type EntityInput = { type: string; key?: string; fields: Fields };
export type EntityEdit = { fields: Fields; key?: string };
export type RelationshipInput = { type: string; source: string; target: string; fields: Fields };
export type Operation =
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
export type ChangesetInput = { expectedSchemaVersion: number; operations: Operation[] };
export type Deletion = { id: string; version: number; deleted: true };

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
export type SetSchemaCommand = { schema: Schema; expectedVersion: number; provenance: Provenance };
export type ChangesetCommand = ChangesetInput & { provenance: Provenance };
export type ChangesetResult = {
  changeset: Changeset;
  results: (
    import("../core/model.ts").Entity | import("../core/model.ts").Relationship | Deletion
  )[];
};
