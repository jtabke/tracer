import type { Baseline } from "./baseline.ts";
import type { ComparedState, Receipt } from "./evidence.ts";
import type { Entity, Page, Relationship, SchemaObject } from "./model.ts";

export type ImpactDirection = "incoming" | "outgoing" | "both";
export type ChangeImpactQuery = {
  baselineId: string;
  rootId: string;
  direction: ImpactDirection;
  relationshipTypes: string[];
  depth?: number;
  expectedProjectRevision?: number;
  after?: string;
  limit?: number;
};
export type ImpactIncidentQuery = {
  id: string;
  direction: ImpactDirection;
  relationshipTypes: string[];
  atRevision?: number;
  limit: number;
};
export type ImpactReceiptQuery = {
  entityIds: string[];
  relationshipIds: string[];
  after?: string;
  limit: number;
  /** Exclude one output before paging, for nonrecursive application discovery. */
  excludeOutputId?: string;
};
export type ImpactDelta<T> = {
  id: string;
  state: "added" | "removed" | "modified" | "unchanged";
  before: T | null;
  after: T | null;
};
export type ImpactReachability = {
  /** One deterministic shortest selected path per identity, not an enumeration of all paths. */
  paths: { entityId: string; depth: number; relationshipIds: string[] }[];
  expandedIds: string[];
  /** Reached but deliberately not expanded at the depth boundary; not proof of more edges. */
  frontierIds: string[];
};
export type ImpactReceipt = {
  receipt: Receipt;
  /** Receipt capture versus current inputs, independent of the native baseline. */
  comparison: ComparedState;
  scope: {
    /** Matching declarations, including link-only matches with an out-of-scope terminal. */
    inputIds: string[];
    relationshipIds: string[];
    state: ComparedState["state"];
    hasChanged: boolean;
    hasUnknown: boolean;
  };
  supersession: { count: number; ids: string[] };
};
export type ChangeImpact = {
  context: {
    baseline: Baseline;
    beforeSchema: SchemaObject;
    afterSchema: SchemaObject;
    projectRevision: number;
    evidenceRevision: number;
  };
  scope: {
    rootId: string;
    direction: ImpactDirection;
    relationshipTypes: string[];
    depth: number;
  };
  native: {
    entities: ImpactDelta<Entity>[];
    relationships: ImpactDelta<Relationship>[];
    before: ImpactReachability;
    after: ImpactReachability;
  };
  evaluations: Page<ImpactReceipt>;
  summary: { scope: "page"; evaluated: number; current: number; changed: number; unknown: number };
};
