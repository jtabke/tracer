import { ensure, record } from "../core/model.ts";
import type { Entity, Relationship } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";
import type { GraphQuery } from "./views.ts";
import type { Receipt } from "../core/evidence.ts";

function validateGraphQuery(query: GraphQuery) {
  ensure(
    record(query) &&
      Object.keys(query).every((key) =>
        ["rootId", "expanded", "depth", "atRevision", "compareRevision"].includes(key),
      ) &&
      typeof query.rootId === "string",
    "validation",
    "Graph needs a root entity ID",
  );
  validateDepth(query.depth);
  const expanded = query.expanded ?? [];
  ensure(
    Array.isArray(expanded) &&
      expanded.length <= 20 &&
      expanded.every((id) => typeof id === "string") &&
      new Set(expanded).size === expanded.length &&
      !expanded.includes(query.rootId),
    "validation",
    "Expand at most 20 distinct neighboring nodes",
  );
  return expanded;
}

function validateDepth(depth: number | undefined) {
  ensure(
    depth === undefined || (Number.isSafeInteger(depth) && depth >= 1 && depth <= 6),
    "validation",
    "Trace depth must be an integer from 1 to 6",
  );
}

export function graphLimits(depth?: number) {
  return depth === undefined ? { nodes: 60, links: 200 } : { nodes: 200, links: 600 };
}

async function addEndpoints(
  tx: Transaction,
  nodes: Map<string, Entity>,
  link: Relationship,
  atRevision?: number,
  limit = 60,
) {
  for (const endpoint of [link.source, link.target]) {
    if (nodes.has(endpoint)) continue;
    ensure(
      nodes.size < limit,
      "validation",
      `Graph exceeds ${limit} nodes; reduce trace depth or choose a smaller root`,
    );
    const node =
      atRevision === undefined
        ? await tx.get("entity", endpoint)
        : await tx.getAt("entity", endpoint, atRevision);
    ensure(node, "referential_integrity", "Graph connection has an unavailable endpoint");
    nodes.set(endpoint, node as Entity);
  }
}

async function addReceiptInputs(
  tx: Transaction,
  nodes: Map<string, Entity>,
  receipt: Receipt,
  limit: number,
) {
  for (const input of receipt.inputs) {
    if (nodes.has(input.entityId)) continue;
    const node = (await tx.get("entity", input.entityId)) as Entity | undefined;
    // Deleted inputs remain explained by the receipt, not editable live nodes.
    if (!node) continue;
    ensure(
      nodes.size < limit,
      "validation",
      `Graph exceeds ${limit} nodes; reduce trace depth or choose a smaller root`,
    );
    nodes.set(node.id, node);
  }
}

async function addReceiptFrontier(
  tx: Transaction,
  nodes: Map<string, Entity>,
  scanned: Set<string>,
  limit = 60,
) {
  // Snapshot this frontier: inputs discovered here are not recursively scanned.
  for (const subject of [...nodes.keys()]) {
    if (scanned.has(subject)) continue;
    scanned.add(subject);
    const receipts = await tx.evidence("receipt", { subject, limit: 50 });
    ensure(
      !receipts.nextAfter,
      "validation",
      "Graph exceeds 50 evaluations; choose a smaller neighborhood",
    );
    for (const receipt of receipts.items as Receipt[])
      await addReceiptInputs(tx, nodes, receipt, limit);
  }
}

async function expandNode(
  tx: Transaction,
  id: string,
  nodes: Map<string, Entity>,
  links: Map<string, Relationship>,
  atRevision?: number,
  limits = graphLimits(),
) {
  const incident =
    atRevision === undefined
      ? await tx.query("relationship", { incident: id, limit: 200 })
      : await tx.incidentAt(id, atRevision, 200);
  ensure(
    !incident.nextAfter,
    "validation",
    "This node has more than 200 connections; choose a narrower root",
  );
  for (const value of incident.items as Relationship[]) {
    links.set(value.id, value);
    ensure(
      links.size <= limits.links,
      "validation",
      `Graph exceeds ${limits.links} connections; reduce trace depth or choose a smaller root`,
    );
    await addEndpoints(tx, nodes, value, atRevision, limits.nodes);
  }
}

async function expandDepth(
  tx: Transaction,
  query: GraphQuery,
  nodes: Map<string, Entity>,
  links: Map<string, Relationship>,
) {
  const visited = new Set<string>();
  let frontier = [query.rootId];
  for (let level = 0; level < query.depth! && frontier.length; level++) {
    const next = new Set<string>();
    for (const id of frontier) {
      visited.add(id);
      await expandNode(tx, id, nodes, links, query.atRevision, graphLimits(query.depth));
      for (const neighbor of unvisitedNeighbors(id, links, visited)) next.add(neighbor);
    }
    frontier = [...next].filter((id) => !visited.has(id));
  }
  return { visited, frontier };
}

function unvisitedNeighbors(id: string, links: Map<string, Relationship>, visited: Set<string>) {
  const neighbors = new Set<string>();
  for (const link of links.values()) {
    if (link.source === id && !visited.has(link.target)) neighbors.add(link.target);
    if (link.target === id && !visited.has(link.source)) neighbors.add(link.source);
  }
  return neighbors;
}

function traceFrontier(links: Map<string, Relationship>, visited: Set<string>) {
  const endpoints = new Set([...links.values()].flatMap((link) => [link.source, link.target]));
  return [...endpoints].filter((id) => !visited.has(id));
}

/** A bounded, explicitly expanded neighborhood, not a whole-project graph scan. */
export async function graphNeighborhood(tx: Transaction, query: GraphQuery) {
  const expanded = validateGraphQuery(query);
  const root = (
    query.atRevision === undefined
      ? await tx.get("entity", query.rootId)
      : await tx.getAt("entity", query.rootId, query.atRevision)
  ) as Entity | undefined;
  if (!root && query.atRevision !== undefined) return missingHistoricalRoot(query);
  ensure(root, "not_found", "Graph root no longer exists");
  const nodes = new Map<string, Entity>([[root.id, root]]),
    links = new Map<string, Relationship>();
  const scanned = new Set<string>();
  const automatic =
    query.depth === undefined ? undefined : await expandDepth(tx, query, nodes, links);
  if (automatic && query.atRevision === undefined)
    await addReceiptFrontier(tx, nodes, scanned, graphLimits(query.depth).nodes);
  for (const id of automatic ? expanded : [root.id, ...expanded]) {
    if (query.atRevision !== undefined && !nodes.has(id)) continue;
    ensure(
      nodes.has(id),
      "validation",
      "Expand only nodes already reached from the root, in discovery order",
    );
    await expandNode(tx, id, nodes, links, query.atRevision, graphLimits(query.depth));
    automatic?.visited.add(id);
    // Receipt-declared inputs are real provenance connections even when no
    // ordinary relationship exists. Include this frontier, not a project scan.
    if (query.atRevision === undefined)
      await addReceiptFrontier(tx, nodes, scanned, graphLimits(query.depth).nodes);
  }
  return {
    rootId: root.id,
    nodes: [...nodes.values()],
    links: [...links.values()],
    expanded: automatic ? [...automatic.visited] : [root.id, ...expanded],
    ...(automatic
      ? {
          trace: {
            depth: query.depth!,
            frontier: traceFrontier(links, automatic.visited),
          },
        }
      : {}),
  };
}

function missingHistoricalRoot(query: GraphQuery) {
  return {
    rootId: query.rootId,
    nodes: [],
    links: [],
    expanded: [],
    ...(query.depth === undefined ? {} : { trace: { depth: query.depth, frontier: [] } }),
  };
}
