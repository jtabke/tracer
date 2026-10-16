import { useEffect, useEffectEvent, type RefObject } from "react";
import { listenForResize } from "./resize-listener.ts";
import type { Flow, Projection, WorkingView } from "./types.ts";
type WindowTools = {
  walking: boolean;
  organizeIds: string[] | null;
  panel: string | null;
  query: string;
  setOrganizeIds(value: null): void;
  setPanel(value: null): void;
  setQuery(value: string): void;
  clearSelection(): void;
  panelTrigger: RefObject<HTMLElement | null>;
  searchRef: RefObject<HTMLInputElement | null>;
};
export function useMapWindow(
  flow: Flow,
  projection: Projection,
  view: WorkingView,
  tools: WindowTools,
) {
  const escape = useEffectEvent((event: KeyboardEvent) => {
    if (tools.walking || event.key !== "Escape") return;
    if (tools.organizeIds) tools.setOrganizeIds(null);
    else if (tools.panel) {
      tools.setPanel(null);
      tools.panelTrigger.current?.focus();
    } else if (tools.query) {
      tools.setQuery("");
      tools.searchRef.current?.focus();
    } else tools.clearSelection();
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => escape(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const { focus, folderScope } = view,
    kind = view.selected?.kind,
    id = view.selected?.id;
  const roots = projection.rootIds;
  useEffect(
    () =>
      listenForResize(() => {
        const anchor = focus ?? (folderScope ? roots?.[0] : null) ?? (kind === "group" ? id : null);
        flow.fitView({
          ...(anchor ? { nodes: [{ id: anchor }] } : {}),
          padding: 0.16,
          minZoom: anchor ? 0.8 : 0.2,
          maxZoom: 1,
          duration: 0,
        });
      }, 2),
    [flow, focus, folderScope, roots, kind, id],
  );
}
