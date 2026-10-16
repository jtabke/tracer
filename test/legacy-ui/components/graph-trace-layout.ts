import type { Graph } from "../../../src/application/views.ts";
import { label } from "../../../ui/fields.tsx";
import type { GraphEdge, Point } from "./graph-model.ts";

type Level = { distance: number; side: number };

/** One identity per node; layers follow shortest recorded-link distance, never type-name inference. */
export function traceLayout(graph: Graph, connections: GraphEdge[]): Record<string, Point> {
  const levels = traceLevels(graph.rootId, connections);
  const rows = new Map<number, number>();
  const points: Record<string, Point> = { [graph.rootId]: { x: 390, y: 240 } };
  for (const node of [...graph.nodes].sort((a, b) => label(a).localeCompare(label(b)))) {
    if (node.id === graph.rootId) continue;
    const level = levels.get(node.id) ?? { side: 1, distance: 2 };
    const column = level.side * level.distance;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    points[node.id] = { x: 390 + column * 350, y: 40 + row * 160 };
  }
  return points;
}
function traceLevels(root: string, connections: GraphEdge[]) {
  const levels = new Map<string, Level>([[root, { distance: 0, side: 0 }]]);
  const queue = [root];
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    const parent = levels.get(id)!;
    for (const edge of connections) {
      const other = neighbor(edge, id);
      if (!other || levels.has(other)) continue;
      const side = parent.side || (edge.target === id ? -1 : 1);
      levels.set(other, { distance: parent.distance + 1, side });
      queue.push(other);
    }
  }
  return levels;
}
function neighbor(edge: GraphEdge, id: string) {
  if (edge.source === id) return edge.target;
  if (edge.target === id) return edge.source;
  return undefined;
}
