import { readableLabels } from "./connection-labels.ts";
import { linksFor } from "./model.ts";
import type {
  Display,
  EdgeData,
  FlowEdge,
  FlowNode,
  Geometry,
  MapIndex,
  Projection,
  Route,
  Selection,
  Tray,
} from "./types.ts";
type EdgeOptions = {
  selected: Selection | null;
  tray: Tray | null;
  display: Display;
  activeRoute: Route;
  emphasizing: boolean;
  pathDetail: boolean;
  inspect(id: string): void;
};
type Context = ReturnType<typeof presentationContext>;

function selectedBranch(nodes: FlowNode[], selection: Partial<Selection>) {
  const branch = new Set([selection.id]);
  if (selection.kind === "group")
    for (const node of nodes) if (branch.has(node.parentId)) branch.add(node.id);
  return branch;
}
function selectionLinks(index: MapIndex, selection: Partial<Selection>) {
  return new Set(
    selection.kind === "item" ? linksFor(index, selection.id).map((link) => link.id) : [],
  );
}
function presentationContext(
  index: MapIndex,
  projection: Projection,
  geometry: Geometry,
  options: EdgeOptions,
) {
  const selection: Partial<Selection> = options.selected ?? {};
  return {
    ...options,
    selection,
    visible: projection.nodes.some((node) => node.id === selection.id),
    groups: new Set(
      projection.nodes.filter((node) => node.kind === "group").map((node) => node.id),
    ),
    geometry: new Map(geometry.nodes.map((node) => [node.id, node])),
    branch: selectedBranch(geometry.nodes, selection),
    incidentLinks: selectionLinks(index, selection),
    trayLinks: new Set(options.tray?.linkIds),
    path: activeEdges(options.activeRoute.edgeIds, options.emphasizing),
    next: activeEdges(options.activeRoute.nextEdgeIds, options.emphasizing),
    folderDetail: projection.folderDetail,
  };
}
function inSelectedBranch(edge: FlowEdge, context: Context, incident: boolean) {
  return (
    incident ||
    context.branch.has(edge.source) ||
    context.branch.has(edge.target) ||
    context.selection.id === edge.id
  );
}
function contextLabel(edge: FlowEdge, data: EdgeData, context: Context) {
  const group = context.groups.has(edge.source) && context.groups.has(edge.target);
  return [
    context.folderDetail,
    data.incident,
    group,
    context.selection.id === edge.id,
    data.onPath,
  ].some(Boolean);
}
function labelAllowed(edge: FlowEdge, data: EdgeData, context: Context) {
  if (context.display.labels === "all") return true;
  if (context.display.labels !== "context") return false;
  return contextLabel(edge, data, context);
}
function nextLabel(data: EdgeData, context: Context) {
  return !!data.next && context.display.traceEmphasis !== "path";
}
function emphasisLabel(edge: FlowEdge, data: EdgeData, context: Context) {
  return (
    !context.emphasizing ||
    data.onPath ||
    nextLabel(data, context) ||
    context.selection.id === edge.id
  );
}
function dimUnrelated(context: Context, incident: boolean) {
  return context.visible && !incident && context.selection.kind === "item";
}
function linkAllowed(data: EdgeData, mode: Display["links"]) {
  if (mode === "selection") return !!(data.inSelectedBranch || data.onPath);
  return mode !== "none";
}
function activeEdges(ids: string[], emphasizing: boolean) {
  return new Set(emphasizing ? ids : []);
}
function emphasisState(edge: FlowEdge, context: Context) {
  const onPath = context.path.has(edge.id),
    next = context.next.has(edge.id);
  return { onPath, next, background: context.emphasizing && !(onPath || next) };
}
function sourceSize({ height = 82, width = 220 }: Partial<FlowNode> = {}) {
  return { selfHeight: height, selfWidth: width };
}
function incidentEdge(edge: FlowEdge, context: Context, selectedLinks: number) {
  return (
    context.visible &&
    ([edge.source, edge.target].includes(context.selection.id ?? "") || selectedLinks > 0)
  );
}
function dimEdge(data: EdgeData, context: Context) {
  return context.emphasizing
    ? data.background
    : !context.pathDetail && dimUnrelated(context, !!data.incident);
}
function pathAppearance(onPath: boolean) {
  return { zIndex: onPath ? 2 : 1, color: onPath ? "#81dfd2" : "#7c959c" };
}
function decorateEdge(edge: FlowEdge, context: Context) {
  const selectedLinks = edge.linkIds.filter((id) => context.incidentLinks.has(id)).length;
  const incident = incidentEdge(edge, context, selectedLinks);
  const data: EdgeData = {
    ...edge.data,
    ...emphasisState(edge, context),
    ...sourceSize(context.geometry.get(edge.source)),
    vertical: context.display.direction === "DOWN",
    selectedLinks,
    incident,
    inSelectedBranch: inSelectedBranch(edge, context, incident),
    selected:
      context.selection.id === edge.id || edge.linkIds.some((id) => context.trayLinks.has(id)),
    inspect: context.inspect,
  };
  data.dim = dimEdge(data, context);
  data.showLabel = emphasisLabel(edge, data, context) && labelAllowed(edge, data, context);
  const { zIndex, color } = pathAppearance(!!data.onPath);
  return {
    ...edge,
    zIndex,
    markerEnd: {
      type: "arrowclosed" as const,
      ...(typeof edge.markerEnd === "object" ? edge.markerEnd : {}),
      color,
    },
    data,
  };
}

// Index the scope once; edge decoration never rescans all nodes or native links.
export function presentEdges(
  index: MapIndex,
  projection: Projection,
  geometry: Geometry,
  options: EdgeOptions,
) {
  const context = presentationContext(index, projection, geometry, options);
  const isolated = context.emphasizing && context.display.traceEmphasis === "path";
  const edges = geometry.edges
    .map((edge) => decorateEdge(edge, context))
    .filter((edge) => linkAllowed(edge.data, context.display.links))
    .filter((edge) => !isolated || !!edge.data.onPath);
  const labels = readableLabels(geometry.nodes, edges, options.display.direction === "DOWN");
  for (const edge of edges) edge.data.readableLabel = labels.get(edge.id);
  return edges;
}
