import type { ErrorCode, ErrorDetails, Schema } from "./model.ts";

export type SchemaPreviewInput = { schema: Schema; expectedVersion: number; limit?: number };
export type SchemaChange = {
  group: "entityTypes" | "relationshipTypes" | "coverageExpectations";
  name: string;
  change: "added" | "removed" | "changed";
};
export type SchemaIssue = {
  kind: "entity" | "relationship";
  id: string;
  code: ErrorCode;
  message: string;
  path?: ErrorDetails["path"];
};
/** Current-snapshot compatibility assessment, not a reservation or migration. */
export type SchemaPreview = {
  valid: boolean;
  schemaVersion: number;
  projectRevision: number;
  changes: SchemaChange[];
  checked: { entities: number; relationships: number };
  issues: SchemaIssue[];
  totalIssues: number;
  truncated: boolean;
};
