import type { Graph } from "../../../src/application/views.ts";
import type { Entity } from "../../../src/core/model.ts";
import type { GraphEdge } from "./graph-model.ts";

export type GraphTime = { atRevision: number; compareRevision?: number };
export type Selection = { kind: "node"; node: Entity } | { kind: "edge"; edge: GraphEdge };
export type Inspection = { selection?: Selection; receipt?: string };
export type LoadedGraph = { endpoint: string; graph: Graph };

/** Preserve the canvas mount, but never reuse live content in a temporal request. */
export function visibleGraph(
  loaded: LoadedGraph | undefined,
  root: string,
  endpoint: string | undefined,
  historical: boolean,
): Graph | undefined {
  if (!loaded || loaded.graph.rootId !== root) return undefined;
  if (loaded.endpoint === endpoint || (!historical && !loaded.graph.temporal)) return loaded.graph;
  return {
    ...loaded.graph,
    nodes: [],
    links: [],
    evaluations: [],
    external: [],
    differences: undefined,
  };
}

/** Only current inspectors may retain a captured snapshot after a failed read. */
export function resolveSelection(
  graph: Graph | undefined,
  selection: Selection | undefined,
  historical: boolean,
  sharedId?: string,
): { node?: Entity; edge?: GraphEdge } {
  if (!selection)
    return { node: historical ? undefined : graph?.nodes.find((node) => node.id === sharedId) };
  if (selection.kind === "node")
    return {
      node:
        graph?.nodes.find((node) => node.id === selection.node.id) ??
        (historical ? undefined : selection.node),
    };
  if (!historical) return { edge: selection.edge };
  const relationship = graph?.links.find((link) => link.id === selection.edge.relationshipId);
  return relationship ? { edge: { ...selection.edge, relationship } } : {};
}

/** A picker hit is preferred, then the loaded graph, then the exact captured node. */
export function resolveFocusNode(
  items: Entity[] | undefined,
  graph: Graph | undefined,
  selection: Selection | undefined,
  id: string,
) {
  const captured =
    selection?.kind === "node" && selection.node.id === id ? selection.node : undefined;
  return (
    items?.find((node) => node.id === id) ?? graph?.nodes.find((node) => node.id === id) ?? captured
  );
}
export function shouldAdoptSharedFocus(
  visible: boolean,
  shared: { id: string } | undefined,
  historical: boolean,
  handled: string | undefined,
  dirty: boolean,
) {
  return visible && Boolean(shared) && !historical && handled !== shared?.id && !dirty;
}
