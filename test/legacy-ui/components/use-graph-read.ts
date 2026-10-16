import { read, url } from "../../../ui/api.ts";
import { useRead } from "../../../ui/use-read.ts";
import type { GraphTime } from "./graph-state.ts";
import { visibleGraph } from "./graph-state.ts";

/** Retain inspection context, while every temporal/refresh boundary pauses writes immediately. */
export function useGraphRead(
  root: string,
  expanded: string[],
  time: GraphTime | undefined,
  epoch: number,
  report: (error: unknown) => void,
  visible: boolean,
  depth?: number,
) {
  const query = {
    rootId: root,
    expanded,
    depth,
    atRevision: time?.atRevision,
    compareRevision: time?.compareRevision,
  };
  const endpoint = root ? url("/api/graph", query) : undefined;
  const projection = useRead(
    root || undefined,
    JSON.stringify([endpoint, epoch, visible]),
    async () => ({ endpoint: url("/api/graph", query), graph: await read("/api/graph", query) }),
    report,
    visible,
  );
  const loaded = projection.data ?? projection.retained;
  return {
    graph: visibleGraph(loaded, root, endpoint, time !== undefined),
    matching: projection.ready && loaded?.endpoint === endpoint,
    loading: projection.loading,
    failed: projection.failed,
  };
}
