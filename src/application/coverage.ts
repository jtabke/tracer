import { ensure, json, record, validateProvenance, validateSchema } from "../core/model.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import type { Provenance, SchemaObject } from "../core/model.ts";
import type {
  CoverageCatalogue,
  CoverageContext,
  CoverageEvaluation,
  CoverageEvaluationQuery,
  CoverageListQuery,
  CoverageNativeRow,
  CoverageRow,
  CoverageSet,
} from "../core/coverage.ts";
import type { Repository, Transaction } from "./ports/repository.ts";
import { projectSchema, queryShape, validatePageLimit } from "./native-query-support.ts";

async function context(tx: Transaction, query: CoverageListQuery) {
  if (query.baselineId === undefined) {
    const schema = await projectSchema(tx);
    return {
      schema,
      context: {
        projectRevision: await tx.headRevision(),
        schemaVersion: schema.version,
      } as CoverageContext,
    };
  }
  ensure(
    typeof query.baselineId === "string" &&
      query.baselineId.length > 0 &&
      query.baselineId.length <= 200,
    "validation",
    "Choose a baseline identity",
  );
  const baseline = await tx.getBaseline(query.baselineId);
  ensure(baseline, "not_found", "Baseline not found");
  const schema = await tx.getAt("schema", "project", baseline.projectRevision);
  ensure(
    schema && schema.version === baseline.schemaVersion,
    "storage",
    "Baseline schema is unavailable",
  );
  return {
    schema,
    context: { projectRevision: baseline.projectRevision, schemaVersion: schema.version, baseline },
  };
}
function positiveRevision(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}
function cursorIdentity(value: unknown, maximum: number) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}
function validCursorFields(value: unknown[]) {
  return (
    cursorIdentity(value[1], 80) &&
    positiveRevision(value[2]) &&
    positiveRevision(value[3]) &&
    (value[4] === null || cursorIdentity(value[4], 200)) &&
    typeof value[5] === "string" &&
    value[5].length > 0
  );
}
function parseCursor(after: string) {
  ensure(
    typeof after === "string" && after.length <= 8192,
    "validation",
    "Invalid coverage cursor",
  );
  let value: unknown;
  try {
    value = JSON.parse(after);
  } catch {
    ensure(false, "validation", "Invalid coverage cursor");
  }
  ensure(
    Array.isArray(value) && value.length === 6 && value[0] === "coverage-v1" && json(value),
    "validation",
    "Invalid coverage cursor",
  );
  ensure(validCursorFields(value), "validation", "Invalid coverage cursor");
  return value;
}
function continuation(query: CoverageEvaluationQuery, value: CoverageContext) {
  const cursor = query.after === undefined ? undefined : parseCursor(query.after);
  if (query.expectedProjectRevision !== undefined) {
    ensure(
      query.baselineId === undefined &&
        Number.isSafeInteger(query.expectedProjectRevision) &&
        query.expectedProjectRevision > 0,
      "validation",
      "Expected project revision is a positive current-state guard",
    );
    ensure(
      query.expectedProjectRevision === value.projectRevision,
      "conflict",
      "Project changed before coverage evaluation",
    );
  }
  if (cursor === undefined) return undefined;
  ensure(
    cursor[1] === query.expectationId && cursor[4] === (query.baselineId ?? null),
    "validation",
    "Coverage cursor belongs to a different expectation or baseline",
  );
  ensure(
    cursor[2] === value.projectRevision && cursor[3] === value.schemaVersion,
    "conflict",
    "Coverage snapshot changed; restart from the first page",
  );
  return cursor[5] as string;
}
function rowResult(row: CoverageNativeRow, minimum: number): CoverageRow {
  if (
    row.distinctTargets === null ||
    row.matchingRelationships === null ||
    row.unresolvedRelationships > 0
  )
    return {
      ...row,
      state: "unknown",
      reason: `${row.unresolvedRelationships} recorded connection endpoints could not be resolved in this snapshot; exact coverage is unknown.`,
    };
  const state = row.distinctTargets >= minimum ? "covered" : "missing";
  return {
    ...row,
    state,
    reason: `${row.distinctTargets} distinct qualifying targets; ${minimum} required. ${row.matchingRelationships} qualifying connections. Structural coverage only.`,
  };
}

