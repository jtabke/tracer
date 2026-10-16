import type { Graph } from "../../../src/application/views.ts";
import type { Entity } from "../../../src/core/model.ts";
import { label } from "../../../ui/fields.tsx";
import type { GraphEdge } from "./graph-model.ts";

export function NativeInspector({
  graph,
  node,
  edge,
  hasSelection = Boolean(node || edge),
}: {
  graph: Graph;
  node?: Entity;
  edge?: GraphEdge;
  hasSelection?: boolean;
}) {
  const delta = node
    ? graph.differences?.nodes.find((value) => value.id === node.id)
    : graph.differences?.links.find((value) => value.id === edge?.relationshipId);
  const snapshot = node ?? edge?.relationship;
  return (
    <aside className="graph-inspector" aria-label="Native history inspector">
      <span className="eyebrow">Read-only native history</span>
      <h2>{node ? label(node) : (edge?.name ?? "Select a native object")}</h2>
      <p>
        Revision {graph.temporal?.at.projectRevision}. Observations, receipts, reviews and current
        freshness are excluded.
      </p>
      {delta ? (
        <>
          <h3>{delta.state}</h3>
          <h3>Before · revision {graph.temporal?.before?.projectRevision}</h3>
          <pre>
            {delta.before ? JSON.stringify(delta.before, null, 2) : "Not present at this revision"}
          </pre>
          <h3>After · revision {graph.temporal?.at.projectRevision}</h3>
          <pre>
            {delta.after ? JSON.stringify(delta.after, null, 2) : "Not present at this revision"}
          </pre>
        </>
      ) : snapshot ? (
        <pre>{JSON.stringify(snapshot, null, 2)}</pre>
      ) : (
        <p>
          {hasSelection
            ? "The selected object is absent at this revision."
            : "Select a node or native connection to inspect this revision."}
        </p>
      )}
    </aside>
  );
}
