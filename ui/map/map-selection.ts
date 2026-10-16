import { linksFor, sortedRecords } from "./model.ts";
import { matchesArea } from "./organization.ts";
import type {
  Directory,
  MapIndex,
  Organization,
  Projection,
  Selection,
  WorkingView,
} from "./types.ts";

function selectedObjects(
  index: MapIndex,
  directory: Directory,
  projection: Projection,
  selected: Selection | null,
) {
  const selection: Partial<Selection> = selected ?? {};
  const selectedEntity = selection.kind === "item" ? index.entities.get(selection.id!) : null;
  const selectedGroup = selection.kind === "group" ? selection.type : null;
  const selectedGroupNode =
    selection.kind === "group" ? projection.nodes.find((node) => node.id === selection.id) : null;
  const selectedDirectoryGroup =
    selection.kind === "group"
      ? directory.groups.get(selection.groupKey ?? selectedGroup ?? "")
      : null;
  const selectedEdge =
    selection.kind === "edge" ? projection.edges.find((edge) => edge.id === selection.id) : null;
  return {
    selectedEntity,
    selectedGroup,
    selectedGroupNode,
    selectedDirectoryGroup,
    selectedEdge,
    selectedItemLinks: linksFor(index, selectedEntity?.id),
    inspector: selectedEntity || selectedGroup,
  };
}
function trayConnections(index: MapIndex, projection: Projection, tray: WorkingView["tray"]) {
  if (!tray) return [];
  return (tray.linkIds ?? projection.scopedLinkIds)
    .map((id) => index.linkById.get(id))
    .filter((link) => link !== undefined);
}
function isHidden(
  view: WorkingView,
  projection: Projection,
  selectedEdge: unknown,
  visible: boolean,
) {
  return (
    !!view.selected &&
    !selectedEdge &&
    (view.representation === "table" ? !projection.scopeIds.includes(view.selected.id) : !visible)
  );
}
export function mapSelection(
  index: MapIndex,
  directory: Directory,
  projection: Projection,
  organization: Organization,
  view: WorkingView,
  selectedVisible: boolean,
) {
  const objects = selectedObjects(index, directory, projection, view.selected);
  return {
    ...objects,
    outsideCategoryCount:
      view.area === "All areas"
        ? 0
        : projection.scopeIds.filter((id) => !matchesArea(id, organization, view.area)).length,
    hiddenSelection: isHidden(view, projection, objects.selectedEdge, selectedVisible),
    scopedRecords: sortedRecords(index, projection.scopeIds),
    trayLinks: trayConnections(index, projection, view.tray),
    activeFolder: view.folderScope ? directory.groups.get(view.folderScope) : null,
  };
}
