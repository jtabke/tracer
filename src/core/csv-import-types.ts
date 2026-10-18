import type { Fields } from "./model.ts";

/** Column indexes are zero-based; stable key values are exact and case-sensitive. */
export type CsvFieldMapping = Record<string, number>;
export type CsvLinkMapping = { type: string; targetColumn: number; fields: CsvFieldMapping };
export type CsvImportMapping =
  | {
      kind: "records";
      type: string;
      keyColumn: number;
      fields: CsvFieldMapping;
      links: CsvLinkMapping[];
    }
  | {
      kind: "links";
      type: string;
      sourceColumn: number;
      targetColumn: number;
      fields: CsvFieldMapping;
    };
export type CsvImportIssue = { line?: number; column?: string; message: string };
/** Restricted create operations compatible with the native guarded changeset command. */
export type CsvImportOperation =
  | { op: "entity.create"; id: string; input: { type: string; key: string; fields: Fields } }
  | {
      op: "relationship.create";
      id: string;
      input: { type: string; source: string; target: string; fields: Fields };
      expectedEndpoints: { sourceVersion: number; targetVersion: number };
      rejectExisting: true;
    };
export type CsvImportRowPreview = {
  line: number;
  key: string;
  type: string;
  fields: Fields;
  links: { type: string; source: string; target: string; fields: Fields }[];
};
export type CsvImportPreview = {
  schemaVersion: number;
  projectRevision: number;
  rows: CsvImportRowPreview[];
  issues: CsvImportIssue[];
  ignoredColumns: string[];
  counts: { records: number; links: number };
  operations: CsvImportOperation[];
};
