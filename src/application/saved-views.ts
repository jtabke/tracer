import { snapshotInput } from "../core/input-snapshot.ts";
import { ensure, json, record, knownProperties } from "../core/model.ts";
import type { SchemaObject } from "../core/model.ts";
import { viewDefinition } from "../core/presentation.ts";
import type { SavedView, ViewDefinition, InitialView } from "../core/presentation.ts";
import type { Repository, Transaction } from "./ports/repository.ts";
import { validateChainSteps } from "./chain.ts";

export type ViewSave = {
  id?: string;
  name: string;
  definition: ViewDefinition;
  expectedVersion: number;
  expectedSchemaVersion: number;
};

async function validateScope(tx: Transaction, schema: SchemaObject, definition: ViewDefinition) {
  if (definition.kind === "chain") {
    validateChainSteps(schema, definition.type, definition.steps);
    return;
  }
  ensure(
    await tx.get("entity", definition.rootId),
    "not_found",
    "Saved family starting item is unavailable",
  );
  if (definition.relationshipType)
    ensure(
      Object.hasOwn(schema.relationshipTypes, definition.relationshipType),
      "validation",
      "Unknown family relationship",
    );
  for (const column of definition.columns) validateColumn(schema, column);
}
function saveInput(input: ViewSave) {
  ensure(
    json(input) &&
      record(input) &&
      Object.keys(input).every((key) =>
        ["id", "name", "definition", "expectedVersion", "expectedSchemaVersion"].includes(key),
      ),
    "validation",
    "Invalid saved view input",
  );
  ensure(
    typeof input.name === "string" && input.name.trim().length > 0 && input.name.length <= 80,
    "validation",
    "Name the view using 1–80 characters",
  );
  expectedIdentity(input);
  return { name: input.name.trim(), definition: viewDefinition(input.definition) };
}
/** Mutable presentation metadata: no engineering changesets, receipts or audit-history claim. */
export class SavedViews {
  private repository: Repository;
  private newId: () => string;
  constructor(repository: Repository, newId: () => string) {
    this.repository = repository;
    this.newId = newId;
  }
  list() {
    return this.repository.transaction(async (tx) => {
      const views = await tx.listViews();
      ensure(views.length <= 50, "validation", "Project exceeds 50 saved views");
      return views;
    });
  }
  async save(input: ViewSave): Promise<SavedView> {
    input = snapshotInput(input);
    saveInput(input);
    return this.repository.transaction(async (tx) => {
      const schema = (await tx.get("schema", "project")) as SchemaObject | undefined;
      ensure(
        schema && schema.version === input.expectedSchemaVersion,
        "schema_conflict",
        "Model changed; refresh before saving the view",
      );
      return saveInTransaction(tx, schema, input, this.newId);
    });
  }
  async remove(id: string, expectedVersion: number) {
    ensure(
      typeof id === "string" &&
        id.length > 0 &&
        id.length <= 200 &&
        Number.isSafeInteger(expectedVersion) &&
        expectedVersion > 0,
      "validation",
      "Delete needs a saved view identity and version",
    );
    return this.repository.transaction((tx) => tx.removeView(id, expectedVersion));
  }
}

async function saveInTransaction(
  tx: Transaction,
  schema: SchemaObject,
  input: ViewSave,
  newId: () => string,
): Promise<SavedView> {
  const { name, definition } = saveInput(input);
  await validateScope(tx, schema, definition);
  const views = await tx.listViews();
  const before = input.id === undefined ? undefined : await tx.getView(input.id);
  if (input.id !== undefined) ensure(before, "not_found", "Saved view was removed");
  ensure(
    (before?.version ?? 0) === input.expectedVersion,
    "conflict",
    "Saved view changed; refresh and review before retrying",
  );
  ensure(
    !views.some((view) => view.name === name && view.id !== input.id),
    "validation",
    "A saved view already uses this name",
  );
  ensure(before || views.length < 50, "validation", "Project supports at most 50 saved views");
  const value = {
    id: before?.id ?? newId(),
    name,
    definition,
    version: input.expectedVersion + 1,
  };
  await tx.saveView(value, input.expectedVersion);
  return value;
}
export async function initializeViews(
  tx: Transaction,
  schema: SchemaObject,
  input: InitialView[] | undefined,
  newId: () => string,
) {
  if (input === undefined) return;
  ensure(
    Array.isArray(input) && input.length <= 10,
    "validation",
    "Initial setup supports at most ten named views",
  );
  for (const [index, view] of input.entries()) {
    ensure(record(view), "validation", "Initial view must be an object", {
      path: ["initialViews", index],
    });
    knownProperties(view, ["name", "definition"], ["initialViews", index]);
    await saveInTransaction(
      tx,
      schema,
      { ...view, expectedVersion: 0, expectedSchemaVersion: schema.version },
      newId,
    );
  }
}

function expectedIdentity(input: ViewSave) {
  ensure(
    input.id === undefined ||
      (typeof input.id === "string" && input.id.length > 0 && input.id.length <= 200),
    "validation",
    "Invalid saved view identity",
  );
  ensure(
    Number.isSafeInteger(input.expectedVersion) &&
      input.expectedVersion >= 0 &&
      (input.id !== undefined || input.expectedVersion === 0),
    "validation",
    "Invalid expected saved view version",
  );
}

function validateColumn(
  schema: SchemaObject,
  column: import("../core/presentation.ts").TraceColumn,
) {
  const relationship = Object.hasOwn(schema.relationshipTypes, column.relationshipType)
    ? schema.relationshipTypes[column.relationshipType]
    : undefined;
  ensure(
    relationship && Object.hasOwn(schema.entityTypes, column.targetType),
    "validation",
    "Saved trace column is no longer declared; choose current columns",
  );
  const endpoint = column.direction === "incoming" ? relationship.source : relationship.target;
  ensure(
    endpoint === undefined || endpoint.includes(column.targetType),
    "validation",
    "Trace column violates endpoint permissions",
  );
}
