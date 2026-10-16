import type { GetSmoothStepPathParams } from "@xyflow/react";
import { getSmoothStepPath } from "@xyflow/react";
import type { EdgeData } from "./types.ts";
type RouteProps = GetSmoothStepPathParams & {
  source: string;
  target: string;
  data: Partial<
    Pick<EdgeData, "points" | "manual" | "labelPosition" | "vertical" | "selfWidth" | "selfHeight">
  >;
};

export function edgeRoute(props: RouteProps) {
  const { data } = props;
  if (data.manual) return manualRoute(props);
  return {
    path: (data.points ?? []).map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "),
    labelPosition: data.labelPosition,
  };
}
export function manualRoute(props: RouteProps) {
  if (props.source === props.target) return loopRoute(props);
  const [path, x, y] = getSmoothStepPath(props);
  return { path, labelPosition: { x, y } };
}
function loopRoute({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty, data }: RouteProps) {
  if (data.vertical) {
    const right = sx + (data.selfWidth ?? 220) / 2 + 30;
    return {
      path: `M${sx},${sy} V${sy + 24} H${right} V${ty - 30} H${tx} V${ty}`,
      labelPosition: { x: right, y: (sy + ty) / 2 },
    };
  }
  const top = sy - (data.selfHeight ?? 82) / 2 - 30;
  return {
    path: `M${sx},${sy} H${sx + 30} V${top} H${tx - 30} V${ty} H${tx}`,
    labelPosition: { x: (sx + tx) / 2, y: top },
  };
}