/** Authoritative schema policy and native structural evaluation; independent of receipt outcomes. */
export class Coverage {
  private repository: Repository;
  private newId: () => string;
  constructor(repository: Repository, newId: () => string) {
    this.repository = repository;
    this.newId = newId;
  }
  async set(input: CoverageSet, origin: Provenance): Promise<SchemaObject> {
    input = snapshotInput(input);
    const actor = validateProvenance(origin);
    queryShape(input, ["expectations", "expectedSchemaVersion"], "Invalid coverage policy input");
    ensure(
      json(input) &&
        record(input.expectations) &&
        Number.isSafeInteger(input.expectedSchemaVersion) &&
        input.expectedSchemaVersion > 0,
      "validation",
      "Coverage policy needs expectations and a positive expected schema version",
    );
    return this.repository.transaction(async (tx) => {
      const schema = await projectSchema(tx);
      ensure(
        schema.version === input.expectedSchemaVersion,
        "schema_conflict",
        "Model changed before coverage policy update",
      );
      const next: SchemaObject = {
        ...schema,
        version: schema.version + 1,
        coverageExpectations: structuredClone(input.expectations),
      };
      validateSchema(next);
      // Existing native structural definitions are unchanged; no whole-project record scan.
      await tx.beginChangeset(this.newId(), next.version, actor);
      await tx.save("schema", next, schema.version);
      return next;
    });
  }
  async list(query: CoverageListQuery = {}): Promise<CoverageCatalogue> {
    query = snapshotInput(query);
    queryShape(query, ["baselineId"], "Invalid coverage policy query");
    return this.repository.transaction(
      async (tx) => {
        const selected = await context(tx, query);
        return {
          context: selected.context,
          expectations: selected.schema.coverageExpectations ?? {},
        };
      },
      { readOnly: true },
    );
  }
  async evaluate(query: CoverageEvaluationQuery): Promise<CoverageEvaluation> {
    query = snapshotInput(query);
    queryShape(
      query,
      ["expectationId", "baselineId", "expectedProjectRevision", "after", "limit"],
      "Invalid coverage evaluation query",
    );
    ensure(
      typeof query.expectationId === "string" &&
        query.expectationId.length > 0 &&
        query.expectationId.length <= 80 &&
        json(query.expectationId),
      "validation",
      "Choose a coverage expectation identity",
    );
    const limit = query.limit === undefined ? 25 : query.limit;
    validatePageLimit(limit, 100, "Coverage page limit must be 1–100");
    return this.repository.transaction(
      async (tx) => {
        const selected = await context(tx, query),
          after = continuation(query, selected.context);
        const definitions = selected.schema.coverageExpectations ?? {};
        ensure(
          Object.hasOwn(definitions, query.expectationId),
          "not_found",
          "Coverage expectation is not defined in the selected schema",
        );
        const expectation = definitions[query.expectationId];
        const page = await tx.coveragePage({
          expectation,
          limit,
          ...(query.baselineId === undefined
            ? {}
            : { atRevision: selected.context.projectRevision }),
          ...(after === undefined ? {} : { after }),
        });
        const items = page.items.map((row) => rowResult(row, expectation.minimumDistinctTargets));
        return {
          context: selected.context,
          expectationId: query.expectationId,
          expectation,
          rows: {
            items,
            ...(page.nextAfter === undefined
              ? {}
              : {
                  nextAfter: JSON.stringify([
                    "coverage-v1",
                    query.expectationId,
                    selected.context.projectRevision,
                    selected.context.schemaVersion,
                    query.baselineId ?? null,
                    page.nextAfter,
                  ]),
                }),
          },
          summary: {
            scope: "page",
            evaluated: items.length,
            covered: items.filter((row) => row.state === "covered").length,
            missing: items.filter((row) => row.state === "missing").length,
            unknown: items.filter((row) => row.state === "unknown").length,
          },
        };
      },
      { readOnly: true },
    );
  }
}
