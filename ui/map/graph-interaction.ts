import type { NodeChange } from "@xyflow/react";
import { applyNodeChanges } from "@xyflow/react";
import type { FlowNode, Geometry } from "./types.ts";

// Ignore drag updates while layout owns placement; moving a group also moves its children.
export function moveGeometry(
  geometry: Geometry,
  changes: NodeChange<FlowNode>[],
  working: boolean,
) {
  const updates = changes.filter(
    (change) => change.type === "dimensions" || (change.type === "position" && !working),
  );
  if (!updates.length) return geometry;
  const moved = new Set(
    updates.filter((change) => change.type === "position").map((change) => change.id),
  );
  for (const node of geometry.nodes) if (moved.has(node.parentId ?? "")) moved.add(node.id);
  return {
    ...geometry,
    nodes: applyNodeChanges(updates, geometry.nodes),
    edges: geometry.edges.map((edge) =>
      moved.has(edge.source) || moved.has(edge.target)
        ? { ...edge, data: { ...edge.data, manual: true } }
        : edge,
    ),
  };
}

// Both map dialogs skip hidden/disabled controls and wrap focus only at the boundaries.
export function trapFocus(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">,
  container: HTMLElement,
) {
  if (event.key !== "Tab") return;
  const controls = [
    ...container.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
    ),
  ].filter((node) => node.getClientRects().length);
  if (event.shiftKey) controls.reverse();
  if (container.ownerDocument.activeElement === controls.at(-1)) {
    event.preventDefault();
    controls[0].focus();
  }
}
