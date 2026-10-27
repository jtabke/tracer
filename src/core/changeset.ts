import type { Changeset, Entity, Relationship } from "./model.ts";

export type Deletion = { id: string; version: number; deleted: true };
/** Original committed result, including generated identities and ordered operation results. */
export type ChangesetResult = {
  changeset: Changeset;
  results: (Entity | Relationship | Deletion)[];
};
