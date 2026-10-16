import type { ReactNode, SetStateAction } from "react";
import { useState } from "react";
import type { Graph } from "../../../src/application/views.ts";
import type { Entity, SchemaObject } from "../../../src/core/model.ts";
import type { Editing, Focus } from "../../../ui/editing.ts";
import { useProjection } from "../../../ui/use-projection.ts";
import { GraphBrowser, useGraphPicker } from "./graph-browser.tsx";
import { GraphCanvas } from "./graph-canvas.tsx";
import { GraphDepthControl, GraphDepthSummary } from "./graph-depth.tsx";
import { GraphInspector } from "./graph-inspector.tsx";
import type { GraphEdge } from "./graph-model.ts";
import type { GraphTime, Selection } from "./graph-state.ts";
import { resolveSelection } from "./graph-state.ts";
import { GraphTimeline } from "./graph-timeline.tsx";
import "./graph.css";
import { NativeInspector } from "./native-inspector.tsx";
import { ResponsiveDetails } from "./responsive-details.tsx";
import { useGraphInspection } from "./use-graph-inspection.ts";
import { useGraphRead } from "./use-graph-read.ts";

export function GraphView({
  schema,
  editing,
  changed,
  sharedFocus,
  onFocus,
  onTemporal,
  visible = true,
}: {
  schema: SchemaObject;
  editing: Editing;
  changed: () => void;
  sharedFocus?: Focus;
  onFocus?: (entity: Focus) => void;
  onTemporal?: (value: boolean) => void;
  visible?: boolean;
}) {
  const { picker, filtered, controls } = useGraphPicker(schema, editing);
  const { root, expanded, inspectorOpen, setRoot, setExpanded, setInspectorOpen } =
    useGraphNavigation();
  const [time, setTime] = useState<GraphTime>();
  const [depth, setDepth] = useState(1);
  const historical = time !== undefined;
  const { graph, matching, loading, failed } = useGraphRead(
    root,
    expanded,
    time,
    editing.epoch,
    editing.report,
    visible,
    depth,
  );
  const {
    selection,
    receipt,
    setDirty,
    selectNode,
    selectEdge,
    focus,
    inspect,
    canLeave,
    selectReceipt,
    pendingSelection,
  } = useGraphInspection({
    items: picker.data?.items,
    graph,
    root,
    setRoot,
    setExpanded,
    setInspectorOpen,
    sharedFocus,
    historical,
    visible,
    onFocus,
  });
  const changeTime = (at?: number, before?: number) => {
    if (!canLeave()) return;
    inspect();
    setTime(at === undefined ? undefined : { atRevision: at, compareRevision: before });
    onTemporal?.(at !== undefined);
  };
  const timeline = useGraphTimeline(editing);
  const { atRevision, compareRevision } = time ?? {};
  const { node: selectedNode, edge: selectedEdge } = resolveSelection(
    graph,
    selection,
    historical,
    sharedFocus?.id,
  );
  const timelineItems = timeline.window.data?.items;
  const timelineNext = timeline.window.data?.nextBefore;
  const pickerNext = picker.data?.nextAfter;
  const mutationsDisabled = failed || loading || editing.busy;
  return (
    <section className="graph-workspace" aria-label="Graph workspace">
      <GraphHeading graph={graph} time={time} matching={matching} />
      <div className="graph-options">
        <section className="graph-option graph-start" aria-label="Find a starting item">
          <GraphBrowser
            types={Object.keys(schema.entityTypes)}
            {...controls}
            root={root}
            graph={graph}
            filtered={filtered}
            focus={focus}
            loading={picker.loading}
            nextAfter={pickerNext}
          >
            <GraphDepthControl
              depth={depth}
              onDepth={(value) => {
                setDepth(value);
                setExpanded([]);
              }}
            />
          </GraphBrowser>
        </section>
        <ResponsiveDetails
          className="graph-option graph-history"
          title={`History and comparison${historical ? " · read-only" : ""}`}
        >
          <GraphTimeline
            atRevision={atRevision}
            compareRevision={compareRevision}
            historical={historical}
            items={timelineItems}
            nextBefore={timelineNext}
            loading={timeline.window.loading}
            timelineBefore={timeline.before}
            setTimelineBefore={timeline.setBefore}
            changeTime={changeTime}
          />
        </ResponsiveDetails>
      </div>
      <GraphNotices
        root={root}
        pendingSelection={pendingSelection}
        loading={loading}
        failed={failed}
        historical={historical}
        matching={matching}
        graph={graph}
      />
      {graph && (
        <GraphSurface
          inspectorOpen={inspectorOpen}
          actions={
            <GraphActions
              graph={graph}
              selectedNode={selectedNode}
              loading={loading}
              expanded={expanded}
              setExpanded={setExpanded}
              focus={focus}
              inspectorOpen={inspectorOpen}
              setInspectorOpen={setInspectorOpen}
            />
          }
          canvas={
            <GraphCanvas
              graph={graph}
              {...canvasSelection(selectedNode, selectedEdge, receipt)}
              onNode={selectNode}
              onEdge={selectEdge}
              onFocus={focus}
              onExpand={(id) => setExpanded((values) => [...values, id])}
              canExpand={
                !!selectedNode &&
                !loading &&
                !graph.expanded.includes(selectedNode.id) &&
                expanded.length < 20
              }
              actionsDisabled={loading}
            />
          }
          inspector={
            <GraphInspection
              graph={graph}
              node={selectedNode}
              edge={selectedEdge}
              receipt={receipt}
              selection={selection}
              historical={historical}
              matching={matching}
              inspectorOpen={inspectorOpen}
              editing={editing}
              onDirty={setDirty}
              onNavigate={selectNode}
              onReceipt={selectReceipt}
              changed={changed}
              disabled={mutationsDisabled}
            />
          }
        />
      )}
    </section>
  );
}

