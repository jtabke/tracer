import type { Operation } from "../../src/application/commands.ts";
import type { Fields, SchemaObject } from "../../src/core/model.ts";
import { requiredField } from "./authoring-policy.ts";
import type {
  ArtifactDraft,
  MatrixDraft,
  MatrixModel,
  RelationshipDraft,
  RootDraft,
} from "./matrix-types.ts";

type Context = { model: MatrixModel; data: { schema: SchemaObject } };
type Result =
  | { status: "ready"; operations: Operation[]; selected: string }
  | { status: "invalid"; error?: string };
const invalid = (error?: string): Result => ({ status: "invalid", error });
export function duplicateTarget(model: MatrixModel, draft: RelationshipDraft, key: string) {
  return model.links.some(
    (link) =>
      link.id !== draft.id &&
      link.source === draft.sourceKey &&
      link.target === key &&
      link.type === draft.type,
  );
}
function artifactProposal(context: Context, draft: ArtifactDraft | RootDraft): Result {
  const type =
    draft.kind === "root" ? draft.type : (context.model.records.get(draft.key)?.type ?? "");
  if (
    !draft.title.trim() ||
    (requiredField(context.data.schema, "entityTypes", type, "statement") &&
      !draft.statement.trim()) ||
    (draft.kind === "root" && !draft.key.trim())
  )
    return invalid();
  const fields: Fields = {
    ...(draft.kind === "artifact" ? draft.fields : {}),
    title: draft.title.trim(),
    ...(draft.statement.trim() || draft.kind === "artifact"
      ? { statement: draft.statement.trim() }
      : {}),
  };
  return {
    status: "ready",
    selected: draft.key.trim(),
    operations: [
      draft.kind === "root"
        ? {
            op: "entity.create",
            id: draft.id,
            input: { type: draft.type, key: draft.key.trim(), fields },
          }
        : { op: "entity.update", id: draft.id, expectedVersion: draft.version, input: { fields } },
    ],
  };
}
function relationshipFields(context: Context, draft: RelationshipDraft): Fields {
  const definition = context.data.schema.relationshipTypes[draft.type];
  return {
    ...draft.fields,
    ...(draft.scope.trim() ? { scope: draft.scope.trim() } : {}),
    ...(definition?.fields.source_version
      ? { source_version: draft.fields.source_version ?? draft.sourceVersion }
      : {}),
    ...(definition?.fields.review ? { review: draft.fields.review ?? "Not reviewed" } : {}),
  };
}
function newTargetOperation(context: Context, draft: RelationshipDraft): Operation | null {
  if (!draft.newId || !draft.key?.trim() || !draft.title?.trim()) return null;
  const statement = draft.statement?.trim() ?? "";
  if (
    requiredField(context.data.schema, "entityTypes", draft.targetType, "statement") &&
    !statement
  )
    return null;
  return {
    op: "entity.create",
    id: draft.newId,
    input: {
      type: draft.targetType,
      key: draft.key.trim(),
      fields: { title: draft.title.trim(), ...(statement ? { statement } : {}) },
    },
  };
}
function relationshipProposal(context: Context, draft: RelationshipDraft): Result {
  const target = draft.create ? null : context.model.records.get(draft.targetKey);
  if (
    (requiredField(context.data.schema, "relationshipTypes", draft.type, "scope") &&
      !draft.scope.trim()) ||
    (!draft.create && !target)
  )
    return invalid("Choose a target and describe the relationship scope.");
  if (target && duplicateTarget(context.model, draft, target.key))
    return invalid("This artifact is already linked by this relationship type.");
  const operations: Operation[] = [];
  if (draft.create) {
    const entity = newTargetOperation(context, draft);
    if (!entity) return invalid();
    operations.push(entity);
  }
  const targetId = draft.targetId ?? draft.newId;
  if (!targetId) return invalid("Choose a target and describe the relationship scope.");
  const input = {
    source: draft.sourceId,
    target: targetId,
    type: draft.type,
    fields: relationshipFields(context, draft),
  };
  operations.push(
    draft.mode === "replace"
      ? { op: "relationship.update", id: draft.id, expectedVersion: draft.version, input }
      : {
          op: "relationship.create",
          id: draft.id,
          input,
          rejectExisting: true,
          expectedEndpoints: {
            sourceVersion: draft.sourceVersion,
            targetVersion: draft.targetVersion ?? 1,
          },
        },
  );
  return { status: "ready", operations, selected: draft.create ? draft.key!.trim() : target!.key };
}
/** Build one guarded native proposal without changing the draft, model, or DOM. */
export function matrixProposal(context: Context, draft: MatrixDraft): Result {
  return draft.kind === "relationship"
    ? relationshipProposal(context, draft)
    : artifactProposal(context, draft);
}
