import { ensure, json } from "../core/model.ts";
import type { SchemaObject } from "../core/model.ts";
import type { ChangeImpact, ChangeImpactQuery } from "../core/impact.ts";
import type { Transaction } from "../persistence/contracts.ts";
import { projectSchema, queryShape, validatePageLimit } from "./native-query-support.ts";

function identity(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && json(value);
}
function positiveRevision(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}
function selectedTypes(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 12 &&
    value.every(identity) &&
    new Set(value).size === value.length
  );
}
function cursorScope(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length === 5 &&
    identity(value[0]) &&
    identity(value[1]) &&
    ["incoming", "outgoing", "both"].includes(value[2]) &&
    selectedTypes(value[3]) &&
    Number.isSafeInteger(value[4]) &&
    value[4] >= 1 &&
    value[4] <= 6
  );
}
export function impactQuery(query: ChangeImpactQuery) {
  queryShape(
    query,
    [
      "baselineId",
      "rootId",
      "direction",
      "relationshipTypes",
      "depth",
      "expectedProjectRevision",
      "after",
      "limit",
    ],
    "Invalid impact query",
  );
  ensure(
    identity(query.rootId) && identity(query.baselineId),
    "validation",
    "Impact needs a baseline and native root identity",
  );
  ensure(
    ["incoming", "outgoing", "both"].includes(query.direction),
    "validation",
    "Choose a native impact direction",
  );
  ensure(
    selectedTypes(query.relationshipTypes),
    "validation",
    "Choose at most twelve distinct relationship types; an empty list selects the root only",
  );
  const depth = query.depth === undefined ? 2 : query.depth;
  ensure(
    Number.isSafeInteger(depth) && depth >= 1 && depth <= 6,
    "validation",
    "Impact depth must be 1–6",
  );
  const limit = query.limit === undefined ? 10 : query.limit;
  validatePageLimit(limit, 25, "Impact evaluation page limit must be 1–25");
  ensure(
    query.expectedProjectRevision === undefined || positiveRevision(query.expectedProjectRevision),
    "validation",
    "Expected project revision must be positive",
  );
  return {
    scope: {
      rootId: query.rootId,
      direction: query.direction,
      relationshipTypes: [...query.relationshipTypes].sort(),
      depth,
    },
    limit,
  };
}
export async function impactContext(
  tx: Transaction,
  query: ChangeImpactQuery,
): Promise<ChangeImpact["context"]> {
  const baseline = await tx.getBaseline(query.baselineId);
  ensure(baseline, "not_found", "Impact baseline not found");
  const beforeSchema = (await tx.getAt("schema", "project", baseline.projectRevision)) as
    SchemaObject | undefined;
  ensure(
    beforeSchema?.version === baseline.schemaVersion,
    "storage",
    "Impact baseline schema is unavailable",
  );
  const afterSchema = await projectSchema(tx),
    projectRevision = await tx.headRevision();
  return {
    baseline,
    beforeSchema,
    afterSchema,
    projectRevision,
    evidenceRevision: await tx.impactEvidenceRevision(),
  };
}
export function validateImpactTypes(
  scope: ChangeImpact["scope"],
  context: ChangeImpact["context"],
) {
  ensure(
    scope.relationshipTypes.every(
      (type) =>
        Object.hasOwn(context.beforeSchema.relationshipTypes, type) ||
        Object.hasOwn(context.afterSchema.relationshipTypes, type),
    ),
    "validation",
    "Impact relationship type is not declared in either snapshot",
  );
}
function scopeKey(scope: ChangeImpact["scope"], context: ChangeImpact["context"]) {
  return [context.baseline.id, scope.rootId, scope.direction, scope.relationshipTypes, scope.depth];
}
export function impactCursor(
  scope: ChangeImpact["scope"],
  context: ChangeImpact["context"],
  after: string,
) {
  return JSON.stringify([
    "impact-v1",
    scopeKey(scope, context),
    context.projectRevision,
    context.afterSchema.version,
    context.evidenceRevision,
    after,
  ]);
}
export function impactContinuation(
  scope: ChangeImpact["scope"],
  context: ChangeImpact["context"],
  after?: string,
) {
  if (after === undefined) return undefined;
  ensure(typeof after === "string" && after.length <= 8192, "validation", "Invalid impact cursor");
  let value: unknown;
  try {
    value = JSON.parse(after);
  } catch {
    ensure(false, "validation", "Invalid impact cursor");
  }
  ensure(
    Array.isArray(value) && value.length === 6 && value[0] === "impact-v1" && json(value),
    "validation",
    "Invalid impact cursor",
  );
  ensure(
    cursorScope(value[1]) &&
      positiveRevision(value[2]) &&
      positiveRevision(value[3]) &&
      Number.isSafeInteger(value[4]) &&
      Number(value[4]) >= 0,
    "validation",
    "Invalid impact cursor",
  );
  ensure(
    typeof value[5] === "string" &&
      /^[1-9]\d*$/.test(value[5]) &&
      Number.isSafeInteger(Number(value[5])),
    "validation",
    "Invalid impact evaluation cursor",
  );
  ensure(
    JSON.stringify(value[1]) === JSON.stringify(scopeKey(scope, context)),
    "validation",
    "Impact cursor belongs to a different investigation scope",
  );
  ensure(
    value[2] === context.projectRevision &&
      value[3] === context.afterSchema.version &&
      value[4] === context.evidenceRevision,
    "conflict",
    "Native or evidence snapshot changed; restart the impact investigation",
  );
  return value[5];
}
