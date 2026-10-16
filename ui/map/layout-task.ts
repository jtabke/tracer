import { layoutProjection } from "./layout.ts";
import { stableLayout } from "./stable-layout.ts";
import type { CameraRequest, Display, Geometry, Projection } from "./types.ts";

export function calculateLayout(
  projection: Projection,
  display: Partial<Display>,
  request: CameraRequest,
  previous: Geometry,
  retain: boolean,
) {
  if (request.geometry) return request.geometry;
  if (retainLocal(request, previous, retain))
    return stableLayout(
      projection,
      display,
      request.previous ?? previous,
      anchorId(request.anchor),
    );
  return layoutProjection(projection, display);
}

function retainLocal(request: CameraRequest, previous: Geometry, retain: boolean) {
  return (request.local || retain) && previous.nodes.length;
}
function anchorId(anchor: CameraRequest["anchor"]) {
  return typeof anchor === "object" ? anchor?.id : anchor;
}

// Layout and both measurement frames belong to one cancellable request.
// Disposal prevents an older scope (or an unmounted map) from moving the current camera.
type FrameScheduler = Pick<typeof globalThis, "requestAnimationFrame" | "cancelAnimationFrame">;
type LayoutTask<T> = {
  calculate(): T | PromiseLike<T>;
  onResult(result: T): void;
  onMeasure(result: T): void;
  onReady(result: T): void;
  onError(error: unknown): void;
};
export function runLayout<T>(
  { calculate, onResult, onMeasure, onReady, onError }: LayoutTask<T>,
  frames: FrameScheduler = globalThis,
) {
  let active = true;
  const pending = new Set<number>();
  const dispose = () => {
    active = false;
    for (const id of pending) frames.cancelAnimationFrame(id);
    pending.clear();
  };
  const reject = (error: unknown) => {
    if (!active) return;
    dispose();
    onError(error);
  };
  const schedule = (action: () => void) => {
    const id = frames.requestAnimationFrame(() => {
      pending.delete(id);
      if (!active) return;
      try {
        action();
      } catch (error) {
        reject(error);
      }
    });
    pending.add(id);
  };
  Promise.resolve()
    .then(() => (active ? calculate() : undefined))
    .then((result) => {
      if (!active || result === undefined) return;
      onResult(result);
      schedule(() => {
        onMeasure(result);
        schedule(() => onReady(result));
      });
    })
    .catch(reject);
  return dispose;
}
