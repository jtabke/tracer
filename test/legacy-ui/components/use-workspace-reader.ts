import { useEffect, useLayoutEffect, useRef, useState } from "react";

type ReadingOrigin = { element: HTMLElement | null; x: number; y: number };

/** Presentation state only: one retained inspector, with reversible scope focus. */
export function useWorkspaceReader(identity: string | undefined, leaveEditing: () => void) {
  const surface = useRef<HTMLElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [focused, setFocused] = useState(false);
  const origin = useRef<ReadingOrigin | undefined>(undefined);
  const restore = useRef(false);
  const active = focused && narrow;
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setNarrow(entry.contentRect.width < 920);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (active) {
      region.current?.scrollIntoView({ block: "start" });
      region.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      return;
    }
    if (!restore.current) return;
    const saved = origin.current;
    const frame = requestAnimationFrame(() => {
      // Leaving for the project browser may happen before this frame runs.
      if (!restore.current) return;
      restore.current = false;
      restoreReadingOrigin(saved, surface.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [active, identity]);
  const open = () => {
    if (!narrow) return;
    if (!active) {
      origin.current = {
        element: document.activeElement as HTMLElement | null,
        x: window.scrollX,
        y: window.scrollY,
      };
    }
    restore.current = false;
    setFocused(true);
  };
  const hide = () => {
    restore.current = false;
    setFocused(false);
  };
  const returnToScope = () => {
    restore.current = true;
    leaveEditing();
    setFocused(false);
  };
  return { surface, region, narrow, active, open, hide, returnToScope };
}

function restoreReadingOrigin(saved: ReadingOrigin | undefined, surface: HTMLElement | null) {
  if (!saved) return;
  window.scrollTo(saved.x, saved.y);
  const element = saved.element;
  if (
    element?.isConnected &&
    element.getClientRects().length &&
    !element.matches(":disabled") &&
    typeof element.focus === "function"
  ) {
    element.focus({ preventScroll: true });
    if (document.activeElement === element) return;
  }
  surface?.querySelector<HTMLElement>(".workspace-bar h2")?.focus({ preventScroll: true });
}
