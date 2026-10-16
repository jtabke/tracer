import type { GraphEdge, Point } from "./graph-model.ts";
import { nodeHeight, nodeWidth } from "./graph-model.ts";

export function graphEdgeGeometry(
  edge: GraphEdge,
  points: Record<string, Point>,
  connections: GraphEdge[],
) {
  const from = points[edge.source],
    to = points[edge.target];
  if (!from || !to) return undefined;
  const duplicate = connections
    .filter((value) => value.source === edge.source && value.target === edge.target)
    .findIndex((value) => value.id === edge.id);
  const bend = 35 + duplicate * 26;
  const left = to.x < from.x;
  const x1 = from.x + edgePortOffset(left),
    y1 = from.y + nodeHeight / 2,
    x2 = to.x + edgePortOffset(!left),
    y2 = to.y + nodeHeight / 2;
  const path =
    edge.source === edge.target
      ? `M${from.x + nodeWidth} ${y1} C${from.x + nodeWidth + 110} ${from.y - 100}, ${from.x - 80} ${from.y - 100}, ${from.x} ${y1}`
      : `M${x1} ${y1} C${(x1 + x2) / 2} ${y1 - bend}, ${(x1 + x2) / 2} ${y2 - bend}, ${x2} ${y2}`;
  return { path, x1, x2, y1, y2, bend };
}

function edgePortOffset(left: boolean) {
  return left ? 0 : nodeWidth;
}
