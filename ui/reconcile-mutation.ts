import type { ChangesetInput } from "../src/application/commands.ts";
import type { Baseline, BaselineInput } from "../src/core/baseline.ts";
import type { Revision } from "../src/core/model.ts";
import type { WriteInput, WritePath } from "../src/interfaces/api-contract.ts";
import { read } from "./api.ts";
import { label } from "./entity-label.ts";

export type RecordedResult = { id: string; heading: string; description: string; value: unknown };
export type Reconciliation = { records: RecordedResult[]; incomplete: boolean };
function records<T>(
  items: T[],
  describe: (value: T) => RecordedResult,
  nextAfter?: string,
): Reconciliation {
  return { records: items.map(describe), incomplete: nextAfter !== undefined };
}
function nativeResult(revision: Revision): RecordedResult {
  const snapshot = revision.snapshot;
  const name =
    snapshot && "fields" in snapshot
      ? "source" in snapshot
        ? snapshot.type
        : label(snapshot)
      : revision.id.slice(0, 8);
  return {
    id: revision.revisionId,
    heading: `${{ entity: "Item", relationship: "Connection", schema: "Model" }[revision.kind]} ${name} · recorded v${revision.version}`,
    description:
      snapshot && "fields" in snapshot
        ? String(snapshot.fields.statement ?? snapshot.fields.title ?? snapshot.type)
        : "Recorded deletion",
    value: revision,
  };
}
async function nativeRecords(input: ChangesetInput): Promise<Reconciliation> {
  const ids = [...new Set(input.operations.map((operation) => operation.id))];
  if (ids.some((id) => id === undefined))
    throw new Error("Creation proposals need a captured identity before saving.");
  const result: Reconciliation = { records: [], incomplete: ids.length > 25 };
  for (const id of ids.slice(0, 25)) {
    const page = await read("/api/history", { id, limit: 25 });
    result.incomplete ||= page.nextAfter !== undefined;
    result.records.push(...page.items.map(nativeResult));
  }
  return result;
}
const reads: { [K in WritePath]: (input: WriteInput<K>) => Promise<Reconciliation> } = {
  "/api/evaluation-commands": async (input) => {
    const value = await read("/api/evaluation-outcome", { commandId: input.commandId });
    return {
      records: value
        ? [
            {
              id: value.commandId,
              heading: `Evaluation command ${value.commandId}`,
              description: value.receipt.outcome,
              value,
            },
          ]
        : [],
      incomplete: value === null,
    };
  },
  "/api/coverage-expectations": async () => {
    const value = await read("/api/coverage-expectations", {});
    return {
      records: [
        {
          id: "project",
          heading: `Coverage policy · schema v${value.context.schemaVersion}`,
          description: `${Object.keys(value.expectations).length} authored expectations`,
          value,
        },
      ],
      incomplete: false,
    };
  },
  "/api/baselines": baselineRecords,
  "/api/schema": async (input) => {
    const schema = await read("/api/schema", {});
    const views = input.initialViews ? await read("/api/saved-views", {}) : [];
    return {
      records: schema
        ? [
            {
              id: "project",
              heading: `Recorded model · schema v${schema.version}`,
              description: `${Object.keys(schema.entityTypes).length} item types · ${Object.keys(schema.relationshipTypes).length} connection types`,
              value: schema,
            },
            ...views.map((view) => ({
              id: view.id,
              heading: `Saved Matrix view · ${view.name}`,
              description: `Recorded v${view.version}`,
              value: view,
            })),
          ]
        : [],
      incomplete: false,
    };
  },
  "/api/changesets": nativeRecords,
  "/api/receipts": async (input) => {
    const page = await read("/api/evidence", {
      kind: "receipt",
      subject: input.outputId,
      limit: 25,
    });
    return records(
      page.items,
      (value) => ({
        id: value.id,
        heading: `Receipt for ${label(value.output)} · ${value.at}`,
        description: value.outcome,
        value,
      }),
      page.nextAfter,
    );
  },
  "/api/reviews": async (input) => {
    const page = await read("/api/evidence", {
      kind: "review",
      subject: input.receiptId,
      limit: 25,
    });
    return records(
      page.items,
      (value) => ({
        id: value.id,
        heading: `Review ${value.decision.replaceAll("_", " ")} · ${value.at}`,
        description: value.rationale,
        value,
      }),
      page.nextAfter,
    );
  },
  "/api/observations": async (input) => {
    const page = await read("/api/evidence", {
      kind: "observation",
      subject: input.entityId,
      limit: 25,
    });
    return records(
      page.items,
      (value) => ({
        id: value.id,
        heading: `Observation ${value.availability} · ${value.at}`,
        description: value.reason ?? value.commit ?? value.hash ?? "",
        value,
      }),
      page.nextAfter,
    );
  },
  "/api/external": async (input) => {
    const page = await read("/api/evidence", {
      kind: "external",
      subject: input.entityId,
      limit: 25,
    });
    return records(
      page.items,
      (value) => ({
        id: value.id,
        heading: `External identity · ${value.system}`,
        description: value.externalId,
        value,
      }),
      page.nextAfter,
    );
  },
  "/api/configurations": async (input) => {
    const page = await read("/api/configurations", { subject: input.subjectId, limit: 25 });
    return records(
      page.items,
      (value) => ({
        id: value.id,
        heading: value.name,
        description: `${label(value.subject)} · ${value.members.length} pinned members`,
        value,
      }),
      page.nextAfter,
    );
  },
  "/api/saved-views": savedViews,
  "/api/saved-views/remove": savedViews,
};
function baselineResult(value: Baseline): RecordedResult {
  return {
    id: value.id,
    heading: value.name,
    description: `Native project revision ${value.projectRevision} · schema v${value.schemaVersion}`,
    value,
  };
}
async function baselineRecords(input: BaselineInput): Promise<Reconciliation> {
  if (input.id !== undefined)
    return records([await read("/api/baseline", { id: input.id })], baselineResult);
  const page = await read("/api/baselines", { limit: 25 });
  return records(page.items, baselineResult, page.nextAfter);
}
async function savedViews(): Promise<Reconciliation> {
  return records(await read("/api/saved-views", {}), (value) => ({
    id: value.id,
    heading: value.name,
    description: `${value.definition.kind} view · v${value.version}`,
    value,
  }));
}
/** A successful bounded read never proves that a proposal is absent. */
export function reconcileMutation<K extends WritePath>(path: K, input: WriteInput<K>) {
  return reads[path](input);
}
