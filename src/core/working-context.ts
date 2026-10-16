import type { Entity, Page, Relationship, SchemaObject } from "./model.ts";
import type { ComparedState, Comparison, Receipt } from "./evidence.ts";
import { record } from "./model.ts";

export type WorkingStep = {
  relationshipType: string;
  direction: "incoming" | "outgoing";
  type: string;
};
export type WorkingRoute = {
  key: string;
  label: string;
  steps: WorkingStep[];
  receipts: boolean;
};
/** Authored presentation recipe. It asserts no engineering implication or completeness rule. */
export type WorkingRecipe = {
  members?: WorkingStep;
  routes: WorkingRoute[];
};
export type WorkingTraceRequest = {
  rowId: string;
  routeKey: string;
  /** One-based route stage, or zero for a self route; omitted means the terminal stage. */
  stage?: number;
  after?: string;
  limit?: number;
};
export type WorkingContextQuery = {
  focusId: string;
  recipe: WorkingRecipe;
  after?: string;
  limit?: number;
  trace?: WorkingTraceRequest;
  receipts?: { after?: string; limit?: number };
};
export type WorkingPath = {
  entity: Entity;
  /** Exactly one deterministic recorded path, never every possible path to this identity. */
  entities: Entity[];
  relationships: Relationship[];
};
export type WorkingTrace = {
  rowId: string;
  routeKey: string;
  stage: number;
  stageCounts: number[];
  pathSelection: "one-per-identity";
  total: number;
  page: Page<WorkingPath>;
};
export type WorkingInputFact = {
  entityId: string;
  declared: boolean;
  capturedVersion?: number;
  comparison: Pick<ComparedState, "state" | "hasChanged" | "hasUnknown"> | null;
};
export type WorkingReceipt = {
  receipt: Pick<
    Receipt,
    "id" | "at" | "actor" | "reason" | "output" | "outcome" | "configuration" | "supersedes"
  >;
  inputCount: number;
  matches: {
    routes: { rowId: string; routeKey: string }[];
    inputIds: string[];
    /** Receipt output is the focus or one of the loaded rows; this is not an input declaration. */
    outputIds: string[];
  };
  /** Null means comparison work was not loaded, not an unknown or current comparison. */
  comparison: (ComparedState & { token: string; review: Comparison["review"] }) | null;
  comparisonUnavailable?: "input_budget";
  focus: WorkingInputFact;
  rows: WorkingInputFact[];
  supersession: { count: number; ids: string[] };
};
export type WorkingContext = {
  context: { projectRevision: number; schemaVersion: number; evidenceRevision: number };
  schema: SchemaObject;
  focus: Entity;
  recipe: WorkingRecipe;
  rows: {
    total: number;
    page: Page<{ entity: Entity; membership: Relationship[] }>;
  };
  traces: WorkingTrace[];
  receipts: {
    /** Related terminal outputs and actual declarations for focus + this loaded row page. */
    scope: "focus-and-loaded-rows";
    total: number;
    page: Page<WorkingReceipt>;
  };
};

function shape(value: unknown, keys: string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).every((key) => keys.includes(key));
}
function named(value: unknown, maximum = 120): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}
function validStep(value: unknown): value is WorkingStep {
  if (!shape(value, ["relationshipType", "direction", "type"])) return false;
  return named(value.relationshipType) && named(value.type) && validDirection(value.direction);
}
function validDirection(value: unknown) {
  return value === "incoming" || value === "outgoing";
}
function validSteps(value: unknown): value is WorkingStep[] {
  return Array.isArray(value) && value.length <= 4 && value.every(validStep);
}
function validRoute(value: unknown): value is WorkingRoute {
  if (!shape(value, ["key", "label", "steps", "receipts"])) return false;
  return validRouteNames(value) && validSteps(value.steps) && typeof value.receipts === "boolean";
}
function validRouteNames(value: Record<string, unknown>) {
  return named(value.key, 80) && named(value.label);
}
function validRoutes(value: unknown): value is WorkingRoute[] {
  if (!Array.isArray(value) || value.length > 4) return false;
  if (!value.every(validRoute)) return false;
  return new Set(value.map((route) => route.key)).size === value.length;
}
export function validWorkingRecipe(value: unknown): value is WorkingRecipe {
  if (!shape(value, ["members", "routes"])) return false;
  if (value.members !== undefined && !validStep(value.members)) return false;
  return validRoutes(value.routes);
}
