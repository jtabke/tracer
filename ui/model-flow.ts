import type { Schema } from "../src/core/model.ts";

export type FlowType = { name: string; x: number; y: number; index: number };
export type FlowRoute = {
  name: string;
  label: string;
  feedback: boolean;
  source: FlowType;
  target: FlowType;
  key: string;
};

// Declaration order is a presentation choice, never an inferred development stage.
// Keep native endpoint alternatives; Any/None are shown in the connection key instead.
export function modelFlow(
  schema: Schema,
  mode: "trace" | "workflow" = "trace",
  participantsOnly = false,
) {
  const names = Object.keys(schema.entityTypes);
  const rows = Math.max(1, Math.ceil(names.length / 4));
  const nodes = names.map((name, index) => ({
    name,
    index,
    x: 48 + Math.floor(index / rows) * 270,
    y: 85 + (index % rows) * 140,
  }));
  const routes = modelRoutes(schema, nodes, mode);
  if (mode === "workflow")
    return workflowPositions(workflowParticipants(nodes, routes, participantsOnly), routes);

  return { nodes, routes, width: 1110, height: 70 + rows * 140 };
}

function workflowParticipants(nodes: FlowType[], routes: FlowRoute[], participantsOnly: boolean) {
  if (!participantsOnly || !routes.length) return nodes;
  const names = new Set(routes.flatMap((route) => [route.source.name, route.target.name]));
  return nodes.filter((node) => names.has(node.name));
}

export function flowPath({ source, target }: FlowRoute, index: number) {
  const sx = source.x + 190,
    sy = source.y + 36,
    tx = target.x,
    ty = target.y + 36;
  const offset = (index % 4) * 6;
  if (source.name === target.name || target.x <= source.x) {
    const channel = Math.min(source.y, target.y) - 40 - offset;
    return `M ${sx} ${sy} C ${sx + 80} ${channel}, ${tx - 80} ${channel}, ${tx} ${ty}`;
  }
  if (target.x - source.x > 420) {
    const channel = Math.max(source.y, target.y) + 110 + offset;
    return `M ${sx} ${sy} L ${sx + 24} ${sy} L ${sx + 24} ${channel} L ${tx - 24} ${channel} L ${tx - 24} ${ty} L ${tx} ${ty}`;
  }
  const bend = (sx + tx) / 2;
  return `M ${sx} ${sy} C ${bend} ${sy}, ${bend} ${ty}, ${tx} ${ty}`;
}

function modelRoutes(schema: Schema, nodes: FlowType[], mode: "trace" | "workflow"): FlowRoute[] {
  const byName = new Map(nodes.map((node) => [node.name, node]));
  return Object.entries(schema.relationshipTypes).flatMap(([name, definition]) => {
    if (mode === "workflow")
      return (definition.workflow ?? []).flatMap((route) => {
        const source = byName.get(route.direction === "forward" ? route.source : route.target);
        const target = byName.get(route.direction === "forward" ? route.target : route.source);
        return source && target
          ? [
              {
                name,
                label: route.label,
                feedback: route.feedback ?? false,
                source,
                target,
                key: `${name}:${route.source}:${route.target}:${route.direction}`,
              },
            ]
          : [];
      });
    const sources = nodes.filter((node) => definition.source?.includes(node.name));
    const targets = nodes.filter((node) => definition.target?.includes(node.name));
    return sources.flatMap((source) =>
      targets.map((target) => ({
        name,
        label: name.replaceAll("_", " "),
        feedback: false,
        source,
        target,
        key: `${name}:${source.name}:${target.name}`,
      })),
    );
  });
}

