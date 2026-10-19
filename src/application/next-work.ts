import { ensure, json, knownProperties, record } from "../core/model.ts";
import type { SchemaObject } from "../core/model.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import {
  nextWorkDefaults,
  type NextWork,
  type NextWorkQuery,
  type NextWorkSelection,
} from "../core/next-work.ts";
import type { Repository } from "./ports/repository.ts";
import { statementWork, coverageWork } from "./next-work-structure.ts";
import { evidenceWork } from "./next-work-evidence.ts";
import { workByteBudget } from "./next-work-budget.ts";

export async function nextWork(
  repository: Repository,
  query: NextWorkQuery = {},
): Promise<NextWork> {
  query = snapshotInput(query);
  ensure(record(query) && json(query), "validation", "Next work query must be a JSON object");
  knownProperties(query, [
    "requirementType",
    "statementField",
    "allocationExpectationId",
    "verificationExpectationId",
  ]);
  ensure(
    Object.values(query).every((value) => typeof value === "string" && value.length <= 200),
    "validation",
    "Next work choices must be strings of at most 200 characters; use an empty string for an unconfigured queue",
  );
  return repository.transaction(async (tx) => {
    const schema = ((await tx.get("schema", "project")) as SchemaObject | undefined) ?? null;
    const selection = selected(schema, query);
    const value: NextWork = {
      schema,
      projectRevision: await tx.headRevision(),
      evidenceRevision: await tx.impactEvidenceRevision(),
      schemaVersion: schema?.version ?? 0,
      selection,
      queues: {
        statements: await statementWork(tx, selection),
        allocation: await coverageWork(tx, schema, selection.allocationExpectationId),
        verification: await coverageWork(tx, schema, selection.verificationExpectationId),
        ...(await evidenceWork(tx)),
      },
    };
    workByteBudget()(value);
    return value;
  });
}
function selected(schema: SchemaObject | null, query: NextWorkQuery): NextWorkSelection {
  const defaults = nextWorkDefaults(schema, query.requirementType);
  const requirementType = defaults.requirementType;
  ensure(
    !requirementType || Boolean(schema && Object.hasOwn(schema.entityTypes, requirementType)),
    "validation",
    "Choose a requirement type in the current model",
  );
  const selection = { ...defaults, ...query, requirementType };
  if (selection.statementField)
    ensure(
      schema?.entityTypes[requirementType]?.fields[selection.statementField]?.type === "string",
      "validation",
      "Statement field must be a declared text field on the selected requirement type",
    );
  for (const id of [selection.allocationExpectationId, selection.verificationExpectationId])
    validatePolicy(schema, requirementType, id);
  return selection;
}
function validatePolicy(schema: SchemaObject | null, type: string, id: string) {
  if (!id) return;
  ensure(
    schema?.coverageExpectations &&
      Object.hasOwn(schema.coverageExpectations, id) &&
      schema.coverageExpectations[id].subject.type === type,
    "validation",
    "Choose a saved coverage policy whose subject is the selected requirement type",
  );
}
