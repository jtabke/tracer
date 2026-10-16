import type { CameraRequest, Flow, FlowNode, Geometry, Projection } from "./types.ts";
function frameNodes(ids: string[] | undefined) {
  return ids?.length ? { nodes: ids.map((id) => ({ id })) } : {};
}
function readingZoom(anchor: unknown) {
  return anchor ? 0.8 : 0.2;
}
function mapFrameIds(
  request: CameraRequest,
  projection: Projection,
  focus: string | null,
  width: number,
) {
  if (width > 760) return request.frameIds;
  return [focus, ...(request.frameIds ?? []), ...(projection.rootIds ?? [])]
    .filter((id): id is string => !!id)
    .slice(0, 1);
}
function restoreAnchor(flow: Flow, request: CameraRequest, result: Geometry) {
  if (!request.viewport) return;
  const viewport = { ...request.viewport };
  const original = typeof request.anchor === "object" ? request.anchor : null;
  const anchor = original ? result.absolute?.get(original.id) : undefined;
  if (anchor && original) {
    viewport.x += (original.x - anchor.x) * viewport.zoom;
    viewport.y += (original.y - anchor.y) * viewport.zoom;
  }
  flow.setViewport(viewport);
}
export function applyMapCamera(
  flow: Flow,
  request: CameraRequest,
  result: Geometry,
  projection: Projection,
  focus: string | null,
  folderScope: string | null,
  width: number,
) {
  if (request.fit)
    flow.fitView({
      ...frameNodes(mapFrameIds(request, projection, focus, width)),
      padding: 0.16,
      minZoom: readingZoom(focus || folderScope),
      maxZoom: 1,
      duration: 0,
    });
  else if (request.viewport) restoreAnchor(flow, request, result);
}
function revealOffset(start: number, end: number, size: number) {
  return start < 30 ? 30 - start : end > size - 30 ? size - 30 - end : 0;
}
function revealCurrent(flow: Flow, node: FlowNode | undefined, canvas: HTMLElement | null) {
  if (!node || !canvas) return;
  const view = flow.getViewport();
  const left = node.position.x * view.zoom + view.x,
    top = node.position.y * view.zoom + view.y;
  view.x += revealOffset(left, left + node.width * view.zoom, canvas.clientWidth);
  view.y += revealOffset(top, top + node.height * view.zoom, canvas.clientHeight);
  flow.setViewport(view);
}
export function applyWalkCamera(
  flow: Flow,
  request: CameraRequest,
  result: Geometry,
  current: string,
  canvas: HTMLElement | null,
) {
  if (request.fit) flow.fitView({ padding: 0.2, minZoom: 0.65, maxZoom: 1, duration: 0 });
  else if (request.viewport) flow.setViewport(request.viewport);
  else
    revealCurrent(
      flow,
      result.nodes.find((node) => node.id === current),
      canvas,
    );
}
