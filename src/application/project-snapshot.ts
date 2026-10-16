import { ensure } from "../core/model.ts";
import type { Entity, Relationship, SchemaObject } from "../core/model.ts";
import type { ProjectSnapshot } from "../core/project-snapshot.ts";
import type { Transaction } from "../persistence/contracts.ts";

export const MAP_RECORD_LIMIT = 10_000;
export const MAP_CONNECTION_LIMIT = 100_000;

export async function projectSnapshot(tx: Transaction): Promise<ProjectSnapshot> {
  const entities = (await boundedObjects(tx, "entity", MAP_RECORD_LIMIT)) as Entity[];
  const relationships = (await boundedObjects(
    tx,
    "relationship",
    MAP_CONNECTION_LIMIT,
  )) as Relationship[];
  return {
    schema: ((await tx.get("schema", "project")) as SchemaObject | undefined) ?? null,
    projectRevision: await tx.headRevision(),
    entities,
    relationships,
  };
}

async function boundedObjects(tx: Transaction, kind: "entity" | "relationship", maximum: number) {
  const items = [];
  let after: string | undefined;
  do {
    const page = await tx.query(kind, { after, limit: Math.min(1000, maximum - items.length + 1) });
    items.push(...page.items);
    ensure(
      items.length <= maximum,
      "validation",
      `The development map supports up to ${MAP_RECORD_LIMIT.toLocaleString("en-US")} records and ${MAP_CONNECTION_LIMIT.toLocaleString("en-US")} connections. This project exceeds that bound; no partial map was returned. Use the paged headless queries for this project.`,
    );
    after = page.nextAfter;
  } while (after !== undefined);
  return items;
}
