import type {
  RelationshipDefinition,
  Schema,
  SchemaObject,
  TypeDefinition,
} from "../src/core/model.ts";
import { validateSchema } from "../src/core/model.ts";

export const emptySchema: Schema = { entityTypes: {}, relationshipTypes: {} };
export function nativeDraft(schema: Schema | SchemaObject): Schema {
  const draft = structuredClone(schema) as Schema & { id?: string; version?: number };
  delete draft.id;
  delete draft.version;
  return draft;
}
export function parseDraft(text: string): Schema {
  const value: unknown = JSON.parse(text);
  validateSchema(value);
  return value;
}
export function endpointSummary(types: string[] | undefined, side: "source" | "target") {
  return types === undefined
    ? "Any configured type"
    : types.length
      ? `One of: ${types.join(", ")}`
      : `No ${side} types allowed`;
}
function definitionChanges(
  base: Schema["entityTypes"],
  draft: Schema["entityTypes"],
  kind: string,
) {
  const changes: string[] = [];
  for (const [name, definition] of Object.entries(draft)) {
    if (!Object.hasOwn(base, name)) changes.push(`Add ${kind}: ${name}`);
    else if (JSON.stringify(base[name]) !== JSON.stringify(definition))
      changes.push(...changedDefinition(name, base[name], definition));
  }
  for (const name of Object.keys(base))
    if (!Object.hasOwn(draft, name)) changes.push(`Remove ${kind}: ${name}`);
  return changes;
}
function changedDefinition(name: string, base: TypeDefinition, draft: TypeDefinition) {
  const fields = new Set([...Object.keys(base.fields), ...Object.keys(draft.fields)]);
  const changed = [...fields].filter(
    (field) => JSON.stringify(base.fields[field]) !== JSON.stringify(draft.fields[field]),
  );
  const changes = changed.map((field) => `${name}: changed field ${field}`);
  for (const side of ["source", "target"] as const) {
    if (
      JSON.stringify((base as RelationshipDefinition)[side]) !==
      JSON.stringify((draft as RelationshipDefinition)[side])
    )
      changes.push(`${name}: changed ${side} constraints`);
  }
  if (!changes.length) changes.push(`${name}: changed native definition properties`);
  return changes;
}
export function pendingChanges(base: Schema, draft: Schema): string[] {
  const changes = [
    ...definitionChanges(base.entityTypes, draft.entityTypes, "type"),
    ...definitionChanges(base.relationshipTypes, draft.relationshipTypes, "relationship"),
  ];
  if (JSON.stringify(base.coverageExpectations) !== JSON.stringify(draft.coverageExpectations))
    changes.push("Change coverage expectations");
  if (!changes.length && JSON.stringify(base) !== JSON.stringify(draft))
    changes.push("Change native schema properties");
  return changes;
}
export function rootExtensions(schema: Schema) {
  return Object.keys(schema).filter(
    (name) => !["entityTypes", "relationshipTypes", "coverageExpectations"].includes(name),
  );
}

export function captureDraft(schema: SchemaObject | null) {
  return { base: nativeDraft(schema ?? emptySchema), version: schema?.version ?? 0 };
}
export function endpointMode(types: string[] | undefined, selected: boolean) {
  if (types === undefined) return "any";
  return types.length || selected ? "selected" : "none";
}
