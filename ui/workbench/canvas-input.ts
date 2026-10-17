type WheelIntent = { kind: "zoom"; delta: number } | { kind: "pan"; x: number; y: number };
// One gesture map for every device; wheel events do not identify the hardware.
export function wheelIntent(
  event: Pick<WheelEvent, "deltaMode" | "deltaX" | "deltaY" | "ctrlKey" | "metaKey" | "shiftKey">,
  height: number,
): WheelIntent {
  const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
  const x = event.deltaX * factor,
    y = event.deltaY * factor;
  if (event.ctrlKey || event.metaKey) return { kind: "zoom", delta: y };
  if (event.shiftKey) return { kind: "pan", x: x || y, y: x ? y : 0 };
  // A horizontal-only gesture pans; vertical and diagonal scrolling zoom.
  if (y === 0) return { kind: "pan", x, y: 0 };
  return { kind: "zoom", delta: y };
}
