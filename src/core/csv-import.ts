import { ensure, json, knownProperties, record } from "./model.ts";
import type { Entity, RelationshipDefinition, SchemaObject } from "./model.ts";
import { MAP_RECORD_LIMIT, MAP_CONNECTION_LIMIT } from "./project-snapshot.ts";
import type { ProjectSnapshot } from "./project-snapshot.ts";
import { parseCsv } from "./csv.ts";
import type { CsvRow, CsvTable } from "./csv.ts";
import { csvColumn, csvFieldMapping, csvFields, importIssue } from "./csv-import-fields.ts";
import type {
  CsvImportMapping,
  CsvImportPreview,
  CsvImportRowPreview,
  CsvLinkMapping,
} from "./csv-import-types.ts";

type Context = {
  table: CsvTable;
  schema: SchemaObject;
  result: CsvImportPreview;
  keys: Map<string, Entity>;
  links: Set<string>;
  id(): string;
};
function definition(schema: SchemaObject, kind: "entityTypes" | "relationshipTypes", type: string) {
  ensure(
    Object.hasOwn(schema[kind], type),
    "validation",
    `Unknown ${kind === "entityTypes" ? "record" : "relationship"} type: ${type}`,
  );
  return schema[kind][type];
}
function linkMapping(context: Context, mapping: CsvLinkMapping) {
  ensure(record(mapping), "validation", "Invalid link mapping");
  knownProperties(mapping, ["type", "targetColumn", "fields"]);
  csvColumn(context.table, mapping.targetColumn);
  csvFieldMapping(
    context.table,
    definition(context.schema, "relationshipTypes", mapping.type),
    mapping.fields,
  );
}
function validateMapping(context: Context, mapping: CsvImportMapping) {
  ensure(record(mapping), "validation", "Choose an import mapping");
  ensure(
    mapping.kind === "records" || mapping.kind === "links",
    "validation",
    "Choose records or links",
  );
  const common = ["kind", "type", "fields"];
  if (mapping.kind === "records") {
    knownProperties(mapping, [...common, "keyColumn", "links"]);
    csvColumn(context.table, mapping.keyColumn);
    csvFieldMapping(
      context.table,
      definition(context.schema, "entityTypes", mapping.type),
      mapping.fields,
    );
    ensure(
      Array.isArray(mapping.links) && mapping.links.length <= 8,
      "validation",
      "Use at most eight link mappings",
    );
    for (const link of mapping.links) linkMapping(context, link);
  } else {
    knownProperties(mapping, [...common, "sourceColumn", "targetColumn"]);
    csvColumn(context.table, mapping.sourceColumn);
    linkMapping(context, {
      type: mapping.type,
      targetColumn: mapping.targetColumn,
      fields: mapping.fields,
    });
  }
}
function usedColumns(mapping: CsvImportMapping) {
  const used = Object.values(mapping.fields);
  if (mapping.kind === "links")
    return new Set([...used, mapping.sourceColumn, mapping.targetColumn]);
  return new Set([
    mapping.keyColumn,
    ...used,
    ...mapping.links.flatMap((link) => [link.targetColumn, ...Object.values(link.fields)]),
  ]);
}
function connectionKey(type: string, source: string, target: string) {
  return JSON.stringify([type, source, target]);
}
function rowPreview(line: number, key: string, type: string): CsvImportRowPreview {
  return { line, key, type, fields: {}, links: [] };
}
function keyValue(context: Context, row: CsvRow, column: number) {
  const key = row.cells[column];
  ensure(
    typeof key === "string" && key.trim(),
    "validation",
    `Missing key in ${context.table.headers[column]}`,
  );
  ensure(json(key), "validation", "Stable keys must contain valid Unicode text");
  return key;
}
function addRecord(
  context: Context,
  row: CsvRow,
  mapping: Extract<CsvImportMapping, { kind: "records" }>,
) {
  const preview = rowPreview(row.line, row.cells[mapping.keyColumn] ?? "", mapping.type);
  context.result.rows.push(preview);
  preview.fields = csvFields(
    context.table,
    row,
    context.schema.entityTypes[mapping.type],
    mapping.fields,
    context.result.issues,
  );
  try {
    const key = keyValue(context, row, mapping.keyColumn);
    ensure(
      !context.keys.has(key),
      "validation",
      `Key already exists or is repeated in this file: ${key}. Records are never overwritten.`,
    );
    const entity: Entity = {
      id: context.id(),
      key,
      type: mapping.type,
      fields: preview.fields,
      version: 1,
    };
    context.keys.set(key, entity);
    context.result.operations.push({
      op: "entity.create",
      id: entity.id,
      input: { type: entity.type, key, fields: entity.fields },
    });
    context.result.counts.records++;
  } catch (error) {
    importIssue(error, context.result.issues, row.line, context.table.headers[mapping.keyColumn]);
  }
}
function endpoint(context: Context, key: string, label: string) {
  const entity = context.keys.get(key);
  ensure(entity, "validation", `Unknown ${label} key: ${key}`);
  return entity;
}
function validateEndpoints(definition: RelationshipDefinition, source: Entity, target: Entity) {
  ensure(
    !definition.source || definition.source.includes(source.type),
    "validation",
    `Relationship does not allow source type ${source.type}`,
  );
  ensure(
    !definition.target || definition.target.includes(target.type),
    "validation",
    `Relationship does not allow target type ${target.type}`,
  );
}
function addLink(
  context: Context,
  row: CsvRow,
  sourceKey: string,
  mapping: CsvLinkMapping,
  preview: CsvImportRowPreview,
) {
  try {
    const targetKey = keyValue(context, row, mapping.targetColumn);
    const source = endpoint(context, sourceKey, "source");
    const target = endpoint(context, targetKey, "target");
    const definition = context.schema.relationshipTypes[mapping.type];
    validateEndpoints(definition, source, target);
    const key = connectionKey(mapping.type, source.id, target.id);
    ensure(
      !context.links.has(key),
      "validation",
      `Connection already exists or is repeated: ${sourceKey} → ${targetKey} (${mapping.type})`,
    );
    context.links.add(key);
    const fields = csvFields(context.table, row, definition, mapping.fields, context.result.issues);
    preview.links.push({ type: mapping.type, source: sourceKey, target: targetKey, fields });
    context.result.operations.push({
      op: "relationship.create",
      id: context.id(),
      input: { type: mapping.type, source: source.id, target: target.id, fields },
      expectedEndpoints: { sourceVersion: source.version, targetVersion: target.version },
      rejectExisting: true,
    });
    context.result.counts.links++;
  } catch (error) {
    importIssue(
      error,
      context.result.issues,
      row.line,
      context.table.headers[mapping.targetColumn],
    );
  }
}
function optionalLink(
  context: Context,
  row: CsvRow,
  source: string,
  mapping: CsvLinkMapping,
  preview: CsvImportRowPreview,
) {
  if (row.cells[mapping.targetColumn]) return addLink(context, row, source, mapping, preview);
  if (Object.values(mapping.fields).some((column) => row.cells[column]))
    context.result.issues.push({
      line: row.line,
      column: context.table.headers[mapping.targetColumn],
      message: "Link fields have values but the target key is empty",
    });
}
function rowLinks(context: Context, row: CsvRow, mapping: CsvImportMapping, index: number) {
  if (mapping.kind === "records") {
    for (const link of mapping.links)
      optionalLink(context, row, row.cells[mapping.keyColumn], link, context.result.rows[index]);
    return;
  }
  const preview = rowPreview(row.line, row.cells[mapping.sourceColumn] ?? "", mapping.type);
  context.result.rows.push(preview);
  try {
    addLink(context, row, keyValue(context, row, mapping.sourceColumn), mapping, preview);
  } catch (error) {
    importIssue(
      error,
      context.result.issues,
      row.line,
      context.table.headers[mapping.sourceColumn],
    );
  }
}
function checkWorkspaceSize(snapshot: ProjectSnapshot, result: CsvImportPreview) {
  ensure(
    snapshot.entities.length + result.counts.records <= MAP_RECORD_LIMIT,
    "validation",
    `Import would exceed the workspace limit of ${MAP_RECORD_LIMIT.toLocaleString("en-US")} records`,
  );
  ensure(
    snapshot.relationships.length + result.counts.links <= MAP_CONNECTION_LIMIT,
    "validation",
    `Import would exceed the workspace limit of ${MAP_CONNECTION_LIMIT.toLocaleString("en-US")} connections`,
  );
}
function checkBatch(result: CsvImportPreview) {
  ensure(result.operations.length > 0, "validation", "No records or links to import");
  ensure(
    result.operations.length <= 1000,
    "validation",
    "Import exceeds 1,000 combined records and links. Split the file into smaller imports.",
  );
  ensure(
    new TextEncoder().encode(
      JSON.stringify({
        expectedSchemaVersion: result.schemaVersion,
        expectedProjectRevision: result.projectRevision,
        operations: result.operations,
      }),
    ).length <= 1_000_000,
    "validation",
    "Mapped import exceeds the request size limit. Split the file into smaller imports.",
  );
}
/** Read-only planning over one complete project snapshot. Errors disable the entire batch. */
export function previewCsvImport(
  text: string,
  mapping: CsvImportMapping,
  snapshot: ProjectSnapshot,
  newId: () => string = () => globalThis.crypto.randomUUID(),
): CsvImportPreview {
  const result: CsvImportPreview = {
    schemaVersion: snapshot.schema?.version ?? 0,
    projectRevision: snapshot.projectRevision,
    rows: [],
    issues: [],
    ignoredColumns: [],
    counts: { records: 0, links: 0 },
    operations: [],
  };
  try {
    ensure(snapshot.schema, "validation", "Configure the project model before importing");
    const context: Context = {
      table: parseCsv(text),
      schema: snapshot.schema,
      result,
      keys: new Map(),
      links: new Set(
        snapshot.relationships.map((link) => connectionKey(link.type, link.source, link.target)),
      ),
      id: newId,
    };
    for (const entity of snapshot.entities)
      if (entity.key !== undefined) context.keys.set(entity.key, entity);
    validateMapping(context, mapping);
    const used = usedColumns(mapping);
    result.ignoredColumns = context.table.headers.filter((_, index) => !used.has(index));
    for (const row of context.table.rows) {
      if (row.cells.length !== context.table.headers.length)
        result.issues.push({
          line: row.line,
          message: `Expected ${context.table.headers.length} cells, found ${row.cells.length}`,
        });
      if (mapping.kind === "records") addRecord(context, row, mapping);
    }
    context.table.rows.forEach((row, index) => rowLinks(context, row, mapping, index));
    checkWorkspaceSize(snapshot, result);
    checkBatch(result);
  } catch (error) {
    importIssue(error, result.issues);
  }
  if (result.issues.length) result.operations = [];
  return result;
}
