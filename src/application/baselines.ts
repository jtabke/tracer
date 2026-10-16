import { snapshotInput } from "../core/input-snapshot.ts";
import { ensure, json, record, validateProvenance } from "../core/model.ts";
import type { Entity, Provenance, Relationship, SchemaObject } from "../core/model.ts";
import type {
  Baseline,
  BaselineInput,
  BaselineQuery,
  BaselineContentsQuery,
  BaselineContents,
} from "../core/baseline.ts";
import type { Repository, Transaction } from "../persistence/contracts.ts";

function shape(value: unknown, keys: string[]) {
  ensure(
    record(value) && json(value) && Object.keys(value).every((key) => keys.includes(key)),
    "validation",
    "Invalid baseline fields",
  );
}
function positive(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}
function identity(value: unknown): asserts value is string {
  ensure(
    typeof value === "string" &&
      value.length > 0 &&
      value.length <= 200 &&
      value.trim() === value &&
      json(value),
    "validation",
    "Baseline identity must be nonempty text of at most 200 characters",
  );
}
function captureInput(input: BaselineInput) {
  shape(input, ["id", "name", "expectedProjectRevision", "projectRevision"]);
  if (input.id !== undefined) identity(input.id);
  ensure(
    typeof input.name === "string" &&
      input.name.trim().length > 0 &&
      input.name.trim().length <= 80,
    "validation",
    "Baseline name must contain 1–80 characters",
  );
  ensure(
    positive(input.expectedProjectRevision),
    "validation",
    "Baseline capture needs a positive expected project revision",
  );
  const target =
    input.projectRevision === undefined ? input.expectedProjectRevision : input.projectRevision;
  ensure(positive(target), "validation", "Baseline target must be a positive project revision");
  return target;
}
function pageLimit(value: unknown, fallback: number, maximum: number) {
  const limit = value === undefined ? fallback : value;
  ensure(
    positive(limit) && Number(limit) <= maximum,
    "validation",
    `Baseline page limit must be 1–${maximum}`,
  );
  return Number(limit);
}
async function requiredBaseline(tx: Transaction, id: string) {
  identity(id);
  const value = await tx.getBaseline(id);
  ensure(value, "not_found", "Baseline not found");
  return value;
}
function sameCapture(value: Baseline, input: BaselineInput, target: number, actor: Provenance) {
  return (
    value.name === input.name.trim() &&
    value.projectRevision === target &&
    value.capturedAtProjectRevision === input.expectedProjectRevision &&
    value.actor === actor.actor &&
    value.reason === actor.reason
  );
}
function parseCursor(after: string) {
  ensure(
    typeof after === "string" && after.length <= 8192,
    "validation",
    "Invalid baseline contents cursor",
  );
  let value: unknown;
  try {
    value = JSON.parse(after);
  } catch {
    ensure(false, "validation", "Invalid baseline contents cursor");
  }
  ensure(
    Array.isArray(value) &&
      value.length === 4 &&
      value[0] === "v1" &&
      typeof value[3] === "string" &&
      value[3].length > 0 &&
      json(value[3]),
    "validation",
    "Invalid baseline contents cursor",
  );
  return value;
}
function contentsAfter(query: BaselineContentsQuery) {
  if (query.after === undefined) return undefined;
  const value = parseCursor(query.after);
  ensure(
    value[1] === query.baselineId && value[2] === query.kind,
    "validation",
    "Baseline contents cursor belongs to a different scope",
  );
  return value[3] as string;
}

export class Baselines {
  private repository: Repository;
  private newId: () => string;
  constructor(repository: Repository, newId: () => string) {
    this.repository = repository;
    this.newId = newId;
  }
  async capture(input: BaselineInput, origin: Provenance): Promise<Baseline> {
    const actor = validateProvenance(origin);
    input = snapshotInput(input);
    const target = captureInput(input);
    return this.repository.transaction(async (tx) => {
      if (input.id !== undefined) {
        const previous = await tx.getBaseline(input.id);
        if (previous) {
          ensure(
            sameCapture(previous, input, target, actor),
            "conflict",
            "Baseline identity already belongs to a different capture",
          );
          return previous;
        }
      }
      const head = await tx.headRevision();
      ensure(
        head === input.expectedProjectRevision,
        "conflict",
        "Project changed before baseline capture",
      );
      ensure(
        target <= head,
        "validation",
        "Baseline target is beyond the current project revision",
      );
      const boundary = (await tx.changesets(target - 1, 1))[0];
      ensure(
        boundary?.projectRevision === target,
        "not_found",
        "Baseline target is not a committed changeset",
      );
      const schema = (await tx.getAt("schema", "project", target)) as SchemaObject | undefined;
      ensure(schema, "validation", "Baseline target has no project schema");
      const value: Baseline = {
        ...actor,
        id: input.id ?? this.newId(),
        name: input.name.trim(),
        projectRevision: target,
        changesetId: boundary.id,
        schemaVersion: schema.version,
        capturedAtProjectRevision: head,
        at: new Date().toISOString(),
      };
      identity(value.id);
      await tx.appendBaseline(value);
      return value;
    });
  }
  get(id: string) {
    return this.repository.transaction((tx) => requiredBaseline(tx, id));
  }
  async list(query: BaselineQuery = {}) {
    query = snapshotInput(query);
    shape(query, ["after", "limit"]);
    const limit = pageLimit(query.limit, 25, 100);
    ensure(
      query.after === undefined ||
        (typeof query.after === "string" &&
          /^(0|[1-9]\d*)$/.test(query.after) &&
          Number.isSafeInteger(Number(query.after))),
      "validation",
      "Invalid baseline catalogue cursor",
    );
    return this.repository.transaction((tx) => tx.baselines({ ...query, limit }));
  }
  async contents(query: BaselineContentsQuery): Promise<BaselineContents> {
    query = snapshotInput(query);
    shape(query, ["baselineId", "kind", "after", "limit"]);
    identity(query.baselineId);
    ensure(
      query.kind === "entity" || query.kind === "relationship",
      "validation",
      "Choose entity or relationship baseline contents",
    );
    const limit = pageLimit(query.limit, 100, 1000),
      after = contentsAfter(query);
    return this.repository.transaction(async (tx) => {
      const baseline = await requiredBaseline(tx, query.baselineId);
      const schema = (await tx.getAt("schema", "project", baseline.projectRevision)) as
        SchemaObject | undefined;
      ensure(
        schema && schema.version === baseline.schemaVersion,
        "storage",
        "Baseline schema is unavailable",
      );
      const result = await tx.queryAt(query.kind, baseline.projectRevision, { after, limit });
      return {
        baseline,
        schema,
        objects: {
          items: result.items as (Entity | Relationship)[],
          ...(result.nextAfter === undefined
            ? {}
            : { nextAfter: JSON.stringify(["v1", baseline.id, query.kind, result.nextAfter]) }),
        },
      };
    });
  }
}
