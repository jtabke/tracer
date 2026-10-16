import type { Graph } from "../../../src/application/views.ts";
import type { Relationship } from "../../../src/core/model.ts";
import { label } from "../../../ui/fields.tsx";
import { readable } from "../../../ui/presentation-text.ts";
import { traceLayout } from "./graph-trace-layout.ts";

export type Point = { x: number; y: number };
export type Camera = Point & { scale: number };
export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  name: string;
  relationshipId?: string;
  relationship?: Relationship;
  receiptId?: string;
  phase?: "before" | "after";
};
export const nodeWidth = 230,
  nodeHeight = 112;
export { readable, title } from "../../../ui/presentation-text.ts";
export function edges(
  graph: Graph,
  receiptId?: string,
  outputId?: string,
  all = false,
): GraphEdge[] {
  const visible = new Set(graph.nodes.map((node) => node.id));
  return [
    ...graph.links.flatMap((link): GraphEdge[] => {
      const delta = graph.differences?.links.find((value) => value.id === link.id);
      const moved =
        delta?.before &&
        delta.after &&
        (delta.before.source !== delta.after.source || delta.before.target !== delta.after.target);
      const snapshots: { value: Relationship; phase?: "before" | "after" }[] = moved
        ? [
            { value: delta.before!, phase: "before" },
            { value: delta.after!, phase: "after" },
          ]
        : [{ value: link }];
      return snapshots.map(({ value, phase }) => ({
        id: "link:" + link.id + (phase ? ":" + phase : ""),
        source: value.source,
        target: value.target,
        name: readable(value.type) + (phase ? " · " + phase : ""),
        relationshipId: value.id,
        relationship: value,
        phase,
      }));
    }),
    ...graph.evaluations
      .filter((value) =>
        receiptId
          ? value.receipt.id === receiptId
          : !value.comparison.supersededBy.length && (all || value.receipt.output.id === outputId),
      )
      .flatMap(({ receipt }) =>
        receipt.inputs
          .filter((input) => visible.has(input.entityId))
          .map((input) => ({
            id: receipt.id + ":" + input.entityId,
            source: receipt.output.id,
            target: input.entityId,
            name: "evaluated using",
            receiptId: receipt.id,
          })),
      ),
  ];
}
export function layout(graph: Graph): Record<string, Point> {
  if (graph.trace) return traceLayout(graph, edges(graph, undefined, undefined, true));
  const result: Record<string, Point> = { [graph.rootId]: { x: 390, y: 240 } };
  const connections = edges(graph, undefined, undefined, true);
  const incoming = new Set(
    connections.filter((link) => link.target === graph.rootId).map((link) => link.source),
  );
  const outgoing = new Set(
    connections.filter((link) => link.source === graph.rootId).map((link) => link.target),
  );
  const groups = [
    graph.nodes.filter((node) => node.id !== graph.rootId && incoming.has(node.id)),
    graph.nodes.filter(
      (node) => node.id !== graph.rootId && !incoming.has(node.id) && outgoing.has(node.id),
    ),
    graph.nodes.filter(
      (node) => node.id !== graph.rootId && !incoming.has(node.id) && !outgoing.has(node.id),
    ),
  ];
  groups.forEach((group, column) =>
    group
      .sort((a, b) => label(a).localeCompare(label(b)))
      .forEach((node, index) => {
        result[node.id] = {
          x: column === 0 ? 40 : column === 1 ? 740 : 1090 + Math.floor(index / 5) * 350,
          y: 40 + (index % (column === 2 ? 5 : 60)) * 160,
        };
      }),
  );
  return result;
}
export function fit(points: Point[], viewport = { width: 1100, height: 650 }): Camera {
  if (!points.length) return { x: 0, y: 0, scale: 1 };
  const minX = Math.min(...points.map((point) => point.x)),
    minY = Math.min(...points.map((point) => point.y));
  const width = Math.max(...points.map((point) => point.x)) + nodeWidth - minX,
    height = Math.max(...points.map((point) => point.y)) + nodeHeight - minY;
  const scale = Math.min(
    1.1,
    (viewport.width - 100) / (width + 100),
    (viewport.height - 100) / (height + 100),
  );
  return {
    scale,
    x: viewport.width / 2 - (minX + width / 2) * scale,
    y: viewport.height / 2 - (minY + height / 2) * scale,
  };
}
export function zoom(camera: Camera, factor: number, center: Point = { x: 550, y: 325 }): Camera {
  const scale = Math.min(2.5, Math.max(0.15, camera.scale * factor));
  return {
    scale,
    x: center.x - ((center.x - camera.x) * scale) / camera.scale,
    y: center.y - ((center.y - camera.y) * scale) / camera.scale,
  };
}
