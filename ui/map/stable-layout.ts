import { absolutePositions, flowEdge, flowNode, nodeSize } from "./flow-geometry.ts";
import type { Display, FlowNode, Geometry, NodeDefinition, Projection } from "./types.ts";
// Incremental placement for changing detail. ELK remains the explicit Arrange action.
// Work in parent-relative coordinates so dragging a group also preserves its children.
export function stableLayout(
  projection: Projection,
  display: Partial<Display>,
  previous: Geometry,
  anchorId: string | null | undefined,
): Geometry {
  const old = new Map(previous.nodes.map((node) => [node.id, node]));
  const definitions = new Map(projection.nodes.map((node) => [node.id, node]));
  const children = new Map<string, NodeDefinition[]>();
  for (const node of projection.nodes) {
    const key = node.parentId ?? "root";
    if (!children.has(key)) children.set(key, []);
    children.get(key)!.push(node);
  }
  const anchored = new Set<string>();
  for (let id = anchorId; id && definitions.has(id); id = definitions.get(id)!.parentId)
    anchored.add(id);
  const vertical = display.direction === "DOWN";
  const axis = vertical ? "y" : "x";
  const size = vertical ? "height" : "width";
  const gap = display.spacing === "compact" ? 28 : 54;
  const nodes: FlowNode[] = [];
  const intersects = (a: FlowNode, b: FlowNode, space: number) =>
    a.position.x < b.position.x + b.width + space &&
    a.position.x + a.width + space > b.position.x &&
    a.position.y < b.position.y + b.height + space &&
    a.position.y + a.height + space > b.position.y;
  const unchanged = (node: FlowNode) => {
    const before = old.get(node.id);
    return (
      before &&
      before.parentId === node.parentId &&
      before.position.x === node.position.x &&
      before.position.y === node.position.y &&
      before.width === node.width &&
      before.height === node.height
    );
  };
  function place(parentId: string): FlowNode[] {
    const members = children.get(parentId) ?? [];
    const parent = definitions.get(parentId);
    const inset = parent ? 18 : 20;
    const top = parent ? (parent.organization ? 76 : 66) : 20;
    const spacing = parent ? 22 : gap;
    const vacated = previous.nodes.filter(
      (node) => (node.parentId ?? "root") === parentId && !definitions.has(node.id),
    );
    const placed = members.map((definition, index) => {
      const before = old.get(definition.id);
      const retained = before && before.parentId === definition.parentId;
      const slot = retained ? before : vacated.shift();
      const descendants = place(definition.id);
      const minimum = nodeSize(definition);
      let width = Math.max(
        minimum.width,
        ...descendants.map((node) => node.position.x + node.width + 18),
      );
      let height = Math.max(
        minimum.height,
        ...descendants.map((node) => node.position.y + node.height + 18),
      );
      if (
        retained &&
        before.data.open === definition.open &&
        previous.nodes.filter((node) => node.parentId === definition.id).length ===
          descendants.length &&
        descendants.every(unchanged)
      ) {
        width = before.width;
        height = before.height;
      }
      const position = initialSlot(definition, slot, index, vertical, inset, top, spacing);
      return flowNode(definition, position, width, height);
    });
    // Protect the opened branch, then existing siblings, before finding slots for additions.
    const ordered = [...placed].sort(
      (a, b) =>
        Number(anchored.has(b.id)) - Number(anchored.has(a.id)) ||
        Number(old.has(b.id)) - Number(old.has(a.id)) ||
        a.position[axis] - b.position[axis],
    );
    const occupied: FlowNode[] = [];
    for (const node of ordered) {
      let blocker;
      while (
        (blocker = occupied.find(
          (other) => intersects(node, other, spacing) && !(unchanged(node) && unchanged(other)),
        ))
      )
        node.position[axis] = blocker.position[axis] + blocker[size] + spacing;
      occupied.push(node);
    }
    nodes.push(...placed);
    return placed;
  }
  const roots = place("root");
  // React Flow requires parents before children.
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const orderedNodes: FlowNode[] = [];
  function collect(id: string) {
    const node = byId.get(id)!;
    orderedNodes.push(node);
    for (const child of children.get(id) ?? []) collect(child.id);
  }
  for (const node of roots) collect(node.id);
  const absolute = absolutePositions(orderedNodes);
  const oldAbsolute = absolutePositions(previous.nodes);
  function sameBounds(id: string) {
    const before = oldAbsolute.get(id),
      after = absolute.get(id);
    return (
      before &&
      after &&
      before.x === after.x &&
      before.y === after.y &&
      old.get(id)!.width === byId.get(id)!.width &&
      old.get(id)!.height === byId.get(id)!.height
    );
  }
  const previousEdges = new Map(previous.edges.map((edge) => [edge.id, edge]));
  const edges = projection.edges.map((definition) => {
    const before = previousEdges.get(definition.id);
    const keepRoute = before && sameBounds(definition.source) && sameBounds(definition.target);
    return flowEdge(definition, {
      ...(keepRoute ? before.data : { points: [], labelPosition: null, manual: true }),
      ...definition,
    });
  });
  return {
    nodes: orderedNodes,
    edges,
    absolute,
    width: Math.max(0, ...roots.map((node) => node.position.x + node.width + 20)),
    height: Math.max(0, ...roots.map((node) => node.position.y + node.height + 20)),
  };
}

function initialSlot(
  definition: NodeDefinition,
  slot: FlowNode | undefined,
  index: number,
  vertical: boolean,
  inset: number,
  top: number,
  spacing: number,
) {
  if (slot) return { ...slot.position };
  if (definition.initialPosition) return { ...definition.initialPosition };
  const width = definition.kind === "group" ? 248 : 220,
    height = definition.kind === "group" ? 100 : 82;
  return {
    x: inset + (vertical ? index % 2 : Math.floor(index / 2)) * (width + spacing),
    y: top + (vertical ? Math.floor(index / 2) : index % 2) * (height + spacing),
  };
}
