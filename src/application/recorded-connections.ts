import type { Entity, Relationship, SchemaObject } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";
import type { RecordedConnections, RecordedConnectionsQuery } from "./views.ts";

/** One snapshot and one bounded link page; deduplicate at most 50 endpoint reads. */
export async function recordedConnections(
  tx: Transaction,
  schema: SchemaObject,
  query: RecordedConnectionsQuery,
): Promise<RecordedConnections> {
  const page = await tx.query("relationship", { ...query, limit: query.limit ?? 25 });
  const items = page.items as Relationship[];
  const endpoints: RecordedConnections["endpoints"] = [];
  for (const id of new Set(items.flatMap((link) => [link.source, link.target]))) {
    const entity = (await tx.get("entity", id)) as Entity | undefined;
    if (!entity) continue;
    endpoints.push({
      id: entity.id,
      type: entity.type,
      ...(entity.key === undefined ? {} : { key: entity.key }),
      ...(typeof entity.fields.title === "string" ? { title: entity.fields.title } : {}),
    });
  }
  return { schema, relationships: { ...page, items }, endpoints };
}
