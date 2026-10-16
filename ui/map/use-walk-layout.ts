import { useUpdateNodeInternals, type NodeChange } from "@xyflow/react";
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { applyWalkCamera } from "./camera.ts";
import { moveGeometry } from "./graph-interaction.ts";
import { calculateLayout, runLayout } from "./layout-task.ts";
import type { CameraRequest, Display, Flow, FlowNode, Geometry, Projection } from "./types.ts";
export function useWalkLayout(
  flow: Flow,
  projection: Projection,
  orientation: Display["direction"],
  current: string,
  canvas: RefObject<HTMLDivElement | null>,
) {
  const [geometry, setGeometry] = useState<Geometry>({ nodes: [], edges: [] });
  const [arrangement, setArrangement] = useState(0),
    [working, setWorking] = useState(true),
    [error, setError] = useState("");
  const request = useRef<CameraRequest>({ fit: true });
  const latestGeometry = useEffectEvent(() => geometry),
    updateInternals = useUpdateNodeInternals();
  useEffect(() => {
    const camera = request.current;
    setWorking(true);
    setError("");
    return runLayout<Geometry>({
      calculate: () =>
        calculateLayout(
          projection,
          { direction: orientation, spacing: "comfortable" },
          camera,
          latestGeometry(),
          !camera.fit,
        ),
      onResult: setGeometry,
      onMeasure: (result) => updateInternals(result.nodes.map((node) => node.id)),
      onReady: (result) => {
        applyWalkCamera(flow, camera, result, current, canvas.current);
        request.current = {};
        setWorking(false);
      },
      onError: (error) => {
        setWorking(false);
        setError(error instanceof Error ? error.message : String(error));
      },
    });
  }, [flow, projection, orientation, current, canvas, updateInternals, arrangement]);
  return {
    geometry,
    working,
    error,
    request,
    moveNodes(changes: NodeChange<FlowNode>[]) {
      setGeometry((old) => moveGeometry(old, changes, working));
    },
    arrange() {
      request.current = { fit: true };
      setArrangement((n) => n + 1);
    },
  };
}
