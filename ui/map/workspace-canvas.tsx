import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import { DisplayPanel } from "./display-panel.tsx";
import { GraphFilters } from "./filters.tsx";
import { edgeTypes, nodeTypes } from "./graph-elements.tsx";
import { activateNode, selectNode, type NodeIntent } from "./node-intent.ts";
import type { FlowEdge, FlowNode } from "./types.ts";
import type { MapController } from "./use-map-controller.ts";
import { FolderBrowser, RecordTable } from "./workbench.tsx";
function GraphLegend({ controller }: { controller: MapController }) {
  const {
    activeRoute,
    changeView,
    display,
    emphasisMode,
    emphasizing,
    pathDetail,
    selectedVisible,
  } = controller;
  return (
    <div className="graph-key">
      {pathDetail && selectedVisible && !activeRoute.found && emphasisMode !== "all" && (
        <span>No complete route in this drawn view · showing context</span>
      )}
      {emphasizing && (
        <span
          className="path-key"
          title="One recorded route in the drawn neighborhood; other routes may exist."
        >
          {activeRoute.edgeIds.length
            ? `Highlighted route · ${activeRoute.edgeIds.length} steps`
            : "Next connections from selection"}
        </span>
      )}
      {emphasizing && activeRoute.edgeIds.length > 0 && (
        <button
          disabled={!activeRoute.edgeIds.length}
          onClick={() =>
            changeView({
              display: (current) => ({
                ...current,
                traceEmphasis: emphasisMode === "path" ? "context" : "path",
              }),
            })
          }
        >
          {emphasisMode === "path" ? "Show context" : "Isolate path"}
        </button>
      )}

      {display.links !== "all" || (emphasizing && emphasisMode === "path") ? (
        <>
          <span>{connectionCaption(controller)}</span>
          <button
            onClick={() =>
              changeView({
                display: (current) => ({
                  ...current,
                  links: "all",
                  traceEmphasis: "all",
                }),
              })
            }
          >
            Show all connections
          </button>
        </>
      ) : (
        <>
          <span className="solid-key" />
          Recorded links <span className="dashed-key" />
          Allowed route · no links
        </>
      )}
    </div>
  );
}
export function MapCanvas({ controller }: { controller: MapController }) {
  const {
    area,
    browsingDirectory,
    changeRelations,
    changeTypes,
    changeView,
    checkedRecords,
    closeFilters,
    contextTypes,
    dataset,
    display,
    edges,
    enterGroup,
    filterTab,
    focus,
    folderScope,
    geometry,
    index,
    inspectBundle,
    layoutError,
    moveNodes,
    nodes,
    openTrace,
    organization,
    panel,
    panelTrigger,
    pathDetail,
    projection,
    relations,
    rememberCamera,
    representation,
    resetFilters,
    revealNext,
    scopedRecords,
    selection,
    setCheckedRecords,
    setFilterTab,
    setMobileDetailsOpen,
    setOrganizeIds,
    setPanel,
    setZoom,
    showEndpoints,
    toggle,
    types,
    working,
  } = controller;
  function applyIntent(intent: NodeIntent) {
    switch (intent.kind) {
      case "select":
        changeView({ selected: intent.selection });
        break;
      case "reveal":
        revealNext(intent.id);
        break;
      case "trace":
        openTrace(intent.id, intent.fromClick);
        break;
      case "toggle":
        toggle(intent.id);
        break;
    }
  }
  return (
    <section
      className={`canvas ${representation === "table" ? "table-representation" : ""}`}
      aria-label="Interactive development graph"
      aria-busy={working}
      data-node-count={projection.nodes.length}
      data-layout-edge-count={geometry.edges.length}
      data-direction={display.direction}
      data-edge-count={edges.length}
    >
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        zIndexMode="manual"
        minZoom={0.2}
        maxZoom={1.8}
        deleteKeyCode={null}
        edgesReconnectable={false}
        nodesDraggable={!working}
        onNodesChange={moveNodes}
        nodesConnectable={false}
        zoomOnDoubleClick={false}
        panOnScroll={true}
        selectionOnDrag={false}
        colorMode="dark"
        onNodeClick={(_, node) => {
          setMobileDetailsOpen(false);
          applyIntent(selectNode(node, { focus, folderScope }, projection));
        }}
        onNodeDoubleClick={(_, node) => applyIntent(activateNode(node, { focus, folderScope }))}
        onEdgeClick={(_, edge) => inspectBundle(edge.id)}
        onPaneClick={() => {
          changeView({ selected: null });
          setPanel(null);
        }}
        onMove={(_, viewport) => setZoom(viewport.zoom)}
        onlyRenderVisibleElements={false}
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#353e43" gap={24} size={1} />
        <Controls
          showInteractive={false}
          position="bottom-left"
          fitViewOptions={{ padding: 0.14, minZoom: 0.2, maxZoom: 1 }}
        />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={(node) => (node.id === selection.id ? "#81dfd2" : "#51656d")}
          maskColor="rgba(12,16,19,.7)"
        />
      </ReactFlow>
      {
        <RecordTable
          records={scopedRecords}
          organization={organization}
          selectedIds={checkedRecords}
          onSelection={(value) => setCheckedRecords(value)}
          onInspect={(id) => changeView({ selected: { kind: "item", id } })}
          onOrganize={(value) => setOrganizeIds(value)}
          onReveal={showEndpoints}
          scopeKey={`${dataset}:${area}:${folderScope}:${types.join(",")}:${focus ?? ""}`}
        />
      }
      {working && (
        <div className="canvas-notice" role="status">
          Arranging…
        </div>
      )}
      {layoutError && (
        <div className="canvas-error" role="alert">
          {layoutError}
        </div>
      )}
      {!working && !projection.nodes.length && (
        <div className="canvas-notice">
          No types selected. Restore a scope or choose item types in Filters.
        </div>
      )}
      {panel === "filters" && (
        <GraphFilters
          index={index}
          types={types}
          relations={relations}
          focused={!!focus || !!folderScope}
          tab={filterTab}
          setTab={(value) => setFilterTab(value)}
          onTypes={changeTypes}
          onRelations={changeRelations}
          onClose={closeFilters}
          onReset={resetFilters}
          contextTypes={contextTypes}
        />
      )}
      {panel === "browse" && (
        <FolderBrowser
          directory={browsingDirectory}
          onInspect={(id) => openTrace(id, true)}
          types={types}
          onEnter={enterGroup}
          onClose={() => {
            setPanel(null);
            panelTrigger.current?.focus();
          }}
        />
      )}
      {panel === "display" && (
        <DisplayPanel
          display={display}
          pathDetail={pathDetail}
          onClose={closeFilters}
          onChange={(field, value) => {
            if (field === "spacing") rememberCamera();
            changeView({
              display: (current) => ({
                ...current,
                [field]: value,
                ...(field === "traceEmphasis" ? { links: "all" } : {}),
              }),
            });
          }}
        />
      )}
      <GraphLegend controller={controller} />
    </section>
  );
}
function connectionCaption({
  display,
  emphasizing,
  emphasisMode,
  selected,
}: Pick<MapController, "display" | "emphasizing" | "emphasisMode" | "selected">) {
  if (display.links === "none") return "Connections hidden";
  if (emphasizing && emphasisMode === "path") return "Other connections hidden";
  return selected ? "Connections for selection" : "Select an item or group to see its connections";
}
