import type { Entity, Relationship, SchemaObject } from "./model.ts";

/** A complete, bounded native project read at one committed revision. */
export type ProjectSnapshot = {
  schema: SchemaObject | null;
  projectRevision: number;
  entities: Entity[];
  relationships: Relationship[];
};

export const MAP_RECORD_LIMIT = 10_000;
export const MAP_CONNECTION_LIMIT = 100_000;
