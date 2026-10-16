import type { SchemaObject, Entity, Relationship, Page } from "../core/model.ts";
import type { Receipt, Comparison, ExternalIdentity, Observation } from "../core/evidence.ts";
export type GraphQuery = {
  rootId: string;
  expanded?: string[];
  depth?: number;
  atRevision?: number;
  compareRevision?: number;
};
export type NativeDelta<T> = {
  id: string;
  state: "added" | "removed" | "modified" | "unchanged";
  before: T | null;
  after: T | null;
};
export type Graph = {
  schema: SchemaObject;
  temporal?: {
    at: import("../core/model.ts").Changeset;
    before?: import("../core/model.ts").Changeset;
  };
  differences?: { nodes: NativeDelta<Entity>[]; links: NativeDelta<Relationship>[] };
  rootId: string;
  expanded: string[];
  trace?: { depth: number; frontier: string[] };
  nodes: Entity[];
  links: Relationship[];
  evaluations: { receipt: Receipt; comparison: Comparison }[];
  external: { identity: ExternalIdentity; observation: Observation | null }[];
};
export type FamilyQuery = {
  rootId: string;
  relationshipType?: string;
  direction?: "outgoing" | "incoming";
  after?: string;
  limit?: number;
};
export type FamilyWorkspace = {
  schema: SchemaObject;
  projectRevision: number;
  root: Entity;
  members: Entity[];
  membership: Relationship[];
  nextAfter?: string;
  connections: { entityId: string; total: number; loaded: number }[];
  nodes: Entity[];
  links: Relationship[];
};
export type WorkingSet = {
  schema: SchemaObject;
  entities: Page<Entity>;
  total: number;
  types: { type: string; count: number }[];
};
export type ConnectionsQuery = { id: string; type?: string; after?: string; limit?: number };
export type Connections = {
  schema: SchemaObject;
  entity: Entity;
  total: number;
  nextAfter?: string;
  items: { relationship: Relationship; source: Entity; target: Entity }[];
};
export type ChainStep = {
  type: string;
  relationshipType: string;
  direction?: "incoming" | "outgoing";
};
export type ChainQuery = {
  type: string;
  steps: ChainStep[];
  search?: string;
  after?: string;
  limit?: number;
};
export type ChainTable = {
  schema: SchemaObject;
  roots: Page<Entity>;
  rows: { cells: (Entity | null)[]; links: (Relationship | null)[] }[];
};
export type TableQuery = { type: string; after?: string; limit?: number; focusId?: string };
export type Table = { schema: SchemaObject; entities: Page<Entity> };
export type MatrixQuery = {
  sourceType: string;
  targetType: string;
  relationshipType: string;
  sourceFocus?: string;
  targetFocus?: string;
  sourceAfter?: string;
  targetAfter?: string;
  limit?: number;
};
export type Matrix = {
  schema: SchemaObject;
  sources: Page<Entity>;
  targets: Page<Entity>;
  links: Relationship[];
  missingSourceIds: string[];
};

export type EndpointSummary = { id: string; type: string; key?: string; title?: string };
export type RecordedConnectionsQuery = { type: string; after?: string; limit?: number };
export type RecordedConnections = {
  schema: SchemaObject;
  relationships: Page<Relationship>;
  endpoints: EndpointSummary[];
};
