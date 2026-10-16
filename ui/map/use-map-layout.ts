import { useUpdateNodeInternals, type NodeChange } from "@xyflow/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { applyMapCamera } from "./camera.ts";
import { moveGeometry } from "./graph-interaction.ts";
import { calculateLayout, runLayout } from "./layout-task.ts";
import type { CameraRequest, Display, Flow, FlowNode, Geometry, Projection } from "./types.ts";

export function useMapLayout(
  flow: Flow,
  projection: Projection,
  display: Display,
  contextKey: string,
  focus: string | null,
  folderScope: string | null,
) {
  const [geometry, setGeometry] = useState<Geometry>({ nodes: [], edges: [] });
  const [arrangement, setArrangement] = useState(0);
  const [working, setWorking] = useState(true);
  const [layoutError, setLayoutError] = useState("");
  const [zoom, setZoom] = useState(1);
  const camera = useRef<CameraRequest>({ fit: true });
  const layoutContext = useRef<string | null>(null);
  const latestGeometry = useEffectEvent(() => geometry);
  const updateNodeInternals = useUpdateNodeInternals();
  const { direction, spacing } = display;
  useEffect(() => {
    const requestedCamera = camera.current;
    const retainLayout = !requestedCamera.fit && layoutContext.current === contextKey;
    setWorking(true);
    setLayoutError("");
    return runLayout({
      calculate: () =>
        calculateLayout(
          projection,
          { direction, spacing },
          requestedCamera,
          latestGeometry(),
          retainLayout,
        ),
      onResult: (result) => {
        layoutContext.current = contextKey;
        setGeometry(result);
      },
      onMeasure: (result) => updateNodeInternals(result.nodes.map((node) => node.id)),
      onReady: (result) => {
        applyMapCamera(
          flow,
          requestedCamera,
          result,
          projection,
          focus,
          folderScope,
          window.innerWidth,
        );
        camera.current = { viewport: flow.getViewport() };
        setWorking(false);
      },
      onError: (error) => {
        setWorking(false);
        setLayoutError(
          `Could not arrange this scope: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    });
  }, [
    projection,
    direction,
    spacing,
    arrangement,
    contextKey,
    flow,
    focus,
    folderScope,
    updateNodeInternals,
  ]);
  return {
    geometry,
    working,
    layoutError,
    zoom,
    setZoom,
    camera,
    moveNodes(changes: NodeChange<FlowNode>[]) {
      setGeometry((current) => moveGeometry(current, changes, working));
    },
    arrangeLayout() {
      camera.current = { fit: true };
      setArrangement((current) => current + 1);
    },
  };
}
