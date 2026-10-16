import { EDGE_LIMIT, TRACE_LIMIT } from "./model.ts";
import type { MapController } from "./use-map-controller.ts";
export function MapStatus({ controller }: { controller: MapController }) {
  const { display, edges, focus, geometry, projection, typeCount, types, zoom } = controller;
  return (
    <footer className="statusbar">
      <span>
        {display.links &&
          display.links !== "all" &&
          `${edges.length}/${geometry.edges.length} lines shown · `}
        {focus || projection.folderDetail
          ? `${projection.individualCount} of ${projection.totalRecords} reached records shown`
          : `${types.length}/${typeCount} types · ${projection.totalRecords.toLocaleString()} records in scope · ${projection.individualCount} shown individually`}
      </span>
      <span>
        {focus || projection.folderDetail
          ? `${projection.edges.reduce((sum, edge) => sum + edge.linkIds.length, 0)} of ${projection.scopedLinks.toLocaleString()} links drawn`
          : `${projection.scopedLinks.toLocaleString()} links in scope`}{" "}
        · {Math.round(zoom * 100)}%{zoom < 0.55 ? " · zoom in to read" : ""}
      </span>
    </footer>
  );
}
export function ScopeBoundary({ controller }: { controller: MapController }) {
  const { area, focus, index, outsideCategoryCount, projection } = controller;
  const {
    focus: visibility_focus,
    folderScope: visibility_folderScope,
    projection: visibility_projection,
    relations: visibility_relations,
    relationTypes: visibility_relationTypes,
    types: visibility_types,
    typeCount: visibility_typeCount,
  } = controller;
  if (!(
    visibility_focus ||
    visibility_folderScope ||
    visibility_projection.omittedRecords > 0 ||
    visibility_projection.omittedEdges > 0 ||
    visibility_projection.limitedGroups > 0 ||
    visibility_relations.length < visibility_relationTypes.length ||
    (!visibility_focus && visibility_types.length < visibility_typeCount)
  ))
    return null;
  return (
    <div className="scope-boundary">
      {focus || projection.folderDetail
        ? `Trace follows configured model flow. Up to ${TRACE_LIMIT} records and ${EDGE_LIMIT} lines.${area !== "All areas" ? ` ${outsideCategoryCount} reached items outside ${area}; tracing can cross categories.` : ""}`
        : `Placement follows development order; arrows show traces. ${index.entities.size - projection.totalRecords} records and ${projection.outsideLinks.toLocaleString()} links outside the current filters.`}
      {projection.omittedRecords > 0
        ? ` ${projection.omittedRecords} reached records not drawn; narrow depth or direction.`
        : ""}
      {projection.omittedEdges > 0
        ? ` ${projection.omittedEdges} bundled lines not drawn; narrow the scope.`
        : ""}
      {projection.limitedGroups > 0
        ? ` ${projection.limitedGroups} groups kept summarized at the 160-node drawing limit. Open a folder to work at finer detail.`
        : ""}
    </div>
  );
}
export function SaveSessionView({ controller }: { controller: MapController }) {
  const { saveWorkingView, setSavingView, setViewName, viewName } = controller;
  const { savingView: visibility_savingView } = controller;
  if (!visibility_savingView) return null;
  return (
    <form className="save-view-form" onSubmit={saveWorkingView}>
      <label>
        Name this session view{" "}
        <input
          aria-label="Session view name"
          value={viewName}
          onChange={(event) => setViewName(event.target.value)}
          autoFocus
          placeholder="Power review"
        />
      </label>
      <button disabled={!viewName.trim()}>Save</button>
      <button type="button" onClick={() => setSavingView(false)}>
        Cancel
      </button>
    </form>
  );
}
export function OrganizationNotice({ controller }: { controller: MapController }) {
  const { organizationUndo, undoOrganization } = controller;
  if (!organizationUndo) return null;
  return (
    <div className="organization-notice" role="status">
      <span>Session organization updated.</span>
      <button onClick={undoOrganization}>Undo organization</button>
    </div>
  );
}
