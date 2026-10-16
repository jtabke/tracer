import { canonical } from "../core/evidence.ts";
import { ensure, json } from "../core/model.ts";
import type { Entity, SchemaObject } from "../core/model.ts";
import { validWorkingRecipe } from "../core/working-context.ts";
import type {
  WorkingContextQuery,
  WorkingRecipe,
  WorkingTraceRequest,
} from "../core/working-context.ts";
import { queryShape, validatePageLimit } from "./native-query-support.ts";
import { validateChainSteps } from "./chain.ts";
import { cursorOwner, cursorScope, parseWorkingCursor } from "./working-context-cursors.ts";
import type { WorkingCursor } from "./working-context-cursors.ts";

export type PreparedTrace = {
  request: WorkingTraceRequest;
  stage: number;
  limit: number;
  cursor?: WorkingCursor;
  owner: string;
};
export type PreparedWorkingQuery = {
  focusId: string;
  recipe: WorkingRecipe;
  scope: string;
  limit: number;
  after?: WorkingCursor;
  trace?: PreparedTrace;
  receiptLimit: number;
  receiptAfter?: WorkingCursor;
};
function workingIdentity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && validIdentity(value);
}
function validIdentity(value: string) {
  return value.length <= 200 && json(value);
}
function limit(value: number | undefined, fallback: number, maximum: number) {
  const selected = value === undefined ? fallback : value;
  validatePageLimit(selected, maximum, `Working page limit must be 1–${maximum}`);
  return selected;
}
function recipe(value: unknown): WorkingRecipe {
  ensure(validWorkingRecipe(value), "validation", "Invalid working recipe");
  const selected = {
    routes: value.routes,
    ...(value.members === undefined ? {} : { members: value.members }),
  };
  ensure(json(selected), "validation", "Working recipes need JSON-safe names");
  return selected;
}
function traceRequest(
  value: WorkingContextQuery["trace"],
  selected: WorkingRecipe,
  scope: string,
): PreparedTrace | undefined {
  if (value === undefined) return undefined;
  queryShape(
    value,
    ["rowId", "routeKey", "stage", "after", "limit"],
    "Invalid working trace request",
  );
  ensure(
    workingIdentity(value.rowId) && workingIdentity(value.routeKey),
    "validation",
    "Trace needs a loaded row and route",
  );
  const route = selected.routes.find((route) => route.key === value.routeKey);
  ensure(route, "validation", "Unknown working route");
  return preparedTrace(value, route.steps.length, scope);
}
function preparedTrace(request: WorkingTraceRequest, stages: number, scope: string): PreparedTrace {
  const stage = request.stage === undefined ? stages : request.stage;
  ensure(validStage(stage, stages), "validation", "Trace stage is outside the authored route");
  const cursor = parseWorkingCursor(request.after, "trace");
  const owner = canonical({ rowId: request.rowId, routeKey: request.routeKey, stage });
  cursorScope(cursor, scope);
  cursorOwner(cursor, owner);
  return { request, stage, limit: limit(request.limit, 3, 20), cursor, owner };
}
function validStage(stage: number, stages: number) {
  if (!Number.isSafeInteger(stage)) return false;
  return stages === 0 ? stage === 0 : positiveStage(stage, stages);
}
function positiveStage(stage: number, stages: number) {
  return stage >= 1 && stage <= stages;
}
function receiptRequest(value: WorkingContextQuery["receipts"], scope: string) {
  if (value === undefined) return { limit: 5, cursor: undefined };
  queryShape(value, ["after", "limit"], "Invalid working receipt page");
  const cursor = parseWorkingCursor(value.after, "receipts");
  cursorScope(cursor, scope);
  return { limit: limit(value.limit, 5, 20), cursor };
}
export function workingQuery(query: WorkingContextQuery): PreparedWorkingQuery {
  queryShape(
    query,
    ["focusId", "recipe", "after", "limit", "trace", "receipts"],
    "Invalid working-context query",
  );
  ensure(
    workingIdentity(query.focusId),
    "validation",
    "Working context needs a native focus identity",
  );
  const selected = recipe(query.recipe),
    scope = canonical({ focusId: query.focusId, recipe: selected });
  ensure(
    selected.members !== undefined || query.after === undefined,
    "validation",
    "A self scope has no row continuation",
  );
  const after = parseWorkingCursor(query.after, "rows"),
    receipts = receiptRequest(query.receipts, scope);
  cursorScope(after, scope);
  cursorOwner(after, "rows");
  return {
    focusId: query.focusId,
    recipe: selected,
    scope,
    limit: limit(query.limit, 6, 12),
    after,
    trace: traceRequest(query.trace, selected, scope),
    receiptLimit: receipts.limit,
    receiptAfter: receipts.cursor,
  };
}
export function validateWorkingRecipe(
  schema: SchemaObject,
  focus: Entity,
  selected: WorkingRecipe,
) {
  if (selected.members) validateChainSteps(schema, focus.type, [selected.members]);
  const rowType = selected.members?.type ?? focus.type;
  for (const route of selected.routes) validateChainSteps(schema, rowType, route.steps);
}
