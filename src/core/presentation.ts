import { ensure, json, record } from "./model.ts";

export type TraceColumn = {
  relationshipType: string;
  targetType: string;
  direction: "incoming" | "outgoing";
};
/** Column identity depends on its meaning, never object property insertion order. */
export function traceColumnKey(value: TraceColumn): string {
  return JSON.stringify([value.relationshipType, value.targetType, value.direction]);
}
export type FamilyView = {
  kind: "family";
  rootId: string;
  relationshipType?: string;
  direction: "incoming" | "outgoing";
  layout: "trace" | "graph" | "relationships" | "coverage" | "reading";
  columns: TraceColumn[];
};
export type ChainView = {
  kind: "chain";
  type: string;
  search?: string;
  steps: { type: string; relationshipType: string; direction: "incoming" | "outgoing" }[];
};
export type ViewDefinition = FamilyView | ChainView;
export type SavedView = { id: string; name: string; version: number; definition: ViewDefinition };

function keys(value: unknown, allowed: string[]): asserts value is Record<string, unknown> {
  ensure(
    record(value) && Object.keys(value).every((key) => allowed.includes(key)),
    "validation",
    "Invalid saved view fields",
  );
}
function text(value: unknown): string {
  ensure(
    typeof value === "string" && value.trim().length > 0 && value.length <= 200,
    "validation",
    "Saved view names and identifiers must be nonempty text of at most 200 characters",
  );
  return value;
}
function direction(value: unknown): TraceColumn["direction"] {
  ensure(
    value === undefined || value === "incoming" || value === "outgoing",
    "validation",
    "Invalid saved view direction",
  );
  return value ?? "outgoing";
}
function column(value: unknown): TraceColumn {
  keys(value, ["relationshipType", "targetType", "direction"]);
  return {
    relationshipType: text(value.relationshipType),
    targetType: text(value.targetType),
    direction: direction(value.direction),
  };
}
function family(value: Record<string, unknown>): FamilyView {
  keys(value, ["kind", "rootId", "relationshipType", "direction", "layout", "columns"]);
  ensure(
    ["trace", "graph", "relationships", "coverage", "reading"].includes(String(value.layout)) &&
      Array.isArray(value.columns) &&
      value.columns.length <= 6,
    "validation",
    "Choose a family layout and at most six trace columns",
  );
  const columns = (value.columns as unknown[]).map(column);
  ensure(
    new Set(columns.map(traceColumnKey)).size === columns.length,
    "validation",
    "Duplicate trace columns",
  );
  return {
    kind: "family",
    rootId: text(value.rootId),
    ...(value.relationshipType === undefined
      ? {}
      : { relationshipType: text(value.relationshipType) }),
    direction: direction(value.direction),
    layout: value.layout as FamilyView["layout"],
    columns,
  };
}
function chain(value: Record<string, unknown>): ChainView {
  keys(value, ["kind", "type", "search", "steps"]);
  ensure(
    Array.isArray(value.steps) && value.steps.length <= 7,
    "validation",
    "Choose at most eight chain columns",
  );
  return {
    kind: "chain",
    type: text(value.type),
    ...(value.search === undefined ? {} : normalizedSearch(value.search)),
    steps: value.steps.map((value) => {
      keys(value, ["type", "relationshipType", "direction"]);
      return {
        type: text(value.type),
        relationshipType: text(value.relationshipType),
        direction: direction(value.direction),
      };
    }),
  };
}
/** Presentation scopes are bounded current-data recipes, never snapshots or engineering objects. */
export function viewDefinition(value: unknown): ViewDefinition {
  ensure(json(value), "validation", "Saved views need JSON-safe data");
  keys(value, [
    "kind",
    "rootId",
    "relationshipType",
    "direction",
    "layout",
    "columns",
    "type",
    "search",
    "steps",
  ]);
  if (value.kind === "family") return family(value);
  ensure(value.kind === "chain", "validation", "Choose a family or chain view");
  return chain(value);
}

function normalizedSearch(value: unknown): { search?: string } {
  ensure(
    typeof value === "string" && value.length <= 200,
    "validation",
    "Saved search supports at most 200 characters",
  );
  return value.trim() ? { search: value.trim() } : {};
}
