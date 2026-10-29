import { canonical } from "../core/evidence.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { TracerError, validateSchema } from "../core/model.ts";
import type { Entity, Relationship, Schema } from "../core/model.ts";
import type {
  SchemaChange,
  SchemaPreviewInput,
  SchemaPreview,
  SchemaIssue,
} from "../core/schema-preview.ts";
import type { Repository, Transaction } from "./ports/repository.ts";
import { nativeObjects, validatePageLimit, queryShape } from "./native-query-support.ts";
import { validateNativeEntity, validateNativeRelationship } from "./native-validation.ts";
import { expectVersion } from "./version-guard.ts";

function changedGroup(
  group: SchemaChange["group"],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): SchemaChange[] {
  const changes: SchemaChange[] = [];
  for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const old = Object.hasOwn(before, name);
    const fresh = Object.hasOwn(after, name);
    if (old && fresh && canonical(before[name]) === canonical(after[name])) continue;
    changes.push({ group, name, change: !old ? "added" : fresh ? "changed" : "removed" });
  }
  return changes;
}
function definitionChanges(current: Schema | undefined, next: Schema): SchemaChange[] {
  return (["entityTypes", "relationshipTypes", "coverageExpectations"] as const).flatMap((group) =>
    changedGroup(group, current?.[group] ?? {}, next[group] ?? {}),
  );
}
function validationIssue(error: unknown, kind: SchemaIssue["kind"], id: string): SchemaIssue {
  if (!(error instanceof TracerError) || error.code !== "validation") throw error;
  return {
    kind,
    id,
    code: error.code,
    message: error.message,
    ...(error.details?.path ? { path: error.details.path } : {}),
  };
}
function appendIssue(result: SchemaPreview, issue: SchemaIssue, maximum: number) {
  result.totalIssues++;
  if (result.issues.length < maximum) result.issues.push(issue);
}

async function inspectObjects(
  tx: Transaction,
  schema: Schema,
  result: SchemaPreview,
  maximum: number,
  kind: "entity" | "relationship",
) {
  const objects = await nativeObjects(tx, kind);
  result.checked[kind === "entity" ? "entities" : "relationships"] = objects.length;
  for (const value of objects) {
    try {
      if (kind === "entity") validateNativeEntity(schema, value as Entity);
      else await validateNativeRelationship(tx, schema, value as Relationship);
    } catch (error) {
      appendIssue(result, validationIssue(error, kind, value.id), maximum);
    }
  }
}

export async function previewSchema(
  repository: Repository,
  input: SchemaPreviewInput,
): Promise<SchemaPreview> {
  input = snapshotInput(input);
  queryShape(input, ["schema", "expectedVersion", "limit"], "Invalid schema preview input");
  validateSchema(input.schema);
  validatePageLimit(input.limit, 1000);
  return repository.transaction(
    async (tx) => {
      const current = await tx.get("schema", "project");
      const version = current?.version ?? 0;
      expectVersion(version, input.expectedVersion, true, { kind: "schema", id: "project" });
      const result: SchemaPreview = {
        valid: true,
        schemaVersion: version,
        projectRevision: await tx.headRevision(),
        changes: definitionChanges(current, input.schema),
        checked: { entities: 0, relationships: 0 },
        issues: [],
        totalIssues: 0,
        truncated: false,
      };
      await inspectObjects(tx, input.schema, result, input.limit ?? 100, "entity");
      await inspectObjects(tx, input.schema, result, input.limit ?? 100, "relationship");
      result.valid = result.totalIssues === 0;
      result.truncated = result.totalIssues > result.issues.length;
      return result;
    },
    { readOnly: true },
  );
}
