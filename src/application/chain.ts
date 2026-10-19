import { ensure, record } from "../core/model.ts";
import type { Entity, Relationship, SchemaObject } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";
import type { ChainQuery, ChainTable } from "./views.ts";

/** A bounded, current-data path projection. Columns, not domain types, bound cycles. */
export async function chainTable(
  tx: Transaction,
  schema: SchemaObject,
  query: ChainQuery,
): Promise<ChainTable> {
  validateChainSteps(schema, query.type, query.steps);
  const roots = await tx.query("entity", {
    type: query.type,
    search: query.search,
    after: query.after,
    limit: query.limit ?? 20,
  });
  const rows: ChainTable["rows"] = [];
  const cache = new Map<string, { entity: Entity; relationship: Relationship }[]>();
  const links = new Set<string>();
  const entities = new Map<string, Entity>();
  // Cache each bounded column/source branch, not complete paths: cycles still terminate by column.
  const branch = async (source: Entity, step: ChainQuery["steps"][number], column: number) => {
    const key = `${column}:${source.id}`;
    let children = cache.get(key);
    if (!children) {
      const page = await tx.query("relationship", {
        ...(step.direction === "incoming" ? { target: source.id } : { source: source.id }),
        type: step.relationshipType,
        limit: 1000,
      });
      ensure(!page.nextAfter, "validation", "Chain branch exceeds 1000 links; narrow the chain");
      children = [];
      for (const relationship of page.items as Relationship[]) {
        links.add(relationship.id);
        ensure(
          links.size <= 1000,
          "validation",
          "Chain examines more than 1000 links; narrow the root search or remove columns",
        );
        const entity = await connectedEntity(tx, relationship, step, entities);
        if (entity?.type !== step.type) continue;
        children.push({ entity, relationship });
      }
      cache.set(key, children);
    }
    return children;
  };
  const walk = async (cells: Entity[], path: Relationship[]) => {
    const column = path.length;
    if (column === query.steps.length) {
      ensure(
        rows.length < 300,
        "validation",
        "Chain exceeds 300 rows; narrow the root search or remove columns",
      );
      rows.push({ cells, links: path });
      return;
    }
    const source = cells[cells.length - 1],
      step = query.steps[column];
    const children = await branch(source, step, column);
    if (!children.length) {
      ensure(
        rows.length < 300,
        "validation",
        "Chain exceeds 300 rows; narrow the root search or remove columns",
      );
      rows.push({
        cells: [...cells, ...Array(query.steps.length - column).fill(null)],
        links: [...path, ...Array(query.steps.length - column).fill(null)],
      });
    } else
      for (const child of children)
        await walk([...cells, child.entity], [...path, child.relationship]);
  };
  for (const root of roots.items as Entity[]) await walk([root], []);
  return { schema, roots: roots as ChainTable["roots"], rows };
}

async function connectedEntity(
  tx: Transaction,
  relationship: Relationship,
  step: ChainQuery["steps"][number],
  cache: Map<string, Entity>,
) {
  const endpoint = step.direction === "incoming" ? relationship.source : relationship.target;
  let entity = cache.get(endpoint);
  if (!entity) {
    entity = (await tx.get("entity", endpoint)) as Entity | undefined;
    if (entity) cache.set(entity.id, entity);
  }
  return entity;
}

export function validateChainSteps(schema: SchemaObject, type: string, steps: ChainQuery["steps"]) {
  ensure(
    Array.isArray(steps) && steps.length <= 7,
    "validation",
    "Choose at most eight chain columns",
  );
  ensure(Object.hasOwn(schema.entityTypes, type), "validation", "Unknown chain root type");
  let sourceType = type;
  for (const step of steps) {
    ensure(
      record(step) &&
        Object.keys(step).every((key) => ["type", "relationshipType", "direction"].includes(key)) &&
        typeof step.type === "string" &&
        typeof step.relationshipType === "string" &&
        (step.direction === undefined ||
          step.direction === "incoming" ||
          step.direction === "outgoing"),
      "validation",
      "Invalid chain column",
    );
    const definition = Object.hasOwn(schema.relationshipTypes, step.relationshipType)
      ? schema.relationshipTypes[step.relationshipType]
      : undefined;
    ensure(
      Object.hasOwn(schema.entityTypes, step.type) &&
        definition &&
        (!definition.source ||
          definition.source.includes(step.direction === "incoming" ? step.type : sourceType)) &&
        (!definition.target ||
          definition.target.includes(step.direction === "incoming" ? sourceType : step.type)),
      "validation",
      "Chain columns violate endpoint constraints",
    );
    sourceType = step.type;
  }
}
