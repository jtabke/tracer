import type { Schema } from "../src/core/model.ts";

export type ModelNode = { name: string; x: number; y: number; central: boolean };
export type ModelRoute = { name: string; source: ModelNode; target: ModelNode };
const maxTypes = 9;
const maxRoutes = 24;

// A bounded type projection, never a census of recorded items or inferred hierarchy.
export function modelLayout(schema: Schema, focus: string) {
  const names = Object.keys(schema.entityTypes);
  const center = modelFocus(schema, focus);
  const neighbors = names.filter((name) => name !== center);
  const visible = center ? [center, ...neighbors.slice(0, maxTypes - 1)] : [];
  const nodes = visible.map((name, index) => {
    const angle = Math.PI + ((index - 1) * Math.PI * 2) / Math.max(visible.length - 1, 1);
    return {
      name,
      central: index === 0,
      x: index ? 500 + 355 * Math.cos(angle) : 500,
      y: index ? 300 + 210 * Math.sin(angle) : 300,
    };
  });
  return { nodes, ...boundedRoutes(schema, nodes), omittedTypes: names.length - nodes.length };
}

function boundedRoutes(schema: Schema, nodes: ModelNode[]) {
  const routes: ModelRoute[] = [];
  let total = 0;
  for (const [name, definition] of Object.entries(schema.relationshipTypes)) {
    // Omitted sets mean Any, not evidence of every connection.
    const sources = nodes.filter((node) => definition.source?.includes(node.name));
    const targets = nodes.filter((node) => definition.target?.includes(node.name));
    total += sources.length * targets.length;
    const pairs = sources.flatMap((source) => targets.map((target) => ({ name, source, target })));
    routes.push(...pairs.slice(0, maxRoutes - routes.length));
  }
  return { routes, omittedRoutes: total - routes.length };
}

export function routeGeometry(route: ModelRoute, index: number) {
  const { source, target } = route;
  if (source.name === target.name) {
    return {
      path: `M ${source.x - 55} ${source.y - 45} C ${source.x - 120} ${source.y - 140}, ${source.x + 120} ${source.y - 140}, ${source.x + 55} ${source.y - 45}`,
      x: source.x,
      y: source.y - 110,
    };
  }
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  const boundary = (node: ModelNode) =>
    node.central
      ? Math.min(90 / Math.max(Math.abs(dx), 1), 45 / Math.max(Math.abs(dy), 1))
      : 70 / length;
  const start = boundary(source);
  const end = boundary(target);
  const bend = 25 + (index % 3) * 18;
  const x = (source.x + target.x) / 2 - (dy / length) * bend;
  const y = (source.y + target.y) / 2 + (dx / length) * bend;
  return {
    path: `M ${source.x + dx * start} ${source.y + dy * start} Q ${x} ${y} ${target.x - dx * end} ${target.y - dy * end}`,
    x,
    y,
  };
}

function modelFocus(schema: Schema, focus: string) {
  const names = Object.keys(schema.entityTypes);
  const degree = (name: string) =>
    Object.values(schema.relationshipTypes).filter(
      (definition) => definition.source?.includes(name) || definition.target?.includes(name),
    ).length;
  return names.includes(focus) ? focus : [...names].sort((a, b) => degree(b) - degree(a))[0];
}
