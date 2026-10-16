import type { Direction, EdgeDefinition, Projection, Route } from "./types.ts";
type Step = { to: string; edge: string };
type Adjacency = Map<string, Step[]>;
type Previous = Map<string, { from: string; edge: string } | null>;
const emptyRoute = (): Route => ({ found: false, nodeIds: [], edgeIds: [], nextEdgeIds: [] });
function addStep(adjacent: Adjacency, from: string, to: string, edge: string) {
  const bucket = adjacent.get(from) ?? [];
  bucket.push({ to, edge });
  adjacent.set(from, bucket);
}
function recordedEdge(edge: EdgeDefinition, ids: Set<string>) {
  return !!edge.linkIds.length && ids.has(edge.source) && ids.has(edge.target);
}
function routeAdjacency(
  graph: Pick<Projection, "nodes" | "edges">,
  ids: Set<string>,
  direction: Direction,
) {
  const adjacent: Adjacency = new Map();
  for (const edge of [...graph.edges].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!recordedEdge(edge, ids)) continue;
    if (direction !== "upstream") addStep(adjacent, edge.source, edge.target, edge.id);
    if (direction !== "downstream") addStep(adjacent, edge.target, edge.source, edge.id);
  }
  return adjacent;
}
function validRetainedRoute(route: Route, starts: string[], ids: Set<string>, adjacent: Adjacency) {
  if (!route.found || !starts.includes(route.nodeIds[0])) return false;
  if (!route.nodeIds.every((id) => ids.has(id))) return false;
  return route.edgeIds.every((id, i) =>
    (adjacent.get(route.nodeIds[i]) ?? []).some(
      (step) => step.edge === id && step.to === route.nodeIds[i + 1],
    ),
  );
}
function routeResult(
  nodeIds: string[],
  edgeIds: string[],
  target: string,
  adjacent: Adjacency,
): Route {
  const nextEdgeIds = [
    ...new Set(
      (adjacent.get(target) ?? []).map((step) => step.edge).filter((id) => !edgeIds.includes(id)),
    ),
  ];
  return { found: true, nodeIds, edgeIds, nextEdgeIds };
}
function retainedRoute(
  previous: Route | null,
  starts: string[],
  ids: Set<string>,
  target: string,
  adjacent: Adjacency,
) {
  if (!previous || !validRetainedRoute(previous, starts, ids, adjacent)) return null;
  const at = previous.nodeIds.indexOf(target);
  const extension = (adjacent.get(previous.nodeIds.at(-1)!) ?? []).find(
    (step) => step.to === target,
  );
  if (at < 0 && !extension) return null;
  const nodeIds = at >= 0 ? previous.nodeIds.slice(0, at + 1) : [...previous.nodeIds, target];
  const edgeIds = at >= 0 ? previous.edgeIds.slice(0, at) : [...previous.edgeIds, extension!.edge];
  return routeResult(nodeIds, edgeIds, target, adjacent);
}
function breadthFirst(starts: string[], target: string, adjacent: Adjacency) {
  const queue = [...starts],
    previous: Previous = new Map(starts.map((id) => [id, null]));
  for (let i = 0; i < queue.length && !previous.has(target); i++) {
    for (const step of adjacent.get(queue[i]) ?? []) {
      if (previous.has(step.to)) continue;
      previous.set(step.to, { from: queue[i], edge: step.edge });
      queue.push(step.to);
    }
  }
  return previous;
}
function reconstruct(previous: Previous, target: string) {
  const nodeIds = [target],
    edgeIds: string[] = [];
  for (let step = previous.get(target); step; step = previous.get(step.from)) {
    edgeIds.unshift(step.edge);
    nodeIds.unshift(step.from);
  }
  return { nodeIds, edgeIds };
}
// One deterministic recorded route in the drawn neighborhood, not an impact claim.
export function traceEmphasis(
  graph: Pick<Projection, "nodes" | "edges">,
  roots: string[],
  target: string | null,
  direction: Direction = "downstream",
  previousRoute: Route | null = null,
): Route {
  if (!target) return emptyRoute();
  const ids = new Set(graph.nodes.map((node) => node.id)),
    starts = roots.filter((id) => ids.has(id));
  const adjacent = routeAdjacency(graph, ids, direction);
  const retained = retainedRoute(previousRoute, starts, ids, target, adjacent);
  if (retained) return retained;
  const previous = breadthFirst(starts, target, adjacent);
  if (!previous.has(target)) return emptyRoute();
  const { nodeIds, edgeIds } = reconstruct(previous, target);
  return routeResult(nodeIds, edgeIds, target, adjacent);
}
