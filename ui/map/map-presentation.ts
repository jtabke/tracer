import { presentEdges } from "./edge-presentation.ts";
import { traceEmphasis } from "./trace-emphasis.ts";
import type {
  Directory,
  DirectoryGroup,
  FlowNode,
  Geometry,
  MapIndex,
  Projection,
  WorkingView,
} from "./types.ts";

type Actions = {
  toggle(key: string): void;
  next(key: string): void;
  enter(group: DirectoryGroup | undefined): void;
  inspect(id: string): void;
};
function tracePresentation(projection: Projection, view: WorkingView, branchKey: string) {
  const selected = view.selected;
  const visibleIds = new Set(projection.nodes.map((node) => node.id));
  const selectedVisible = !!selected && visibleIds.has(selected.id);
  const pathDetail = !!view.focus || !!projection.folderDetail;
  const activeRoute = traceEmphasis(
    projection,
    view.focus ? [view.focus] : (projection.rootIds ?? []),
    selected?.kind === "item" ? selected.id : null,
    view.direction,
    view.routeSelection.key === branchKey ? view.routeSelection.route : null,
  );
  const emphasisMode = view.display.traceEmphasis;
  const emphasizing =
    pathDetail && activeRoute.found && emphasisMode !== "all" && view.display.links !== "none";
  return { visibleIds, selectedVisible, pathDetail, activeRoute, emphasisMode, emphasizing };
}
function presentNode(
  node: FlowNode,
  projection: Projection,
  view: WorkingView,
  working: boolean,
  directory: Directory,
  actions: Actions,
  path: Set<string>,
  emphasizing: boolean,
): FlowNode {
  const enter = !view.focus && view.detail === "folders" && node.data.groupKey !== view.folderScope;
  const selected = view.selected?.id === node.id;
  return {
    ...node,
    zIndex: node.data.kind === "group" ? 2 : 3,
    draggable: !working,
    selected,
    data: {
      ...node.data,
      vertical: view.display.direction === "DOWN",
      toggle: actions.toggle,
      next: actions.next,
      enter: enter ? (key) => actions.enter(directory.groups.get(key)) : null,
      selected,
      onActivePath: emphasizing && path.has(node.id),
      root: view.focus === node.id || projection.rootIds?.includes(node.id),
    },
  };
}
export function presentMap(
  index: MapIndex,
  directory: Directory,
  projection: Projection,
  geometry: Geometry,
  view: WorkingView,
  branchKey: string,
  working: boolean,
  actions: Actions,
) {
  const trace = tracePresentation(projection, view, branchKey);
  const path = new Set(trace.activeRoute.nodeIds);
  const nodes = geometry.nodes.map((node) =>
    presentNode(node, projection, view, working, directory, actions, path, trace.emphasizing),
  );
  const edges = presentEdges(index, projection, geometry, {
    selected: view.selected,
    tray: view.tray,
    display: view.display,
    ...trace,
    inspect: actions.inspect,
  });
  return { ...trace, nodes, edges };
}
