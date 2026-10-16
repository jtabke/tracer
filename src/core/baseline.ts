import type { Entity, Page, Provenance, Relationship, SchemaObject } from "./model.ts";

/** A named, complete native commit; evidence and presentation have independent histories. */
export type Baseline = Provenance & {
  id: string;
  name: string;
  projectRevision: number;
  changesetId: string;
  schemaVersion: number;
  capturedAtProjectRevision: number;
  at: string;
};
export type BaselineInput = {
  /** Optional stable caller identity makes identical retries safe after a lost response. */
  id?: string;
  name: string;
  expectedProjectRevision: number;
  projectRevision?: number;
};
export type BaselineQuery = { after?: string; limit?: number };
export type BaselineContentsQuery = BaselineQuery & {
  baselineId: string;
  kind: "entity" | "relationship";
};
export type BaselineContents = {
  baseline: Baseline;
  schema: SchemaObject;
  objects: Page<Entity | Relationship>;
};
