import type { Baseline } from "./baseline.ts";
import type { Entity, Page, Relationship, Schema, SchemaObject } from "./model.ts";

export type CoverageFilter = { field: string; equals: string | number | boolean };
export type CoveragePopulation = { type: string; filter?: CoverageFilter };
/** Structural expectations are project-authored policy, not mandatory link permissions. */
export type CoverageExpectation = {
  name: string;
  subject: CoveragePopulation;
  relationshipType: string;
  direction: "incoming" | "outgoing";
  related: CoveragePopulation;
  minimumDistinctTargets: number;
};
export type CoverageExpectations = Record<string, CoverageExpectation>;
export type CoverageContext = {
  projectRevision: number;
  schemaVersion: number;
  baseline?: Baseline;
};
export type CoverageSet = { expectations: CoverageExpectations; expectedSchemaVersion: number };
export type CoverageListQuery = { baselineId?: string };
export type CoverageEvaluationQuery = CoverageListQuery & {
  expectationId: string;
  expectedProjectRevision?: number;
  after?: string;
  limit?: number;
};
export type CoverageSample = { related: Entity; relationship: Relationship };
export type CoverageNativeRow = {
  subject: Entity;
  distinctTargets: number | null;
  matchingRelationships: number | null;
  samples: CoverageSample[];
  samplesComplete: boolean;
  unresolvedRelationships: number;
};
export type CoverageNativeQuery = {
  expectation: CoverageExpectation;
  atRevision?: number;
  after?: string;
  limit: number;
};
export type CoverageRow = CoverageNativeRow & {
  state: "covered" | "missing" | "unknown";
  reason: string;
};
export type CoverageCatalogue = { context: CoverageContext; expectations: CoverageExpectations };
export type CoverageEvaluation = {
  context: CoverageContext;
  expectationId: string;
  expectation: CoverageExpectation;
  rows: Page<CoverageRow>;
  summary: { scope: "page"; evaluated: number; covered: number; missing: number; unknown: number };
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function shape(value: unknown, keys: string[]): value is Record<string, unknown> {
  return object(value) && Object.keys(value).every((key) => keys.includes(key));
}
function identifier(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= 80 && value.trim() === value
  );
}
function population(value: unknown, schema: Schema): value is CoveragePopulation {
  if (
    !shape(value, ["type", "filter"]) ||
    typeof value.type !== "string" ||
    !Object.hasOwn(schema.entityTypes, value.type)
  )
    return false;
  if (value.filter === undefined) return true;
  const filter = value.filter;
  if (!shape(filter, ["field", "equals"]) || typeof filter.field !== "string") return false;
  const fields = schema.entityTypes[value.type].fields;
  if (!Object.hasOwn(fields, filter.field)) return false;
  const kind = fields[filter.field].type;
  return ["string", "number", "boolean"].includes(kind) && typeof filter.equals === kind;
}
function endpoints(value: CoverageExpectation, schema: Schema) {
  if (!Object.hasOwn(schema.relationshipTypes, value.relationshipType)) return false;
  const definition = schema.relationshipTypes[value.relationshipType];
  const source = value.direction === "outgoing" ? value.subject.type : value.related.type;
  const target = value.direction === "outgoing" ? value.related.type : value.subject.type;
  return (
    (definition.source === undefined || definition.source.includes(source)) &&
    (definition.target === undefined || definition.target.includes(target))
  );
}
function definition(value: unknown): value is Record<string, unknown> {
  if (
    !shape(value, [
      "name",
      "subject",
      "relationshipType",
      "direction",
      "related",
      "minimumDistinctTargets",
    ])
  )
    return false;
  return typeof value.name === "string" && !!value.name.trim() && value.name.length <= 120;
}
function expectation(value: unknown, schema: Schema): value is CoverageExpectation {
  if (!definition(value)) return false;
  if (!population(value.subject, schema) || !population(value.related, schema)) return false;
  if (
    typeof value.relationshipType !== "string" ||
    (value.direction !== "incoming" && value.direction !== "outgoing")
  )
    return false;
  return (
    positiveCount(value.minimumDistinctTargets) && endpoints(value as CoverageExpectation, schema)
  );
}
function positiveCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
/** Called after JSON safety and structural schema validation, never executes authored code. */
export function validCoverageExpectations(value: unknown, schema: Schema | SchemaObject) {
  if (value === undefined) return true;
  return (
    object(value) &&
    Object.keys(value).length <= 100 &&
    Object.entries(value).every(([id, rule]) => identifier(id) && expectation(rule, schema))
  );
}
