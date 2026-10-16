import type {
  EdgeData,
  EdgeDefinition,
  FlowEdge,
  FlowNode,
  NodeDefinition,
  Point,
} from "./types.ts";
// ELK and incremental placement must produce the same React Flow node/edge contract.
function ordinarySize(node: NodeDefinition) {
  return node.kind === "group"
    ? node.organization
      ? { width: 248, height: 100 }
      : { width: 214, height: 94 }
    : { width: 220, height: 82 };
}
export function nodeSize(node: NodeDefinition) {
  if (node.walk || node.showFolder) return { width: 280, height: 126 };
  return ordinarySize(node);
}
export function flowNode(
  definition: NodeDefinition,
  position: Point,
  width: number,
  height: number,
): FlowNode {
  return {
    id: definition.id,
    type: definition.kind === "group" ? "modelGroup" : "record",
    position,
    width,
    height,
    style: { width, height },
    data: definition,
    ...(definition.parentId
      ? { parentId: definition.parentId, extent: "parent", zIndex: 2 }
      : { zIndex: 0 }),
    ...(definition.kind === "group" ? { dragHandle: ".group-heading" } : {}),
    draggable: true,
    connectable: false,
    selectable: true,
  };
}
export function flowEdge(definition: EdgeDefinition, data: EdgeData): FlowEdge {
  return {
    ...definition,
    type: "routed",
    zIndex: 1,
    markerEnd: { type: "arrowclosed", color: "#7c959c", width: 14, height: 14 },
    data,
  };
}

// React Flow geometry is parent-first; keep one conversion to absolute coordinates.
export function absolutePositions(nodes: Pick<FlowNode, "id" | "parentId" | "position">[]) {
  const points = new Map([["root", { x: 0, y: 0 }]]);
  for (const node of nodes) {
    const parent = points.get(node.parentId ?? "root") ?? { x: 0, y: 0 };
    points.set(node.id, { x: parent.x + node.position.x, y: parent.y + node.position.y });
  }
  return points;
}