export function GraphHeading({
  graph,
  time,
  matching,
}: {
  graph?: Graph;
  time?: GraphTime;
  matching: boolean;
}) {
  const { atRevision, compareRevision } = time ?? {};
  const historical = time !== undefined;
  const active = graph?.evaluations.filter((value) => !value.comparison.supersededBy.length) ?? [];
  const needsReview = active.filter(
    (value) => value.comparison.hasChanged && value.comparison.review.state !== "accepted",
  ).length;
  const unknown = active.filter((value) => value.comparison.hasUnknown).length;
  return (
    <div className="graph-heading">
      <div>
        <h2>Relationships</h2>
      </div>
      <div className="graph-summary" aria-live="polite">
        {historical ? (
          <>
            Read-only native{" "}
            {compareRevision
              ? `comparison ${compareRevision} → ${atRevision}`
              : `revision ${atRevision}`}
            <small>No evidence or freshness is reconstructed.</small>
            {matching && graph?.temporal && (
              <small>
                {graph.temporal.at.actor} · {graph.temporal.at.at} · {graph.temporal.at.reason}
              </small>
            )}
          </>
        ) : (
          <>
            <strong>{needsReview}</strong> trace evaluations may need review <span>·</span>{" "}
            <strong>{unknown}</strong> with unknown inputs
          </>
        )}
      </div>
    </div>
  );
}
export function GraphNotices({
  root,
  pendingSelection,
  loading,
  failed,
  historical,
  matching,
  graph,
}: {
  root: string;
  pendingSelection: boolean;
  loading: boolean;
  failed: boolean;
  historical: boolean;
  matching: boolean;
  graph?: Graph;
}) {
  return (
    <>
      {" "}
      {!root && (
        <div className="graph-empty">
          <h3>Your graph starts with an entity</h3>
          <p>
            Choose an entity using the browser above. For an empty project, create an entity in
            Table, or launch <code>npm run demo</code> for connected examples.
          </p>
        </div>
      )}
      {pendingSelection && (
        <p>Shared selection pending. Save or discard the inspector draft to reveal it.</p>
      )}
      {loading && <p role="status">Loading neighborhood…</p>}
      {failed && (
        <p role="alert" className="error">
          Could not load this neighborhood. The previous view and drafts are retained; editing is
          paused. Choose a smaller focus or reset expansions, then refresh.
        </p>
      )}
      {historical && matching && !graph?.nodes.length && (
        <p>The focus entity does not exist at this native revision.</p>
      )}
    </>
  );
}

