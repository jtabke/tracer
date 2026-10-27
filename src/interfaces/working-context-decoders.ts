import { canonical } from "../core/evidence.ts";
import { validWorkingRecipe } from "../core/working-context.ts";
import type {
  WorkingContext,
  WorkingContextQuery,
  WorkingReceipt,
  WorkingRecipe,
  WorkingStep,
} from "../core/working-context.ts";
import type { Entity, Relationship, SchemaObject } from "../core/model.ts";
import type { Decoder } from "./decode.ts";
import {
  array,
  boolean,
  integer,
  literal,
  nullable,
  object,
  optional,
  page,
  text,
} from "./decode.ts";

function requireFact(condition: unknown): asserts condition {
  if (!condition) throw new Error("Invalid working context response");
}
const recipe: Decoder<WorkingRecipe> = (value) => {
  requireFact(validWorkingRecipe(value));
  return value;
};
const state = object({
  state: literal("current", "changed", "unknown"),
  hasChanged: boolean,
  hasUnknown: boolean,
});
const input = object({
  entityId: text,
  declared: boolean,
  capturedVersion: optional(integer(1)),
  comparison: nullable(state),
});

export function workingContextDecoder(
  schema: Decoder<SchemaObject>,
  entity: Decoder<Entity>,
  relationship: Decoder<Relationship>,
  comparison: Decoder<NonNullable<WorkingReceipt["comparison"]>>,
): Decoder<WorkingContext> {
  const receipt = object({
    receipt: object({
      id: text,
      at: text,
      actor: text,
      reason: optional(text),
      output: entity,
      outcome: text,
      configuration: optional(object({ id: text, name: text, subject: entity })),
      supersedes: optional(text),
    }),
    inputCount: integer(),
    matches: object({
      routes: array(object({ rowId: text, routeKey: text })),
      inputIds: array(text),
      outputIds: array(text),
    }),
    comparison: nullable(comparison),
    comparisonUnavailable: optional(literal("input_budget")),
    focus: input,
    rows: array(input),
    supersession: object({ count: integer(), ids: array(text) }),
  });
  const decode = object({
    context: object({
      projectRevision: integer(1),
      schemaVersion: integer(1),
      evidenceRevision: integer(),
    }),
    schema,
    focus: entity,
    recipe,
    rows: object({
      total: integer(),
      page: page(object({ entity, membership: array(relationship) })),
    }),
    traces: array(
      object({
        rowId: text,
        routeKey: text,
        stage: integer(),
        stageCounts: array(integer()),
        pathSelection: literal("one-per-identity"),
        total: integer(),
        page: page(object({ entity, entities: array(entity), relationships: array(relationship) })),
      }),
    ),
    receipts: object({
      scope: literal("focus-and-loaded-rows"),
      total: integer(),
      page: page(receipt),
    }),
  });
  return (value) => {
    const result = decode(value);
    validateContext(result);
    return result;
  };
}
function validateContext(value: WorkingContext) {
  requireFact(value.context.schemaVersion === value.schema.version);
  requireFact(value.rows.total >= value.rows.page.items.length);
  requireFact(value.receipts.total >= value.receipts.page.items.length);
  requireFact(value.rows.page.items.length <= 12);
  requireFact(value.receipts.page.items.length <= 20);
  distinct(value.rows.page.items.map((row) => row.entity.id));
  distinct(value.receipts.page.items.map((item) => item.receipt.id));
  validateSelfScope(value);
  validateTracePopulation(value);
  validateNativeSnapshots(value);
  value.rows.page.items.forEach((row) => validateMembership(value, row));
  value.traces.forEach((trace) => validateTrace(value, trace));
  value.receipts.page.items.forEach((receipt) => validateReceipt(value, receipt));
}
function distinct(ids: string[]) {
  requireFact(new Set(ids).size === ids.length);
}
function validateSelfScope(value: WorkingContext) {
  if (value.recipe.members) return;
  requireFact(value.rows.total === 1 && value.rows.page.items.length === 1);
  requireFact(value.rows.page.nextAfter === undefined);
}
function validateTracePopulation(value: WorkingContext) {
  const owners = value.traces.map((trace) => canonical([trace.rowId, trace.routeKey]));
  requireFact(owners.length === value.rows.page.items.length * value.recipe.routes.length);
  requireFact(new Set(owners).size === owners.length);
}
function validateNativeSnapshots(value: WorkingContext) {
  const snapshots = new Map<string, string>();
  const paths = value.traces.flatMap((trace) => trace.page.items);
  const entities = [value.focus, ...value.rows.page.items.map((row) => row.entity)];
  entities.push(...paths.flatMap((path) => [path.entity, ...path.entities]));
  entities.forEach((entity) => {
    const snapshot = canonical(entity);
    requireFact(!snapshots.has(entity.id) || snapshots.get(entity.id) === snapshot);
    snapshots.set(entity.id, snapshot);
  });
}
function validateMembership(
  value: WorkingContext,
  row: WorkingContext["rows"]["page"]["items"][number],
) {
  const step = value.recipe.members;
  if (!step) {
    requireFact(row.entity.id === value.focus.id && row.membership.length === 0);
    return;
  }
  requireFact(row.membership.length > 0);
  distinct(row.membership.map((link) => link.id));
  row.membership.forEach((link) => validateStep(link, value.focus, row.entity, step));
}
function validateTrace(value: WorkingContext, trace: WorkingContext["traces"][number]) {
  const route = value.recipe.routes.find((entry) => entry.key === trace.routeKey);
  requireFact(route);
  requireFact(value.rows.page.items.some((row) => row.entity.id === trace.rowId));
  requireFact(trace.stage <= route.steps.length);
  requireFact(route.steps.length === 0 || trace.stage > 0);
  requireFact(trace.stageCounts.length === route.steps.length);
  requireFact(trace.total >= trace.page.items.length);
  requireFact(trace.page.items.length <= 20);
  distinct(trace.page.items.map((path) => path.entity.id));
  requireFact(trace.total === (trace.stage === 0 ? 1 : trace.stageCounts[trace.stage - 1]));
  trace.page.items.forEach((path) => validatePath(path, trace, route.steps));
}
function validatePath(
  path: WorkingContext["traces"][number]["page"]["items"][number],
  trace: WorkingContext["traces"][number],
  steps: WorkingStep[],
) {
  requireFact(path.relationships.length === trace.stage);
  requireFact(path.entities.length === trace.stage + 1);
  requireFact(path.entities[0].id === trace.rowId);
  requireFact(path.entities.at(-1)!.id === path.entity.id);
  path.relationships.forEach((link, index) =>
    validateStep(link, path.entities[index], path.entities[index + 1], steps[index]),
  );
}
function validateStep(link: Relationship, from: Entity, to: Entity, step: WorkingStep) {
  requireFact(link.type === step.relationshipType && to.type === step.type);
  const [source, target] = step.direction === "outgoing" ? [from.id, to.id] : [to.id, from.id];
  requireFact(link.source === source && link.target === target);
}
function validateReceipt(value: WorkingContext, item: WorkingReceipt) {
  requireFact(item.focus.entityId === value.focus.id);
  requireFact(item.supersession.count >= item.supersession.ids.length);
  requireFact((item.comparison === null) === (item.comparisonUnavailable === "input_budget"));
  requireFact(item.rows.length === value.rows.page.items.length);
  validateOutputMatch(value, item);
  validateReceiptInclusion(value, item);
  item.rows.forEach((fact, index) =>
    requireFact(fact.entityId === value.rows.page.items[index].entity.id),
  );
  [item.focus, ...item.rows].forEach((fact) => validateInputFact(item, fact));
  if (item.comparison) validateComparison(item);
}
function validateReceiptInclusion(value: WorkingContext, item: WorkingReceipt) {
  const inputIds = item.matches.inputIds;
  const ids = new Set([value.focus.id, ...value.rows.page.items.map((row) => row.entity.id)]);
  requireFact(new Set(inputIds).size === inputIds.length);
  requireFact(inputIds.every((id) => ids.has(id)));
  const owners = item.matches.routes.map((match) => canonical([match.rowId, match.routeKey]));
  const permitted = receiptRouteOwners(value);
  requireFact(
    new Set(owners).size === owners.length && owners.every((owner) => permitted.has(owner)),
  );
  requireFact(inputIds.length + item.matches.outputIds.length + owners.length > 0);
}
function receiptRouteOwners(value: WorkingContext) {
  const routes = value.recipe.routes.filter((route) => route.receipts);
  return new Set(
    value.rows.page.items.flatMap((row) =>
      routes.map((route) => canonical([row.entity.id, route.key])),
    ),
  );
}
function validateOutputMatch(value: WorkingContext, item: WorkingReceipt) {
  const ids = [value.focus.id, ...value.rows.page.items.map((row) => row.entity.id)];
  const expected = ids.includes(item.receipt.output.id) ? [item.receipt.output.id] : [];
  requireFact(canonical(item.matches.outputIds) === canonical(expected));
}
function validateInputFact(item: WorkingReceipt, fact: WorkingReceipt["focus"]) {
  requireFact(fact.declared === item.matches.inputIds.includes(fact.entityId));
  requireFact(fact.declared || fact.capturedVersion === undefined);
  const loaded = fact.declared && item.comparison !== null;
  requireFact(loaded === (fact.comparison !== null));
  if (loaded) validateComparedInput(item, fact);
}
function validateComparedInput(item: WorkingReceipt, fact: WorkingReceipt["focus"]) {
  const inputs = item.comparison!.inputs.filter((input) => input.entityId === fact.entityId);
  requireFact(inputs.length > 0);
  const versions = new Set(inputs.map((input) => input.recorded.entity.version));
  const version = versions.size === 1 ? inputs[0].recorded.entity.version : undefined;
  requireFact(fact.capturedVersion === version);
  const hasUnknown = inputs.some((input) => input.hasUnknown);
  const hasChanged = inputs.some((input) => input.hasChanged);
  const expected = {
    state: hasUnknown ? "unknown" : hasChanged ? "changed" : "current",
    hasChanged,
    hasUnknown,
  };
  requireFact(canonical(fact.comparison) === canonical(expected));
}
function validateComparison(item: WorkingReceipt) {
  requireFact(item.comparison!.receiptId === item.receipt.id);
  requireFact(
    item.comparison!.inputs.length + (item.comparison!.relationshipInputs?.length ?? 0) ===
      item.inputCount,
  );
  requireFact(item.comparisonUnavailable === undefined);
}
export function validateWorkingContextScope(value: WorkingContext, query: WorkingContextQuery) {
  requireFact(value.focus.id === query.focusId);
  requireFact(canonical(value.recipe) === canonical(query.recipe));
  value.traces.forEach((trace) => {
    const route = query.recipe.routes.find((route) => route.key === trace.routeKey)!;
    const selected = query.trace?.rowId === trace.rowId && query.trace.routeKey === trace.routeKey;
    const stage = selected ? (query.trace!.stage ?? route.steps.length) : route.steps.length;
    requireFact(trace.stage === stage);
  });
}
