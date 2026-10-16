import type { ComponentProps } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { boundedModelScale, fitModelScale } from "../../../ui/model-canvas-scale.ts";
import { modelFlow } from "../../../ui/model-flow.ts";
import { ModelMap } from "../../../ui/model-map.tsx";

/** One read-only viewport; selected definitions remain in the existing Model owner. */
export function ModelReadCanvas(props: ComponentProps<typeof ModelMap>) {
  const viewport = useRef<HTMLDivElement>(null);
  const bounds = modelFlow(props.schema, "workflow");
  const [fitted, setFitted] = useState(1);
  const [requested, setRequested] = useState<number | undefined>();
  const scale = requested ?? fitted;
  useLayoutEffect(() => {
    // Orient in the whole model first; deliberately focusing a type restores
    // readable labels. Returning from its definition retains the same camera.
    setRequested(props.selectedType ? 1 : undefined);
  }, [props.selectedType, props.frameRequest]);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const fit = () => {
      if (!element.clientWidth) return;
      const canvas = element.querySelector<HTMLElement>(".model-flow-scroll");
      if (!canvas?.clientHeight) return;
      setFitted(fitModelScale({ width: canvas.clientWidth, height: canvas.clientHeight }, bounds));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [bounds.width, bounds.height]);
  return (
    <div className="model-read-canvas" ref={viewport}>
      <div
        className="model-overview-controls"
        role="group"
        aria-label="Model overview canvas controls"
      >
        <button
          aria-label="Zoom out model overview"
          disabled={scale <= 0.15}
          onClick={() => setRequested(boundedModelScale(scale - 0.1))}
        >
          −
        </button>
        <output aria-label="Model overview zoom">{Math.round(scale * 100)}%</output>
        <button
          aria-label="Zoom in model overview"
          disabled={scale >= 1.5}
          onClick={() => setRequested(boundedModelScale(scale + 0.1))}
        >
          ＋
        </button>
        <button onClick={() => setRequested(1)}>100%</button>
        <button onClick={() => setRequested(undefined)}>Fit overview</button>
        <span>
          {scale < 0.7
            ? "Whole workflow · select a type to read its connections."
            : "Scroll to explore · select a type to focus its connections."}
        </span>
      </div>
      <ModelMap {...props} scale={scale} />
    </div>
  );
}
