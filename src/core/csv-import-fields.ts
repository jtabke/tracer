import { ensure, json, record, validateFields, TracerError, knownProperties } from "./model.ts";
import type { Field, Fields, Json, TypeDefinition } from "./model.ts";
import type { CsvFieldMapping, CsvImportIssue } from "./csv-import-types.ts";
import type { CsvRow, CsvTable } from "./csv.ts";

export function csvColumn(table: CsvTable, column: number) {
  ensure(
    Number.isSafeInteger(column) && column >= 0 && column < table.headers.length,
    "validation",
    "Choose a valid CSV column",
  );
}
export function csvFieldMapping(
  table: CsvTable,
  definition: TypeDefinition | undefined,
  mapping: CsvFieldMapping,
) {
  ensure(definition, "validation", "Choose a declared record or relationship type");
  ensure(record(mapping), "validation", "Field mapping must be an object");
  knownProperties(mapping, Object.keys(definition.fields), ["fields"]);
  for (const column of Object.values(mapping)) csvColumn(table, column);
}
function value(cell: string, field: Field): Json {
  if (field.type === "string") return cell;
  const text = cell.trim();
  if (field.type === "boolean") {
    ensure(/^(true|false)$/i.test(text), "validation", "Use true or false");
    return text.toLowerCase() === "true";
  }
  if (field.type === "number") {
    ensure(
      /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(text) && Number.isFinite(Number(text)),
      "validation",
      "Use a finite number without units or thousands separators",
    );
    return Number(text);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TracerError("validation", "Use valid JSON");
  }
  ensure(json(parsed), "validation", "Use valid JSON values");
  return parsed;
}
export function importIssue(
  error: unknown,
  issues: CsvImportIssue[],
  line?: number,
  column?: string,
) {
  if (!(error instanceof TracerError)) throw error;
  issues.push({
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
    message: error.message,
  });
}
export function csvFields(
  table: CsvTable,
  row: CsvRow,
  definition: TypeDefinition,
  mapping: CsvFieldMapping,
  issues: CsvImportIssue[],
): Fields {
  const fields: Fields = {};
  for (const [name, column] of Object.entries(mapping)) {
    const cell = row.cells[column];
    if (cell === undefined || cell === "") continue;
    try {
      Object.defineProperty(fields, name, {
        value: value(cell, definition.fields[name]),
        enumerable: true,
        configurable: true,
      });
    } catch (error) {
      importIssue(error, issues, row.line, table.headers[column]);
    }
  }
  try {
    validateFields(definition, fields);
  } catch (error) {
    importIssue(error, issues, row.line);
  }
  return fields;
}
