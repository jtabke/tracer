import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { edgeTypes, nodeTypes } from "./graph-elements.tsx";
import "./style.css";
import { TraceWalker } from "./trace-walk.tsx";
import type { MapProps } from "./types.ts";
import "./workbench.css";
import { ConnectionTray, OrganizeDialog } from "./workbench.tsx";
import { MapCanvas } from "./workspace-canvas.tsx";
import {
  MapStatus,
  OrganizationNotice,
  SaveSessionView,
  ScopeBoundary,
} from "./workspace-feedback.tsx";
import { MobileSelectionBar, SelectionInspector } from "./workspace-inspector.tsx";
import { MapHeader, MapSidebar, WorkspaceHeading } from "./workspace-navigation.tsx";
import {
  BoundaryControls,
  FolderTraceControls,
  MapToolbar,
  ScopeSummary,
  TraceRevealControls,
} from "./workspace-scope.tsx";

import { useMapController } from "./use-map-controller.ts";

function MapWorkspace(props: MapProps) {
  const controller = useMapController(props);
  const {
    applyOrganization,
    areas,
    browseRail,
    changeView,
    display,
    index,
    inspector,
    message,
    notice,
    organization,
    organizeIds,
    projection,
    selection,
    setOrganizeIds,
    setWalk,
    showEndpoints,
    tray,
    trayLinks,
    walk,
    working,
  } = controller;
  return (
    <>
      <div
        className={`application ${browseRail ? "" : "rail-collapsed"}`}
        inert={walk ? true : undefined}
        aria-hidden={walk ? true : undefined}
      >
        <MapSidebar controller={controller} />
        <main className="main">
          {notice}
          <MapHeader controller={controller} />
          <WorkspaceHeading controller={controller} />
          <MapToolbar controller={controller} />
          <ScopeSummary controller={controller} />
          <SaveSessionView controller={controller} />
          <FolderTraceControls controller={controller} />
          <BoundaryControls controller={controller} />
          <OrganizationNotice controller={controller} />
          <TraceRevealControls controller={controller} />
          <div className={`canvas-and-inspector ${inspector ? "has-inspector" : ""}`}>
            <MapCanvas controller={controller} />
            <MobileSelectionBar controller={controller} />
            {inspector && <SelectionInspector controller={controller} />}
          </div>
          {tray && (
            <ConnectionTray
              key={tray.id}
              links={trayLinks}
              index={index}
              title={tray.title}
              onClose={() => {
                changeView({ tray: null });
                if (selection.kind === "edge") changeView({ selected: null });
              }}
              onInspect={(id) => changeView({ selected: { kind: "item", id } })}
              onReveal={showEndpoints}
            />
          )}
          <MapStatus controller={controller} />
          <ScopeBoundary controller={controller} />
          <div className="sr-only" aria-live="polite">
            {message}
            {working ? " Arranging graph." : ` ${projection.nodes.length} graph nodes shown.`}
          </div>
          {organizeIds && (
            <OrganizeDialog
              count={organizeIds.length}
              areas={areas}
              onApply={applyOrganization}
              onClose={() => setOrganizeIds(null)}
            />
          )}
        </main>
      </div>
      {walk && (
        <TraceWalker
          session={walk}
          model={{ index, organization }}
          renderer={{ nodeTypes, edgeTypes }}
          onClose={() => setWalk(null)}
          railVisible={browseRail}
          initialDirection={display.direction}
        />
      )}
    </>
  );
}

export function DevelopmentMap(props: MapProps) {
  return (
    <ReactFlowProvider>
      <MapWorkspace {...props} />
    </ReactFlowProvider>
  );
}
