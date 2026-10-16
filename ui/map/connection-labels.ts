type Box = { x: number; y: number; width: number; height: number };
import { Position } from "@xyflow/react";
import { manualRoute } from "./edge-route.ts";
import { absolutePositions } from "./flow-geometry.ts";
import { LABEL_HEIGHT, placeLabel } from "./label-placement.ts";
import type { FlowEdge, FlowNode } from "./types.ts";

function ports(source: Box, target: Box, vertical: boolean) {
  if (vertical)
    return {
      sourceX: source.x + source.width / 2,
      sourceY: source.y + source.height,
      targetX: target.x + target.width / 2,
      targetY: target.y,
    };
  return {
    sourceX: source.x + source.width,
    sourceY: source.y + source.height / 2,
    targetX: target.x,
    targetY: target.y + target.height / 2,
  };
}
function labelOrigin(edge: FlowEdge, source: Box, target: Box, vertical: boolean) {
  if (!edge.data.manual) return edge.data.labelPosition;
  return manualRoute({
    source: edge.source,
    target: edge.target,
    data: { vertical, selfWidth: source.width, selfHeight: source.height },
    ...ports(source, target, vertical),
    sourcePosition: vertical ? Position.Bottom : Position.Right,
    targetPosition: vertical ? Position.Top : Position.Left,
  }).labelPosition;
}
function nodeObstacles(nodes: FlowNode[], bounds: Map<string, Box>) {
  return nodes.map((node) => ({
    ...bounds.get(node.id)!,
    height: node.data.open ? (node.data.organization ? 76 : 66) : node.height,
  }));
}
function placeEdge(edge: FlowEdge, bounds: Map<string, Box>, obstacles: Box[], vertical: boolean) {
  const source = bounds.get(edge.source),
    target = bounds.get(edge.target);
  if (!source || !target) return;
  const origin = labelOrigin(edge, source, target, vertical);
  if (!origin) return;
  const width = Math.min(330, edge.label.length * 6.3 + 100);
  const position = placeLabel(origin, width, obstacles);
  obstacles.push({
    x: position.x - width / 2,
    y: position.y - LABEL_HEIGHT / 2,
    width,
    height: LABEL_HEIGHT,
  });
  return { position, origin };
}

// Labels may need new space after a local expansion, even when the nodes stay put.
export function readableLabels(nodes: FlowNode[], edges: FlowEdge[], vertical: boolean) {
  const positions = absolutePositions(nodes);
  const bounds = new Map(
    nodes.map((node) => [
      node.id,
      {
        ...positions.get(node.id)!,
        width: node.width,
        height: node.height,
      },
    ]),
  );
  const obstacles = nodeObstacles(nodes, bounds),
    labels = new Map();
  for (const edge of edges.filter((value) => value.data.showLabel)) {
    const placement = placeEdge(edge, bounds, obstacles, vertical);
    if (placement) labels.set(edge.id, placement);
  }
  return labels;
}
