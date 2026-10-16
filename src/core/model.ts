import { validWorkflow } from "./schema-workflow.ts";
import type { WorkflowConnection } from "./schema-workflow.ts";
import { validCoverageExpectations } from "./coverage.ts";
import type { CoverageExpectations } from "./coverage.ts";
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Fields = Record<string, Json>;
export type Field = { type: "string" | "number" | "boolean" | "json"; required?: boolean };
export type TypeDefinition = { fields: Record<string, Field> };
export type RelationshipDefinition = TypeDefinition & {
  source?: string[];
  target?: string[];
  workflow?: WorkflowConnection[];
};
export type Schema = {
  entityTypes: Record<string, TypeDefinition>;
  relationshipTypes: Record<string, RelationshipDefinition>;
  coverageExpectations?: CoverageExpectations;
};
export type Entity = { id: string; type: string; key?: string; fields: Fields; version: number };
export type Relationship = {
  id: string;
  type: string;
  source: string;
  target: string;
  fields: Fields;
  version: number;
};
export type SchemaObject = Schema & { id: "project"; version: number };
export type Kind = "schema" | "entity" | "relationship";
export type Stored = Entity | Relationship | SchemaObject;
export type Provenance = { actor: string; reason?: string };
export type Changeset = Provenance & {
  id: string;
  projectRevision: number;
  schemaVersion: number;
  at: string;
};
export type Revision = {
  revisionId: string;
  changesetId: string;
  projectRevision: number;
  ordinal: number;
  schemaVersion: number;
  kind: Kind;
  id: string;
  version: number;
  snapshot: Stored | null;
};
export type ErrorCode =
  | "validation"
  | "conflict"
  | "schema_conflict"
  | "not_found"
  | "referential_integrity"
  | "busy"
  | "storage"
  | "unsupported_storage"
  | "usage";
export type Page<T> = { items: T[]; nextAfter?: string };
export type PageQuery = { after?: string; limit?: number };
export type EntityQuery = PageQuery & { type?: string; key?: string; search?: string };
export type RelationshipQuery = PageQuery & {
  type?: string;
  source?: string;
  target?: string;
  incident?: string;
};
export type WorkingSetQuery = EntityQuery & {
  field?: string;
  value?: string;
  without?: string;
  targetType?: string;
};
/** Internal/legacy aggregate; public resource reads use their specific query contracts. */
export type ObjectQuery = WorkingSetQuery & RelationshipQuery;
export type ErrorDetails = {
  kind?: Kind;
  id?: string;
  expectedVersion?: number;
  actualVersion?: number;
  path?: (string | number)[];
};
export type HistoryQuery = { kind?: Kind; id?: string; after?: string; limit?: number };
export class TracerError extends Error {
  code: ErrorCode;
  readonly details?: ErrorDetails;
  constructor(code: ErrorCode, message: string, details?: ErrorDetails) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
export function ensure(
  condition: unknown,
  code: ErrorCode,
  message: string,
  details?: ErrorDetails,
): asserts condition {
  if (!condition) throw new TracerError(code, message, details);
}
export function validateProvenance(value: Provenance): Provenance {
  ensure(record(value), "validation", "Actor is required");
  const actor = provenanceProperty(value, "actor"),
    reason = provenanceProperty(value, "reason");
  ensure(
    typeof actor === "string" && json(actor) && actor.trim(),
    "validation",
    "Actor is required",
  );
  ensure(
    reason === undefined || (typeof reason === "string" && json(reason)),
    "validation",
    "Reason must be text",
  );
  return { actor, ...(reason === undefined ? {} : { reason }) };
}
function provenanceProperty(value: object, name: string): unknown {
  const property = Object.getOwnPropertyDescriptor(value, name);
  ensure(
    property === undefined || (Object.hasOwn(property, "value") && property.enumerable),
    "validation",
    "Provenance must use ordinary data properties",
  );
  return property?.value;
}
export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
// Check container shape without evaluating getters or traversing child values.
function jsonContainer(item: object) {
  if (!Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item)))
    return false;
  if (Object.getOwnPropertySymbols(item).length) return false;
  const keys = Object.keys(item);
  if (
    Array.isArray(item) &&
    (keys.length !== item.length || !keys.every((key, index) => key === String(index)))
  )
    return false;
  return true;
}

