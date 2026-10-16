import { useLayoutEffect, useMemo, useState } from "react";
import type { FamilyWorkspace, Graph } from "../../../src/application/views.ts";
import { GraphCanvas } from "./graph-canvas.tsx";
import { GraphDepthControl, GraphDepthSummary } from "./graph-depth.tsx";
import { useGraphRead } from "./use-graph-read.ts";
import type { WorkspaceActions } from "./workspace-context.tsx";

/** The loaded family is retained while a deeper, snapshot-consistent native trace is read. */
export function WorkspaceGraph({
  data,
  selectedId,
  actions,
}: {
  data: FamilyWorkspace;
  selectedId?: string;
  actions: WorkspaceActions;
}) {
  const [depth, setDepth] = useState(0);
  const base = useMemo<Graph>(
    () => ({
      schema: data.schema,
      rootId: data.root.id,
      expanded: [],
      nodes: data.nodes,
      links: data.links,
      evaluations: [],
      external: [],
    }),
    [data],
  );
  const read = useGraphRead(
    data.root.id,
    [],
    undefined,
    actions.graphRead?.epoch ?? data.projectRevision,
    actions.graphRead?.report ?? (() => {}),
    depth > 0,
    depth || undefined,
  );
  const graph = depth ? (read.graph ?? base) : base;
  const pending = depth > 0 && !read.matching;
  const onRead = actions.graphRead?.onRead;
  useLayoutEffect(() => {
    onRead?.(depth ? read.graph : undefined, depth > 0 && read.matching, depth > 0);
  }, [depth, read.graph, read.matching, onRead]);
  useLayoutEffect(() => () => onRead?.(undefined, false, false), [onRead]);
  return (
    <div className="family-graph">
      <GraphDepthControl family depth={depth} onDepth={setDepth} />
      <FamilyGraphStatus
        depth={depth}
        graph={graph}
        data={data}
        loading={read.loading}
        failed={read.failed}
      />
      <GraphCanvas
        graph={graph}
        provenance={depth ? "all" : "native"}
        selectedNode={selectedId}
        actionsDisabled={actions.paused || pending}
        onNode={(id) => {
          const entity = graph.nodes.find((node) => node.id === id);
          if (entity) actions.onChoose(entity);
        }}
        onEdge={(edge) => {
          if (edge.relationship) actions.onInspect(edge.relationship);
          else if (edge.receiptId) {
            if (actions.onReceipt) {
              actions.onReceipt(edge.receiptId, edge.target);
              return;
            }
            const output = graph.nodes.find((node) => node.id === edge.source);
            if (output) actions.onChoose(output);
          }
        }}
      />
    </div>
  );
}

function FamilyGraphStatus({
  depth,
  graph,
  data,
  loading,
  failed,
}: {
  depth: number;
  graph: Graph;
  data: FamilyWorkspace;
  loading: boolean;
  failed: boolean;
}) {
  return (
    <>
      {depth ? (
        <GraphDepthSummary graph={graph} />
      ) : (
        <p className="muted">
          {graph.nodes.length} items · {graph.links.length} recorded connections in the loaded
          family scope.
          {data.nextAfter ? " More family members are on the next page." : ""} Choose a graph depth
          to follow connections beyond this scope.
        </p>
      )}
      {loading && depth > 0 && <p role="status">Loading trace…</p>}
      {failed && depth > 0 && (
        <p role="alert" className="error">
          Could not load this depth. The previous trace and draft are retained; choose a smaller
          depth or another starting item.
        </p>
      )}
    </>
  );
}
