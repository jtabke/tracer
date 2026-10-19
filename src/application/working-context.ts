import { snapshotInput } from "../core/input-snapshot.ts";
import { ensure } from "../core/model.ts";
import type { Entity } from "../core/model.ts";
import type { WorkingContext, WorkingContextQuery } from "../core/working-context.ts";
import type { Repository, Transaction } from "./ports/repository.ts";
import { projectSchema } from "./native-query-support.ts";
import { workingQuery, validateWorkingRecipe } from "./working-context-query.ts";
import type { PreparedWorkingQuery } from "./working-context-query.ts";
import { cursorRevisions } from "./working-context-cursors.ts";
import { workingRows, workingTraces } from "./working-context-native.ts";
import { workingReceipts } from "./working-context-receipts.ts";

async function context(tx: Transaction, schemaVersion: number): Promise<WorkingContext["context"]> {
  return {
    projectRevision: await tx.headRevision(),
    schemaVersion,
    evidenceRevision: await tx.impactEvidenceRevision(),
  };
}
function continuations(query: PreparedWorkingQuery, selected: WorkingContext["context"]) {
  cursorRevisions(query.after, selected);
  cursorRevisions(query.trace?.cursor, selected);
  cursorRevisions(query.receiptAfter, selected);
}
async function projection(tx: Transaction, query: PreparedWorkingQuery): Promise<WorkingContext> {
  const schema = await projectSchema(tx),
    selected = await context(tx, schema.version);
  continuations(query, selected);
  const focus = (await tx.get("entity", query.focusId)) as Entity | undefined;
  ensure(focus, "not_found", "Working focus no longer exists");
  validateWorkingRecipe(schema, focus, query.recipe);
  const rows = await workingRows(tx, query, selected),
    records = rows.page.items.map((row) => row.entity);
  const routes = await workingTraces(tx, query, selected, records);
  return {
    context: selected,
    schema,
    focus,
    recipe: query.recipe,
    rows,
    traces: routes.traces,
    receipts: await workingReceipts(tx, query, selected, records, routes),
  };
}
/** A current-data application projection; recipe paths assert no domain implication. */
export class WorkingContextService {
  private repository: Repository;
  constructor(repository: Repository) {
    this.repository = repository;
  }
  async get(query: WorkingContextQuery): Promise<WorkingContext> {
    const selected = workingQuery(snapshotInput(query));
    return this.repository.transaction((tx) => projection(tx, selected));
  }
}