export function GraphActions({
  graph,
  expanded,
  setExpanded,
  inspectorOpen,
  setInspectorOpen,
}: {
  graph: Graph;
  selectedNode?: Entity;
  loading: boolean;
  expanded: string[];
  setExpanded: React.Dispatch<React.SetStateAction<string[]>>;
  focus: (id: string) => void;
  inspectorOpen: boolean;
  setInspectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <div className="graph-actions">
      <button disabled={!expanded.length} onClick={() => setExpanded([])}>
        Reset expansions
      </button>
      <button onClick={() => setInspectorOpen((value) => !value)}>
        {inspectorOpen ? "Hide inspector" : "Show inspector"}
      </button>
      <GraphDepthSummary graph={graph} />
      <details className="graph-scope-help">
        <summary>Scope and limits</summary>
        <p>
          Depth follows recorded connections in both directions. Arrows retain their meaning.
          Limits: {graph.trace ? "200 nodes / 600 connections" : "60 nodes / 200 connections"} / 50
          evaluations. A connection is not a passing result.
        </p>
      </details>
    </div>
  );
}
export function GraphInspection({
  graph,
  node,
  edge,
  receipt,
  selection,
  historical,
  matching,
  inspectorOpen,
  editing,
  onDirty,
  onNavigate,
  onReceipt,
  changed,
  disabled,
}: {
  graph: Graph;
  node?: Entity;
  edge?: GraphEdge;
  receipt?: string;
  selection?: Selection;
  historical: boolean;
  matching: boolean;
  inspectorOpen: boolean;
  editing: Editing;
  onDirty: (value: boolean) => void;
  onNavigate: (id: string) => void;
  onReceipt: (id: string) => void;
  changed: () => void;
  disabled: boolean;
}) {
  return (
    <div hidden={!inspectorOpen}>
      {historical ? (
        matching && (
          <NativeInspector
            graph={graph}
            node={node}
            edge={edge}
            hasSelection={Boolean(selection)}
          />
        )
      ) : (
        <GraphInspector
          key={`${selection?.kind}:${node?.id ?? edge?.id}:${receipt ?? ""}`}
          graph={graph}
          node={node}
          edge={edge}
          receiptId={receipt}
          editing={editing}
          onDirty={onDirty}
          onNavigate={onNavigate}
          onReceipt={onReceipt}
          changed={changed}
          disabled={disabled}
        />
      )}
    </div>
  );
}

export function GraphSurface({
  inspectorOpen,
  actions,
  canvas,
  inspector,
}: {
  inspectorOpen: boolean;
  actions: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
}) {
  return (
    <>
      {actions}
      <div className={inspectorOpen ? "graph-layout" : "graph-layout canvas-only"}>
        {canvas}
        {inspector}
      </div>
    </>
  );
}
function canvasSelection(
  node: Entity | undefined,
  edge: GraphEdge | undefined,
  receipt: string | undefined,
) {
  return { selectedNode: node?.id, selectedEdge: edge?.id, receiptId: receipt ?? edge?.receiptId };
}
function useGraphNavigation() {
  const [navigation, setNavigation] = useState({
    root: "",
    expanded: [] as string[],
    inspectorOpen: false,
  });
  return {
    ...navigation,
    setRoot: (root: string) => setNavigation((value) => ({ ...value, root })),
    setExpanded: (expanded: SetStateAction<string[]>) =>
      setNavigation((value) => ({
        ...value,
        expanded: typeof expanded === "function" ? expanded(value.expanded) : expanded,
      })),
    setInspectorOpen: (inspectorOpen: SetStateAction<boolean>) =>
      setNavigation((value) => ({
        ...value,
        inspectorOpen:
          typeof inspectorOpen === "function" ? inspectorOpen(value.inspectorOpen) : inspectorOpen,
      })),
  };
}
function useGraphTimeline(editing: Editing) {
  const [before, setBefore] = useState<number>();
  const window = useProjection("/api/timeline", { before }, editing.epoch, editing.report);
  return { before, setBefore, window };
}