function workflowPositions(nodes: FlowType[], routes: FlowRoute[]) {
  const ranks = workflowRanks(nodes, routes);
  const spacing = nodes.length <= 4 ? 294 : 330;
  const rows = new Map<number, number>();
  const positions = nodes.map((node) => {
    const rank = ranks.get(node.name) ?? 0;
    const row = rows.get(rank) ?? 0;
    rows.set(rank, row + 1);
    return { ...node, x: 48 + rank * spacing, y: 85 + row * 140 };
  });
  const byName = new Map(positions.map((node) => [node.name, node]));
  return {
    nodes: positions,
    routes: routes.map((route) => ({
      ...route,
      source: byName.get(route.source.name)!,
      target: byName.get(route.target.name)!,
    })),
    width: Math.max(1110, ...positions.map((node) => node.x + 250)),
    height: Math.max(220, ...positions.map((node) => node.y + 140)),
  };
}
function workflowRanks(nodes: FlowType[], routes: FlowRoute[]) {
  const forward = routes.filter(
    (route) => !route.feedback && route.source.name !== route.target.name,
  );
  const ranks = new Map<string, number>();
  const remaining = new Set(nodes.map((node) => node.name));
  for (let pass = 0; pass < nodes.length; pass++) {
    let progressed = false;
    for (const name of [...remaining]) {
      const parents = forward
        .filter((route) => route.target.name === name)
        .map((route) => route.source.name);
      if (parents.some((parent) => remaining.has(parent))) continue;
      ranks.set(name, Math.max(0, ...parents.map((parent) => (ranks.get(parent) ?? 0) + 1)));
      remaining.delete(name);
      progressed = true;
    }
    if (!progressed) break;
  }
  return ranks;
}

/** One declared input route per type gives a legible overview, not a mandatory process.
 * Complete alternatives remain available by focusing a type or relationship. */
export function overviewRoutes(routes: FlowRoute[], nodes: FlowType[]) {
  const overview: FlowRoute[] = [];
  for (const node of nodes) {
    const inputs = routes.filter(
      (route) => route.target.name === node.name && route.source.name !== node.name,
    );
    const preceding = inputs.filter((route) => route.source.index < node.index);
    const choices = preceding.length ? preceding : inputs;
    const first = choices
      .filter((route) => route.name === choices[0]?.name)
      .sort((a, b) => b.source.index - a.source.index)[0];
    if (first) overview.push(first);
  }
  const selfOnly = routes.filter(
    (route) =>
      route.source.name === route.target.name &&
      routes.filter((candidate) => candidate.name === route.name).length === 1,
  );
  const families = [...new Set(routes.map((route) => route.name))];
  const representatives = families.map(
    (name) =>
      routes
        .filter((route) => route.name === name)
        .sort((a, b) => routeDistance(a) - routeDistance(b))[0],
  );
  return [
    ...new Map(
      [...overview, ...selfOnly, ...representatives].map((route) => [route.key, route]),
    ).values(),
  ];
}

function routeDistance(route: FlowRoute) {
  const distance = route.target.index - route.source.index;
  return distance > 0 ? distance : 1000 + Math.abs(distance);
}

export function routeActive(route: FlowRoute, focus: string, relationship: string) {
  if (relationship) return route.name === relationship;
  if (focus) return route.source.name === focus || route.target.name === focus;
  return true;
}

/** Focus keeps one identity for types that both feed and receive from the selected type. */
export function focusFlow(flow: ReturnType<typeof modelFlow>, focus: string) {
  const center = flow.nodes.find((node) => node.name === focus);
  if (!center) return flow;
  const routes = flow.routes.filter((route) => routeActive(route, focus, ""));
  const inputs = new Set(
    routes.filter((route) => route.target.name === focus).map((route) => route.source.name),
  );
  inputs.delete(focus);
  const outputs = new Set(
    routes.map((route) => route.target.name).filter((name) => name !== focus && !inputs.has(name)),
  );
  const rows = Math.max(inputs.size, outputs.size, 1);
  const positions = [
    { ...center, x: 408, y: 85 + ((rows - 1) * 140) / 2 },
    ...positionTypes(flow.nodes, inputs, 48),
    ...positionTypes(flow.nodes, outputs, 768),
  ];
  const byName = new Map(positions.map((node) => [node.name, node]));
  return {
    ...flow,
    nodes: positions,
    routes: routes.map((route) => ({
      ...route,
      source: byName.get(route.source.name)!,
      target: byName.get(route.target.name)!,
    })),
    height: 70 + rows * 140,
  };
}

function positionTypes(nodes: FlowType[], names: Set<string>, x: number) {
  return nodes
    .filter((node) => names.has(node.name))
    .map((node, index) => ({ ...node, x, y: 85 + index * 140 }));
}
