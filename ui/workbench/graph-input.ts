import { dragPoint } from "./graph-geometry.ts";
import type { Camera, Point, Projection, Size } from "./graph-geometry.ts";
import { createDelayedSelection } from "./selection-delay.ts";
import { wheelIntent } from "./canvas-input.ts";
type InputState = {
  layout: Map<string, Point>;
  pinned: Set<string>;
  selected: string;
  edge: string | null;
  scene: Size | null;
  camera: Camera;
};
type Options = {
  state: InputState;
  projection(): Projection;
  projectPoint(point: Point): Point;
  zoomAt(zoom: number, x: number, y: number): void;
  transform(): void;
  drawEdges(): void;
  drawNodeActions(): void;
  select(key: string): void;
  showDetails(edit?: boolean): void;
  expand(): void;
  openAdd(): void;
};
export function createGraphInput(options: Options) {
  const {
    state,
    projection,
    projectPoint,
    zoomAt,
    transform,
    drawEdges,
    drawNodeActions,
    select,
    showDetails,
    expand,
    openAdd,
  } = options;
  const selection = createDelayedSelection(select);
  let disposeScope = () => {};
  let currentCanvas: HTMLElement | null = null;
  let spaceHeld = false,
    suppressClickUntil = 0;
  function unbind() {
    selection.clear();
    disposeScope();
    disposeScope = () => {};
    currentCanvas = null;
    spaceHeld = false;
  }
  function panShortcut(event: KeyboardEvent, typing: boolean) {
    const target = event.target as HTMLElement;
    if (
      !currentCanvas ||
      event.code !== "Space" ||
      typing ||
      (target.closest("button,summary,a") && !target.closest(".node"))
    )
      return false;
    event.preventDefault();
    spaceHeld = true;
    currentCanvas.classList.add("space-pan");
    return true;
  }
  function bind(canvas: HTMLElement) {
    unbind();
    const scope = new AbortController();
    const { signal } = scope;
    const cancelNodes: (() => void)[] = [];
    canvas.addEventListener(
      "click",
      (event) => {
        if (performance.now() < suppressClickUntil || spaceHeld) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { capture: true, signal },
    );
    canvas.querySelectorAll<HTMLButtonElement>(".node").forEach((button) => {
      let start: { x: number; y: number; point: Point; pointerId: number } | undefined;
      let moved = false;
      cancelNodes.push(() => {
        const pointer = start?.pointerId;
        start = undefined;
        if (pointer !== undefined && button.hasPointerCapture(pointer))
          button.releasePointerCapture(pointer);
      });
      button.addEventListener(
        "pointerdown",
        (event) => {
          if (event.button !== 0 || spaceHeld || state.pinned.has(button.dataset.key!)) return;
          start = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            point: { ...state.layout.get(button.dataset.key!)! },
          };
          moved = false;
          button.setPointerCapture(event.pointerId);
        },
        { signal },
      );
      button.addEventListener(
        "pointermove",
        (event) => {
          if (!start || !state.scene) return;
          if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4 && !moved) return;
          moved = true;
          const point = state.layout.get(button.dataset.key!)!;
          Object.assign(
            point,
            dragPoint(
              start.point,
              { x: event.clientX - start.x, y: event.clientY - start.y },
              state.scene,
              state.camera,
              projection(),
            ),
          );
          const projected = projectPoint(point);
          button.style.left = projected.x + "px";
          button.style.top = projected.y + "px";
          drawEdges();
          drawNodeActions();
        },
        { signal },
      );
      button.addEventListener(
        "pointerup",
        () => {
          start = undefined;
        },
        { signal },
      );
      button.addEventListener(
        "pointercancel",
        () => {
          start = undefined;
        },
        { signal },
      );
      function handleNodeClick(event: MouseEvent) {
        if (performance.now() < suppressClickUntil || spaceHeld) return;
        if (moved) {
          moved = false;
          return;
        }
        if (event.detail > 1) return;
        if (state.selected === button.dataset.key! && !state.edge) return;
        selection.clear();
        if (event.detail === 0) select(button.dataset.key!);
        else {
          selection.defer(button.dataset.key!);
        }
      }
      button.addEventListener("click", handleNodeClick, { signal });
      button.addEventListener(
        "dblclick",
        () => {
          selection.clear();

          state.selected = button.dataset.key!;
          showDetails(true);
        },
        { signal },
      );
      button.addEventListener(
        "keydown",
        (event) => {
          if (event.key.toLowerCase() === "e") {
            event.preventDefault();
            state.selected = button.dataset.key!;
            expand();
          }
          if (event.key.toLowerCase() === "i") {
            event.preventDefault();
            state.selected = button.dataset.key!;
            showDetails();
          }
        },
        { signal },
      );
    });
    canvas.addEventListener(
      "dblclick",
      (event) => {
        if ((event.target as Element).closest("button,.edgehit,.node-actions")) return;
        openAdd();
      },
      { signal },
    );
    canvas.addEventListener(
      "wheel",
      (event) => {
        if ((event.target as Element).closest(".edge-detail,.node-actions,.canvas-tools")) return;
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const intent = wheelIntent(event, canvas.clientHeight);
        if (intent.kind === "zoom")
          zoomAt(
            state.camera.zoom * Math.exp(-Math.max(-150, Math.min(150, intent.delta)) * 0.002),
            event.clientX - rect.left,
            event.clientY - rect.top,
          );
        else {
          state.camera.x -= intent.x;
          state.camera.y -= intent.y;
          transform();
          drawNodeActions();
        }
      },
      { passive: false, signal },
    );
    let pan: { x: number; y: number; camera: Camera; pointerId: number } | undefined;
    canvas.addEventListener(
      "pointerdown",
      (event) => {
        if ((event.target as Element).closest(".node-actions,.edge-detail,.canvas-tools")) return;
        const forcedPan = event.button === 1 || (event.button === 0 && spaceHeld);
        if (
          !forcedPan &&
          (event.button !== 0 || (event.target as Element).closest("button,.edgehit"))
        )
          return;
        event.preventDefault();
        pan = {
          x: event.clientX,
          y: event.clientY,
          camera: { ...state.camera },
          pointerId: event.pointerId,
        };
        canvas.classList.add("panning");
        canvas.setPointerCapture(event.pointerId);
      },
      { signal },
    );
    canvas.addEventListener(
      "pointermove",
      (event) => {
        if (!pan) return;
        state.camera.x = pan.camera.x + event.clientX - pan.x;
        state.camera.y = pan.camera.y + event.clientY - pan.y;
        transform();
        drawNodeActions();
      },
      { signal },
    );
    const endPan = () => {
      if (pan) suppressClickUntil = performance.now() + 150;
      const pointer = pan?.pointerId;
      pan = undefined;
      if (pointer !== undefined && canvas.hasPointerCapture(pointer))
        canvas.releasePointerCapture(pointer);
      canvas.classList.remove("panning");
    };
    canvas.addEventListener("pointerup", endPan, { signal });
    canvas.addEventListener("pointercancel", endPan, { signal });
    canvas.addEventListener("lostpointercapture", endPan, { signal });
    canvas.addEventListener(
      "auxclick",
      (event) => {
        if (event.button === 1) event.preventDefault();
      },
      { signal },
    );

    currentCanvas = canvas;
    const cancel = () => {
      selection.clear();
      spaceHeld = false;
      canvas.classList.remove("space-pan", "panning");
      endPan();
      for (const cancelNode of cancelNodes) cancelNode();
    };
    canvas.ownerDocument.addEventListener(
      "keyup",
      (event) => {
        if (event.code === "Space") {
          spaceHeld = false;
          canvas.classList.remove("space-pan");
        }
      },
      { signal },
    );
    canvas.ownerDocument.defaultView!.addEventListener("blur", cancel, { signal });
    disposeScope = () => {
      scope.abort();
      cancel();
    };
  }
  return {
    bind,
    unbind,
    panShortcut,
    clearSelection: selection.clear,
    flushSelection: selection.flush,
  };
}
