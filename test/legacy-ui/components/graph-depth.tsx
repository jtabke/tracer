import type { Graph } from "../../../src/application/views.ts";

export function GraphDepthControl({
  depth,
  onDepth,
  family = false,
}: {
  depth: number;
  onDepth(value: number): void;
  family?: boolean;
}) {
  return (
    <div className="graph-depth-toolbar">
      <label>
        Graph depth
        <select
          aria-label="Graph depth"
          value={depth}
          onChange={(event) => onDepth(Number(event.target.value))}
        >
          {family && <option value={0}>Loaded family</option>}
          {[1, 2, 3, 4, 5, 6].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? "level" : "levels"}
            </option>
          ))}
        </select>
      </label>
      <span className="muted">
        Follow recorded connections in both directions. Arrows retain their meaning.
      </span>
    </div>
  );
}

export function GraphDepthSummary({ graph }: { graph: Graph }) {
  if (!graph.trace) return null;
  return (
    <p className="graph-depth-summary" aria-live="polite">
      {graph.nodes.length} items · {graph.links.length} recorded connections · {graph.trace.depth}{" "}
      {graph.trace.depth === 1 ? "level" : "levels"}
      {traceBoundary(graph)}
      {!!graph.evaluations.length &&
        " Evaluation inputs are included as provenance; depth follows ordinary connections."}
    </p>
  );
}

function traceBoundary(graph: Graph) {
  const count = graph.trace!.frontier.length;
  if (graph.temporal?.before)
    return ` · Native comparison includes both snapshots; ${count} unexpanded boundary items in the target revision.`;
  return count
    ? ` · ${count} items at the depth boundary; increase depth to check for further connections.`
    : " · All ordinary connections reachable from the starting item are shown.";
}
