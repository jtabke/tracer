import { expectVersion } from "./version-guard.ts";
import { ensure, json, record } from "../core/model.ts";
import type { ObjectQuery, SchemaObject, Stored } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";

export async function projectSchema(
  tx: Transaction,
  expectedVersion?: number,
): Promise<SchemaObject> {
  const schema = await tx.get("schema", "project");
  ensure(schema, "validation", "Define a schema first");
  if (expectedVersion !== undefined)
    expectVersion(schema.version, expectedVersion, true, { kind: "schema", id: "project" });
  return schema;
}
export async function* nativePages(
  tx: Transaction,
  kind: "entity" | "relationship",
  query: ObjectQuery = {},
) {
  let after: string | undefined;
  do {
    const page = await tx.query(kind, { ...query, after, limit: 1000 });
    yield page.items;
    after = page.nextAfter;
  } while (after !== undefined);
}

export async function nativeObjects(
  tx: Transaction,
  kind: "entity" | "relationship",
  query: ObjectQuery = {},
) {
  const items: Stored[] = [];
  for await (const page of nativePages(tx, kind, query)) items.push(...page);
  return items;
}
export function queryShape(
  value: unknown,
  allowed: string[],
  message: string,
): asserts value is Record<string, unknown> {
  ensure(
    record(value) && Object.keys(value).every((key) => allowed.includes(key)),
    "validation",
    message,
  );
}
export function validatePageLimit(
  limit = 100,
  maximum = 1000,
  message = "Page limit must be 1–1000",
) {
  ensure(Number.isSafeInteger(limit) && limit > 0 && limit <= maximum, "validation", message);
}
export function validateObjectQuery(query: ObjectQuery, kind: "entity" | "relationship") {
  ensure(record(query), "validation", "Query must be an object");
  const allowed =
    kind === "entity"
      ? ["type", "key", "after", "limit", "search"]
      : ["type", "source", "target", "incident", "after", "limit"];
  for (const [key, value] of Object.entries(query))
    ensure(
      allowed.includes(key) &&
        (value === undefined || key === "limit" || typeof value === "string"),
      "validation",
      "Invalid query filter: " + key,
    );
  ensure(
    query.search === undefined || (json(query.search) && query.search.length <= 200),
    "validation",
    "Search must be JSON-safe text of at most 200 characters",
  );
  validatePageLimit(query.limit);
}
