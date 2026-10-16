import type { ELK as ElkEngine, ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api.js";
import ELK from "elkjs/lib/elk.bundled.js";
import { absolutePositions, flowEdge, flowNode, nodeSize } from "./flow-geometry.ts";
import type { Display, FlowNode, Geometry, Projection } from "./types.ts";

// The bundled CommonJS export is the constructor; NodeNext sees its namespace.
const elk = new (ELK as unknown as new () => ElkEngine)();

export async function layoutProjection(
  projection: Projection,
  display: Partial<Display> = {},
): Promise<Geometry> {
  const vertical = display.direction === "DOWN";
  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": vertical ? "DOWN" : "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      ...(projection.stageOrder ? { "elk.partitioning.activate": "true" } : {}),
      "elk.spacing.nodeNode": display.spacing === "compact" ? "28" : "54",
      "elk.layered.spacing.nodeNodeBetweenLayers": display.spacing === "compact" ? "20" : "34",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.randomSeed": "1",
      "elk.padding": "[top=20,left=20,bottom=20,right=20]",
    },
    children: [],
    edges: [],
  };
  const definitions = new Map(projection.nodes.map((n) => [n.id, n]));
  const elkNodes = new Map<string, ElkNode>();
  for (const node of projection.nodes) {
    const child = elkDefinition(node, projection);
    elkNodes.set(node.id, child);
    if (node.parentId) elkNodes.get(node.parentId)!.children!.push(child);
    else graph.children!.push(child);
  }
  for (const edge of projection.edges)
    graph.edges!.push({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
      labels: [
        {
          id: `label:${edge.id}`,
          text: edge.label,
          width: Math.min(240, edge.label.length * 6.2 + 36),
          height: 22,
        },
      ],
    });
  const result = await elk.layout(graph);
  const nodes: FlowNode[] = [];
  function collectNodes(parent: ElkNode) {
    for (const child of parent.children ?? []) {
      const definition = definitions.get(child.id);
      nodes.push(
        flowNode(
          definition!,
          { x: child.x ?? 0, y: child.y ?? 0 },
          child.width ?? 220,
          child.height ?? 82,
        ),
      );
      collectNodes(child);
    }
  }
  collectNodes(result);
  const absolute = absolutePositions(nodes);
  const rawEdges: ElkExtendedEdge[] = [];
  function collectEdges(parent: ElkNode) {
    rawEdges.push(...(parent.edges ?? []));
    for (const child of parent.children ?? []) collectEdges(child);
  }
  collectEdges(result);
  const edgeDefinitions = new Map(projection.edges.map((e) => [e.id, e]));
  const edges = rawEdges
    .filter((edge) => edgeDefinitions.has(edge.id))
    .map((edge) => {
      const origin = absolute.get(edge.container ?? "root") ?? { x: 0, y: 0 };
      const points = (edge.sections ?? [])
        .flatMap((section) => [section.startPoint, ...(section.bendPoints ?? []), section.endPoint])
        .map((p) => ({ x: p.x + origin.x, y: p.y + origin.y }));
      const label = edge.labels?.[0];
      const definition = edgeDefinitions.get(edge.id);
      return flowEdge(definition!, {
        ...definition!,
        points,
        labelPosition: label
          ? {
              x: (label.x ?? 0) + origin.x + (label.width ?? 0) / 2,
              y: (label.y ?? 0) + origin.y + (label.height ?? 0) / 2,
            }
          : null,
      });
    });
  return { nodes, edges, absolute, width: result.width, height: result.height };
}

function elkDefinition(node: Projection["nodes"][number], projection: Projection): ElkNode {
  const members = projection.nodes.filter((member) => member.parentId === node.id);
  const order = projection.stageOrder?.indexOf(node.type ?? "") ?? -1;
  return {
    id: node.id,
    ...(members.length ? { children: [] } : nodeSize(node)),
    layoutOptions: {
      ...(order >= 0 ? { "elk.partitioning.partition": String(order) } : {}),
      ...(members.length
        ? {
            "elk.padding": node.organization
              ? "[top=76,left=18,bottom=18,right=18]"
              : "[top=66,left=18,bottom=18,right=18]",
            "elk.spacing.nodeNode": "22",
          }
        : {}),
    },
  };
}
