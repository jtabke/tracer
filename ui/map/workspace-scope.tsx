import { Choice, groupDetails, mapScopes, traceDirections, traceLevels } from "./controls.tsx";
import { entityAt, PAGE_SIZE } from "./model.ts";
import { displayFolderChildren } from "./organization.ts";
import type { MapController } from "./use-map-controller.ts";
export function MapToolbar({ controller }: { controller: MapController }) {
  const {
    changeView,
    choosePreset,
    depth,
    direction,
    display,
    flow,
    focus,
    folderScope,
    panel,
    preset,
    projection,
    rememberCamera,
    representation,
    selectedGroup,
    togglePanel,
    tray,
  } = controller;
  return (
    <div className={`toolbar ${focus || folderScope ? "trace-detail-toolbar" : ""}`}>
      <div className="representation-switch" role="group" aria-label="Working representation">
        <button
          aria-pressed={representation === "graph"}
          onClick={() => changeView({ representation: "graph" })}
        >
          Graph
        </button>
        <button
          aria-pressed={representation === "table"}
          onClick={() => changeView({ representation: "table" })}
        >
          Items table
        </button>
      </div>
      {!focus && (
        <button
          aria-expanded={panel === "browse"}
          onClick={(event) => togglePanel("browse", event)}
        >
          Browse folders
        </button>
      )}
      {focus || folderScope ? (
        <>
          <Choice
            label="Trace"
            name="Trace direction"
            value={direction}
            onChange={(value) => {
              rememberCamera(focus ?? projection.rootIds?.[0]);
              if (!focus && folderScope) changeView({ revealed: [] });
              changeView({ direction: value, traceBranches: { key: null, steps: [] } });
            }}
            options={traceDirections}
          />
          <Choice
            label="Levels"
            name="Levels shown"
            value={String(depth)}
            onChange={(value) => {
              rememberCamera(focus ?? projection.rootIds?.[0]);
              if (!focus && folderScope) changeView({ revealed: [] });
              changeView({ depth: Number(value), traceBranches: { key: null, steps: [] } });
            }}
            options={traceLevels}
          />
        </>
      ) : (
        <Choice
          label="Scope"
          name="Map scope"
          value={preset}
          onChange={(value) => choosePreset(value)}
          options={Object.entries(mapScopes).filter(
            ([key]) => key !== "custom" || preset === "custom",
          )}
        />
      )}
      <div className="orientation-switch" role="group" aria-label="Layout direction">
        {(
          [
            ["RIGHT", "Horizontal"],
            ["DOWN", "Vertical"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={display.direction === value}
            onClick={() => {
              rememberCamera(selectedGroup ? `group:${selectedGroup}` : undefined);
              changeView({ display: (current) => ({ ...current, direction: value }) });
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="toolbar-right">
        <button
          aria-pressed={!!tray}
          onClick={() =>
            changeView({
              tray: (current) =>
                current ? null : { id: "scope", title: "Connections in this scope" },
            })
          }
        >
          Connections
        </button>
        <button
          aria-expanded={panel === "filters"}
          onClick={(event) => togglePanel("filters", event)}
        >
          Filters
        </button>
        <button
          aria-expanded={panel === "display"}
          onClick={(event) => togglePanel("display", event)}
        >
          Display
        </button>
        <button
          onClick={() => flow.fitView({ padding: 0.14, minZoom: 0.2, maxZoom: 1, duration: 200 })}
        >
          Frame all
        </button>
      </div>
    </div>
  );
}
export function ScopeSummary({ controller }: { controller: MapController }) {
  const {
    applicableRelations,
    area,
    areas,
    changeArea,
    changeView,
    detail,
    focus,
    folderScope,
    openFilters,
    preset,
    rememberCamera,
    restoreWork,
    savedViews,
    scopeNames,
    setNavigation,
    setSavingView,
    shownRelations,
    typeCount,
    types,
  } = controller;
  return (
    <div className="scope-summary" aria-label="Visible graph scope">
      <Choice
        label="Category"
        className="mobile-category"
        name="Working category"
        value={area}
        onChange={(value) => changeArea(value)}
        options={areas.map(({ name, count }) => [name, `${name} · ${count}`])}
      />
      {focus || folderScope ? (
        <span>
          {folderScope && !focus
            ? "Folder items + individual traces"
            : "Items follow the focused trace"}
        </span>
      ) : (
        <button
          aria-label={`Items · ${scopeNames[preset]} · ${types.length}/${typeCount} types`}
          onClick={(event) => openFilters("items", event)}
        >
          <span className="scope-desktop">
            Items · {scopeNames[preset]} · {types.length}/{typeCount} types
          </span>
          <span className="scope-mobile" aria-hidden="true">
            Items · {types.length}/{typeCount} types
          </span>
        </button>
      )}
      <button
        aria-label={`Connections · ${shownRelations === applicableRelations.length ? `All ${applicableRelations.length}` : `${shownRelations}/${applicableRelations.length}`} ${focus || folderScope ? "kinds" : "relevant kinds"}`}
        onClick={(event) => openFilters("connections", event)}
      >
        <span className="scope-desktop">
          Connections ·{" "}
          {shownRelations === applicableRelations.length
            ? `All ${applicableRelations.length}`
            : `${shownRelations}/${applicableRelations.length}`}{" "}
          {focus || folderScope ? "kinds" : "relevant kinds"}
        </span>
        <span className="scope-mobile" aria-hidden="true">
          Connections · {shownRelations}/{applicableRelations.length}
        </span>
      </button>
      {!focus && !folderScope && (
        <Choice
          label="Expand into"
          className="detail-control"
          name="Group detail"
          value={detail}
          onChange={(value) => {
            rememberCamera();
            changeView({ detail: value, selected: null, tray: null });
          }}
          options={groupDetails}
        />
      )}
      <button disabled={!!focus} onClick={() => setSavingView((value) => !value)}>
        Save view
      </button>
      {!!savedViews.length && (
        <Choice
          label="Session view"
          className="mobile-category"
          name="Open session view"
          value=""
          onChange={(value) => {
            if (value !== "") {
              restoreWork(savedViews[Number(value)].snapshot);
              setNavigation([]);
            }
          }}
          options={[
            ["", "Choose a view…"],
            ...savedViews.map((view, i) => [String(i), view.name] as const),
          ]}
        />
      )}
    </div>
  );
}
export function FolderTraceControls({ controller }: { controller: MapController }) {
  const { activeFolder, enterGroup, folderPage, index, openTrace, projection } = controller;
  const { projection: visibility_projection, focus: visibility_focus } = controller;
  if (!(visibility_projection.folderDetail && !visibility_focus)) return null;
  return (
    <section className="folder-trace-controls" aria-label="Folder trace scope">
      <span>
        {projection.rootIds?.length ?? 0} of {projection.folderTotal} folder items ·{" "}
        {projection.linkedCount} linked items · source page {(projection.sourcePage ?? 0) + 1}/
        {projection.sourcePageCount}
      </span>
      {projection.sourcePageCount > 1 && (
        <>
          <button
            aria-label="Previous folder items"
            disabled={!projection.sourcePage}
            onClick={() => folderPage(projection.sourcePage - 1)}
          >
            ←
          </button>
          <button
            aria-label="Next folder items"
            disabled={projection.sourcePage + 1 >= projection.sourcePageCount}
            onClick={() => folderPage(projection.sourcePage + 1)}
          >
            Next {PAGE_SIZE} →
          </button>
        </>
      )}
      <Choice
        label="Trace an item"
        name="Trace a folder item"
        value=""
        onChange={(value) => {
          if (value) openTrace(value, true);
        }}
        options={[
          ["", "Choose a source item…"],
          ...projection.rootIds.map(
            (id) =>
              [id, `${entityAt(index, id).key} · ${entityAt(index, id).fields.title}`] as const,
          ),
        ]}
      />
      {!!activeFolder?.children.length && activeFolder.members.length > PAGE_SIZE && (
        <span className="folder-shortcuts">
          Subfolders:{" "}
          {displayFolderChildren(activeFolder).map((child) => (
            <button key={child.key} onClick={() => enterGroup(child)}>
              {child.title} · {child.members.length}
            </button>
          ))}
        </span>
      )}
    </section>
  );
}
export function BoundaryControls({ controller }: { controller: MapController }) {
  const { camera, changeView, geometry, projection, rememberCamera, revealed, showBoundary } =
    controller;
  const {
    focus: visibility_focus,
    folderScope: visibility_folderScope,
    revealed: visibility_revealed,
    projection: visibility_projection,
  } = controller;
  if (!(
    !visibility_focus &&
    (!visibility_folderScope || visibility_revealed.length > 0) &&
    (visibility_projection.boundaryLinks > 0 || visibility_revealed.length > 0)
  ))
    return null;
  return (
    <div className="boundary-controls">
      <span>
        {(projection.boundaryLinks ?? 0).toLocaleString()} links cross this scope ·{" "}
        {(projection.boundaryRecords ?? 0).toLocaleString()} connected items outside
      </span>
      <button
        aria-pressed={showBoundary}
        onClick={() => {
          rememberCamera();
          camera.current.local = true;
          camera.current.previous = geometry;
          changeView({ showBoundary: (value) => !value });
        }}
      >
        {showBoundary ? "Hide outside groups" : "Show outside groups"}
      </button>
      {revealed.length > 0 && <span>{revealed.length} revealed items · first item framed</span>}
      {revealed.length > 0 && (
        <button
          onClick={() => {
            rememberCamera();
            changeView({ revealed: [] });
          }}
        >
          Clear revealed items
        </button>
      )}
    </div>
  );
}
export function TraceRevealControls({ controller }: { controller: MapController }) {
  const {
    branchKey,
    branchSteps,
    focus,
    index,
    locateTraceItem,
    projection,
    relations,
    selection,
    traceNotice,
    undoTraceReveal,
  } = controller;
  const { focus: visibility_focus, projection: visibility_projection } = controller;
  if (!(visibility_focus || visibility_projection.folderDetail)) return null;
  return (
    <div className="trace-reveal-controls">
      <div className="trace-reveal-actions">
        <span
          role="status"
          title={
            traceNotice?.key === branchKey && traceNotice.relations === relations.join("|")
              ? traceNotice.text
              : "Click linked items to reveal next connections"
          }
        >
          {traceNotice?.key === branchKey && traceNotice.relations === relations.join("|")
            ? traceNotice.text
            : `Click linked items to reveal next connections · ${branchSteps.length} expanded`}
        </span>
        <button disabled={!branchSteps.length} onClick={undoTraceReveal}>
          Undo reveal
        </button>
        <button
          disabled={
            !branchSteps.length ||
            !projection.nodes.some((node) => !branchSteps.at(-1)!.keepIds.includes(node.id))
          }
          onClick={() => {
            const added = projection.nodes.find(
              (node) => !branchSteps.at(-1)!.keepIds.includes(node.id),
            );
            if (added) locateTraceItem(added.id);
          }}
        >
          Locate new items
        </button>
      </div>
      <nav className="trace-reveal-trail" aria-label="Trace exploration">
        <span>Start:</span>
        {(focus ? [focus] : (projection.rootIds ?? [])).map((id) => (
          <button key={id} onClick={() => locateTraceItem(id)}>
            {index.entities.get(id)?.key}
          </button>
        ))}
        <span>Expanded:</span>
        {branchSteps.length ? (
          branchSteps.map((step) => (
            <button
              key={step.id}
              onClick={() => locateTraceItem(step.id)}
              aria-current={selection.id === step.id ? "true" : undefined}
            >
              {index.entities.get(step.id)?.key}
            </button>
          ))
        ) : (
          <span>Choose a linked item</span>
        )}
      </nav>
    </div>
  );
}
