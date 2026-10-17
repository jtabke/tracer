import { locate } from "./matrix-selection.ts";
import type { MatrixContext } from "./matrix-types.ts";

type AnchorBounds = Pick<DOMRect, "left" | "bottom">;
export function editorPlacement(
  bounds: AnchorBounds,
  viewport: { width: number; height: number },
  height: number,
  quickTitle: boolean,
  sheet: boolean,
) {
  const width = Math.min(sheet ? viewport.width - 32 : quickTitle ? 350 : 410, viewport.width - 32);
  return {
    width,
    maxHeight: Math.min(590, viewport.height - 150),
    left: Math.max(16, Math.min(viewport.width - width - 16, bounds.left)),
    top: sheet
      ? Math.max(90, viewport.height - height - 16)
      : Math.max(90, Math.min(bounds.bottom + 6, viewport.height - height - 16)),
  };
}
export function placeMatrixEditor(get: () => MatrixContext) {
  const { app } = get(),
    popover = app.querySelector<HTMLElement>("#matrix-cell-popover");
  if (!popover) return () => {};
  const controller = new AbortController();
  let active = true;
  function dispose() {
    active = false;
    controller.abort();
    observer?.disconnect();
  }
  function anchor() {
    const draft = get().state.matrixDraft;
    if (!draft) return null;
    if (draft.kind === "root")
      return app.querySelector<HTMLElement>(
        draft.origin === "row" ? "[data-grid-create-root]" : '[data-action="create-artifact"]',
      );
    const cell = locate({ app }, draft.row, draft.column);
    if (!cell) return null;
    const key = draft.kind === "artifact" ? draft.key : draft.targetKey;
    return (
      cell.querySelector<HTMLElement>(`[data-grid-artifact="${CSS.escape(key)}"]`) ??
      cell.querySelector<HTMLElement>("[data-grid-artifact], [data-cell-add]") ??
      cell
    );
  }
  function position() {
    if (!active) return;
    if (!popover!.isConnected) {
      dispose();
      return;
    }
    const draft = get().state.matrixDraft,
      element = anchor();
    if (!draft || !element) return;
    const viewport = { width: innerWidth, height: innerHeight },
      quickTitle = draft.kind === "artifact" && Boolean(draft.quickTitle);
    const sheet =
      viewport.width <= 760 &&
      !quickTitle &&
      (Boolean(draft.expanded) || draft.kind === "artifact");
    popover!.classList.toggle("cell-editor-sheet", sheet);
    const bounds = element.getBoundingClientRect();
    const first = editorPlacement(bounds, viewport, 0, quickTitle, sheet);
    popover!.style.width = first.width + "px";
    popover!.style.maxHeight = first.maxHeight + "px";
    const placed = editorPlacement(
      bounds,
      viewport,
      popover!.getBoundingClientRect().height,
      quickTitle,
      sheet,
    );
    popover!.style.left = placed.left + "px";
    popover!.style.top = placed.top + "px";
  }
  let observer: ResizeObserver | undefined;
  popover.showPopover();
  position();
  observer = new ResizeObserver(position);
  observer.observe(popover);
  addEventListener("resize", position, { signal: controller.signal });
  app
    .querySelector(".matrix-scroll")
    ?.addEventListener("scroll", position, { signal: controller.signal });
  return dispose;
}
