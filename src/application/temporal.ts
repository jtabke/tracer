import { ensure } from "../core/model.ts";
import type { Entity, Relationship, SchemaObject } from "../core/model.ts";
import type { Transaction } from "../persistence/contracts.ts";
import type { Graph, GraphQuery, NativeDelta } from "./views.ts";
import { graphLimits, graphNeighborhood } from "./graph.ts";

async function revision(tx: Transaction, value: number) {
  ensure(
    Number.isSafeInteger(value) && value > 0,
    "validation",
    "Choose a complete native revision",
  );
  const result = (await tx.changesets(value - 1, 1))[0];
  ensure(result?.projectRevision === value, "validation", "Native revision does not exist");
  return result;
}
async function deltas<T extends Entity | Relationship>(
  tx: Transaction,
  kind: "entity" | "relationship",
  before: T[],
  after: T[],
  from: number,
  to: number,
): Promise<NativeDelta<T>[]> {
  const results: NativeDelta<T>[] = [];
  for (const id of new Set([...before, ...after].map((item) => item.id))) {
    // Neighborhood membership is not object creation/deletion. Resolve both
    // snapshots even when a relink moved an unchanged object out of one side.
    const a = (await tx.getAt(kind, id, from)) as T | undefined;
    const b = (await tx.getAt(kind, id, to)) as T | undefined;
    results.push({
      id,
      before: a ?? null,
      after: b ?? null,
      state: !a ? "added" : !b ? "removed" : a.version !== b.version ? "modified" : "unchanged",
    });
  }
  return results;
}
/** Native snapshots only: evidence has its own ordering and is never replayed here. */
export async function temporalGraph(tx: Transaction, query: GraphQuery): Promise<Graph> {
  const at = await revision(tx, query.atRevision!);
  const schema = (await tx.getAt("schema", "project", at.projectRevision)) as
    SchemaObject | undefined;
  ensure(schema, "validation", "This revision predates the project schema");
  const after = await graphNeighborhood(tx, query);
  const base: Graph = { schema, ...after, evaluations: [], external: [], temporal: { at } };
  if (query.compareRevision === undefined) return base;
  const beforeRevision = await revision(tx, query.compareRevision);
  const before = await graphNeighborhood(tx, {
    ...query,
    atRevision: beforeRevision.projectRevision,
  });
  const nodes = await deltas<Entity>(
      tx,
      "entity",
      before.nodes,
      after.nodes,
      beforeRevision.projectRevision,
      at.projectRevision,
    ),
    links = await deltas<Relationship>(
      tx,
      "relationship",
      before.links,
      after.links,
      beforeRevision.projectRevision,
      at.projectRevision,
    );
  ensure(
    nodes.length <= graphLimits(query.depth).nodes &&
      links.length <= graphLimits(query.depth).links,
    "validation",
    `Comparison exceeds ${graphLimits(query.depth).nodes} nodes / ${graphLimits(query.depth).links} connections; narrow the neighborhood`,
  );
  return {
    ...base,
    temporal: { at, before: beforeRevision },
    differences: { nodes, links },
    nodes: nodes.map((value) => value.after ?? value.before!),
    links: links.map((value) => value.after ?? value.before!),
  };
}

export async function focusedAfter(tx: Transaction, type: string, id?: string, after?: string) {
  if (id === undefined) return after;
  ensure(
    typeof id === "string" && after === undefined,
    "validation",
    "Use either focus or page cursor",
  );
  const entity = (await tx.get("entity", id)) as Entity | undefined;
  ensure(entity?.type === type, "not_found", "Focused entity is not active in this type");
  return tx.entityPredecessor(id, type);
}

export async function nativeTimeline(tx: Transaction, before?: number) {
  const head = await tx.headRevision();
  ensure(
    before === undefined || (Number.isSafeInteger(before) && before > 0 && before <= head + 1),
    "validation",
    "Invalid timeline cursor",
  );
  const end = (before ?? head + 1) - 1;
  // Project revision gaps from imported legacy histories are allowed.
  const changesets = await tx.changesets(0, 1);
  const start = Math.max(0, end - 200);
  const items = (await tx.changesets(start, 200)).filter((item) => item.projectRevision <= end);
  return {
    head,
    items,
    ...(changesets[0]?.projectRevision <= start ? { nextBefore: start + 1 } : {}),
  };
}
