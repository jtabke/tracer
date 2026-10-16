import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { trapFocus } from "./graph-interaction.ts";
import { listenForResize } from "./resize-listener.ts";
import type { Flow } from "./types.ts";
export function useTraceDialog(
  flow: Flow,
  current: string,
  stepCount: number,
  returnFocus: Element | null,
  onClose: () => void,
) {
  const dialog = useRef<HTMLElement>(null),
    canvas = useRef<HTMLDivElement>(null),
    returnButton = useRef<HTMLButtonElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    previousCurrent = useRef(current);
  useEffect(() => {
    const previous = returnFocus ?? document.activeElement;
    returnButton.current?.focus();
    return () => {
      requestAnimationFrame(() => {
        if (
          previous instanceof HTMLElement &&
          previous.isConnected &&
          !document.querySelector(".trace-walker")
        )
          previous.focus();
      });
    };
  }, [returnFocus]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [onClose]);
  useEffect(() => {
    if (previousCurrent.current !== current) heading.current?.focus();
    previousCurrent.current = current;
  }, [current]);
  useEffect(() => {
    dialog.current
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [stepCount]);
  useEffect(
    () =>
      listenForResize(() =>
        flow.fitView({
          nodes: [{ id: current }],
          padding: 0.15,
          minZoom: 0.75,
          maxZoom: 1,
          duration: 0,
        }),
      ),
    [flow, current],
  );
  return {
    dialog,
    canvas,
    returnButton,
    heading,
    keyDown(event: ReactKeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (dialog.current) trapFocus(event, dialog.current);
    },
  };
}
