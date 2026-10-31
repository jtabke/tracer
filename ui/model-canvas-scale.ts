/** Shared presentation bounds for read and draft model canvases. */
function boundedModelScale(value: number) {
  return Math.max(0.15, Math.min(1.5, value));
}

export function fitModelScale(
  viewport: { width: number; height: number },
  bounds: { width: number; height: number },
) {
  return boundedModelScale(
    Math.min(1, viewport.width / bounds.width, viewport.height / bounds.height),
  );
}
