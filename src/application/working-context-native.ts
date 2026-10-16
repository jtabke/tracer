import { canonical } from "../core/evidence.ts";
import { ensure } from "../core/model.ts";
import type { Entity, Relationship } from "../core/model.ts";
import type { WorkingContext, WorkingRoute, WorkingTrace } from "../core/working-context.ts";
import type { Transaction } from "../persistence/contracts.ts";
import type { PreparedWorkingQuery, PreparedTrace } from "./working-context-query.ts";
import { cursorOwner, workingCursor } from "./working-context-cursors.ts";

type Context = WorkingContext["context"];
export type RouteMatch = { rowId: string; routeKey: string; outputs: Set<string> };
export type RoutesProjection = {
  traces: WorkingTrace[];
  matches: RouteMatch[];
  outputs: Set<string>;
};
export async function workingRows(
  tx: Transaction,
  query: PreparedWorkingQuery,
  context: Context,
): Promise<WorkingContext["rows"]> {
  const steps = query.recipe.members ? [query.recipe.members] : [];
  const page = await tx.workingRoute({
    focusId: query.focusId,
    steps,
    after: query.after?.position,
    limit: query.limit,
  });
  const membership = await membershipLinks(
    tx,
    query,
    page.items.map((item) => item.entity.id),
  );
  return {
    total: page.total,
    page: {
      items: page.items.map((path) => ({
        entity: path.entity,
        membership: membershipFor(path.entity.id, membership, query.recipe.members?.direction),
      })),
      ...(page.nextAfter
        ? { nextAfter: workingCursor("rows", query.scope, "rows", context, page.nextAfter) }
        : {}),
    },
  };
}
async function membershipLinks(tx: Transaction, query: PreparedWorkingQuery, memberIds: string[]) {
  if (!query.recipe.members) return [];
  const page = await tx.workingMembership({
    focusId: query.focusId,
    step: query.recipe.members,
    memberIds,
    limit: 200,
  });
  ensure(
    !page.nextAfter,
    "validation",
    "Working rows exceed 200 parallel membership links; reduce the row page limit",
  );
  return page.items;
}
function membershipFor(id: string, links: Relationship[], direction?: "incoming" | "outgoing") {
  const endpoint = direction === "incoming" ? "source" : "target";
  return links.filter((link) => link[endpoint] === id);
}
function requestedTrace(
  query: PreparedWorkingQuery,
  row: Entity,
  route: WorkingRoute,
): PreparedTrace | undefined {
  if (query.trace?.request.rowId !== row.id) return undefined;
  return query.trace.request.routeKey === route.key ? query.trace : undefined;
}
async function stageCounts(tx: Transaction, row: Entity, route: WorkingRoute) {
  const counts: number[] = [],
    outputs = new Set<string>();
  for (let stage = 1; stage <= route.steps.length; stage++) {
    const terminal = stage === route.steps.length;
    const page = await tx.workingRouteIds({
      focusId: row.id,
      steps: route.steps.slice(0, stage),
      limit: route.receipts && terminal ? 200 : 1,
    });
    counts.push(page.total);
    if (route.receipts && terminal) addTerminalOutputs(outputs, page);
  }
  if (route.steps.length === 0) outputs.add(row.id);
  return { counts, outputs };
}
function addTerminalOutputs(
  outputs: Set<string>,
  page: { total: number; ids: string[]; nextAfter?: string },
) {
  ensure(
    page.total <= 200,
    "validation",
    "Receipt route exceeds 200 outputs; narrow the recipe or row page",
  );
  ensure(!page.nextAfter, "validation", "Receipt route output lookup is incomplete");
  page.ids.forEach((id) => outputs.add(id));
}
async function trace(
  tx: Transaction,
  query: PreparedWorkingQuery,
  context: Context,
  row: Entity,
  route: WorkingRoute,
) {
  const selected = requestedTrace(query, row, route),
    stage = selected?.stage ?? route.steps.length;
  const summary = await stageCounts(tx, row, route);
  const page = await tx.workingRoute({
    focusId: row.id,
    steps: route.steps.slice(0, stage),
    after: selected?.cursor?.position,
    limit: selected?.limit ?? 3,
  });
  const owner = canonical({ rowId: row.id, routeKey: route.key, stage });
  const result: WorkingTrace = {
    rowId: row.id,
    routeKey: route.key,
    stage,
    stageCounts: summary.counts,
    pathSelection: "one-per-identity",
    total: page.total,
    page: {
      items: page.items.map((path) => ({
        entity: path.entity,
        entities: path.nodes,
        relationships: path.links,
      })),
      ...(page.nextAfter
        ? { nextAfter: workingCursor("trace", query.scope, owner, context, page.nextAfter) }
        : {}),
    },
  };
  return { trace: result, outputs: summary.outputs };
}
function mergeOutputs(target: Set<string>, source: Set<string>) {
  source.forEach((id) => target.add(id));
  ensure(
    target.size <= 200,
    "validation",
    "Working receipt context exceeds 200 selected output identities; narrow the recipe or row page",
  );
}
export async function workingTraces(
  tx: Transaction,
  query: PreparedWorkingQuery,
  context: Context,
  rows: Entity[],
): Promise<RoutesProjection> {
  const projection: RoutesProjection = {
    traces: [],
    matches: [],
    outputs: new Set([query.focusId, ...rows.map((row) => row.id)]),
  };
  validateTraceRow(query, rows);
  for (const row of rows)
    for (const route of query.recipe.routes) {
      const value = await trace(tx, query, context, row, route);
      projection.traces.push(value.trace);
      if (route.receipts) {
        mergeOutputs(projection.outputs, value.outputs);
        projection.matches.push({ rowId: row.id, routeKey: route.key, outputs: value.outputs });
      }
    }
  return projection;
}
function validateTraceRow(query: PreparedWorkingQuery, rows: Entity[]) {
  if (!query.trace) return;
  ensure(
    rows.some((row) => row.id === query.trace!.request.rowId),
    "validation",
    "Requested trace row is outside the loaded row page",
  );
}
export function receiptOwner(query: PreparedWorkingQuery, rows: Entity[]) {
  const owner = canonical({ rowIds: rows.map((row) => row.id).sort() });
  cursorOwner(query.receiptAfter, owner);
  return owner;
}