export function json(value: unknown): value is Json {
  const ancestors = new WeakSet<object>();
  const valid = (item: unknown): boolean => {
    if (item === null || typeof item === "boolean") return true;
    if (typeof item === "string") return !/[\uD800-\uDFFF]/u.test(item);
    if (typeof item === "number") return Number.isFinite(item);
    if (typeof item !== "object" || ancestors.has(item)) return false;
    if (!jsonContainer(item)) return false;
    const keys = Object.keys(item);
    ancestors.add(item);
    const result = keys.every((key) => {
      const property = Object.getOwnPropertyDescriptor(item, key)!;
      return !/[\uD800-\uDFFF]/u.test(key) && "value" in property && valid(property.value);
    });
    ancestors.delete(item);
    return result;
  };
  return valid(value);
}
export function validateSchema(value: unknown): asserts value is Schema {
  ensure(
    json(value) && record(value) && record(value.entityTypes) && record(value.relationshipTypes),
    "validation",
    "Schema needs entityTypes and relationshipTypes",
  );
  for (const definitions of [value.entityTypes, value.relationshipTypes]) {
    for (const [name, definition] of Object.entries(definitions)) {
      ensure(
        name.trim() && record(definition) && record(definition.fields),
        "validation",
        "Types need a name and fields",
      );
      for (const [name, field] of Object.entries(definition.fields)) {
        ensure(
          name.trim() &&
            record(field) &&
            typeof field.type === "string" &&
            ["string", "number", "boolean", "json"].includes(field.type) &&
            (field.required === undefined || typeof field.required === "boolean"),
          "validation",
          "Invalid field definition",
        );
      }
    }
  }
  for (const definition of Object.values(value.relationshipTypes)) {
    for (const constraint of ["source", "target"]) {
      const types = (definition as Record<string, unknown>)[constraint];
      ensure(
        types === undefined ||
          (Array.isArray(types) &&
            types.every(
              (type) =>
                typeof type === "string" && Object.hasOwn(value.entityTypes as object, type),
            )),
        "validation",
        "Endpoint constraint refers to an unknown entity type",
      );
    }
    ensure(
      validWorkflow(
        (definition as RelationshipDefinition).workflow,
        value.entityTypes as object,
        definition as RelationshipDefinition,
      ),
      "validation",
      "Workflow routes need declared endpoints, direction and a label; duplicate paths are not allowed",
    );
  }
  ensure(
    validCoverageExpectations(value.coverageExpectations, value as Schema),
    "validation",
    "Coverage expectations need declared types, compatible directions, primitive filters and positive distinct-target minimums",
  );
}
export function validateFields(
  definition: TypeDefinition | undefined,
  fields: unknown,
): asserts fields is Fields {
  ensure(definition, "validation", "Unknown type", { path: ["type"] });
  ensure(record(fields) && json(fields), "validation", "Fields must be a JSON object", {
    path: ["fields"],
  });
  for (const name of Object.keys(fields))
    ensure(Object.hasOwn(definition.fields, name), "validation", "Unknown field: " + name, {
      path: ["fields", name],
    });
  for (const [name, field] of Object.entries(definition.fields)) {
    const value = Object.hasOwn(fields, name) ? fields[name] : undefined;
    ensure(value !== undefined || !field.required, "validation", "Required field: " + name, {
      path: ["fields", name],
    });
    if (value !== undefined)
      ensure(
        field.type === "json" || typeof value === field.type,
        "validation",
        "Wrong field type: " + name,
        { path: ["fields", name] },
      );
  }
}
