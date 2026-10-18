import { ensure } from "../core/model.ts";
import type { Entity, SchemaObject } from "../core/model.ts";
import {
  workRecord,
  type NextWorkSelection,
  type WorkQueue,
  type WorkRecord,
} from "../core/next-work.ts";
import type { Transaction } from "../persistence/contracts.ts";
import { workByteBudget } from "./next-work-budget.ts";

const populationLimit = 10_000;
export async function statementWork(
  tx: Transaction,
  selection: NextWorkSelection,
): Promise<WorkQueue<WorkRecord>> {
  const { requirementType, statementField } = selection;
  const queue: WorkQueue<WorkRecord> = {
    available: Boolean(requirementType && statementField),
    explanation:
      requirementType && statementField
        ? `${requirementType} records with an absent, blank or non-text ${statementField}.`
        : "Choose a requirement type and a declared text field. This queue is not configured.",
    evaluated: 0,
    items: [],
  };
  if (!queue.available) return queue;
  const account = workByteBudget();
  let after: string | undefined;
  do {
    const page = await tx.query("entity", { type: requirementType, after, limit: 100 });
    queue.evaluated += page.items.length;
    checkPopulation(queue.evaluated);
    for (const entity of page.items as Entity[]) {
      const statement = entity.fields[statementField];
      if (typeof statement !== "string" || !statement.trim()) {
        const item = workRecord(entity);
        account(item);
        queue.items.push(item);
      }
    }
    after = page.nextAfter;
  } while (after !== undefined);
  return queue;
}

export async function coverageWork(
  tx: Transaction,
  schema: SchemaObject | null,
  id: string,
): Promise<WorkQueue<WorkRecord>> {
  const expectation = schema?.coverageExpectations?.[id];
  const queue: WorkQueue<WorkRecord> = {
    available: Boolean(expectation),
    explanation: expectation
      ? `No qualifying ${expectation.related.type} target under “${expectation.name}” (${expectation.direction} ${expectation.relationshipType}). Checks the policy's subject/target filters; further minimum-count deficits remain in Coverage. A link does not establish execution or satisfaction.`
      : "Choose a saved coverage policy for this requirement type, or define one in Configure model. This queue is not configured.",
    evaluated: 0,
    items: [],
  };
  if (!expectation) return queue;
  const account = workByteBudget();
  let after: string | undefined;
  do {
    const page = await tx.coveragePage({ expectation, after, limit: 100 });
    queue.evaluated += page.items.length;
    checkPopulation(queue.evaluated);
    for (const row of page.items) {
      ensure(
        row.distinctTargets !== null && row.unresolvedRelationships === 0,
        "validation",
        "Next work cannot resolve all policy endpoints; no complete queues were returned",
      );
      if (row.distinctTargets === 0) {
        const item = workRecord(row.subject);
        account(item);
        queue.items.push(item);
      }
    }
    after = page.nextAfter;
  } while (after !== undefined);
  return queue;
}
function checkPopulation(count: number) {
  ensure(
    count <= populationLimit,
    "validation",
    "Next work supports up to 10,000 requirements per queue; no partial queues were returned. Use the paged coverage and record queries for this project.",
  );
}
