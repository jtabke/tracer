import { ensure, json, record } from "../core/model.ts";
import type { ObjectQuery, SchemaObject, Stored } from "../core/model.ts";
import type { Transaction } from "../persistence/contracts.ts";

export async function projectSchema(tx: Transaction): Promise<SchemaObject> {
  const schema = (await tx.get("schema", "project")) as SchemaObject | undefined;
  ensure(schema, "validation", "Define a schema first");
  return schema;
}
/** Used only by whole-schema validation, cascade deletion and bounded traversal owners. */
export async function nativeObjects(
  tx: Transaction,
  kind: "entity" | "relationship",
  query: ObjectQuery = {},
) {
  const items: Stored[] = [];
  let after: string | undefined;
  do {
    const page = await tx.query(kind, { ...query, after, limit: 1000 });
    items.push(...page.items);
    after = page.nextAfter;
  } while (after !== undefined);
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
