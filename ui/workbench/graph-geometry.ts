export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Camera = Point & { zoom: number };
export type Projection = Size & Point;
export type GraphLink = { id: string; source: string; target: string };
export type GraphPaths = { keys: string[]; levels: Map<string, number> };

export function projectPoint(point: Point, scale: Point): Point {
  return { x: point.x * scale.x, y: point.y * scale.y };
}
export function zoomCamera(camera: Camera, value: number, anchor: Point): Camera {
  const zoom = Math.max(0.15, Math.min(2.5, value));
  const ratio = zoom / camera.zoom;
  return {
    x: anchor.x - (anchor.x - camera.x) * ratio,
    y: anchor.y - (anchor.y - camera.y) * ratio,
    zoom,
  };
}
export function fitCamera(nodes: (Size & { point: Point })[], viewport: Size): Camera {
  const left = Math.min(...nodes.map((n) => n.point.x - n.width / 2));
  const right = Math.max(...nodes.map((n) => n.point.x + n.width / 2));
  const top = Math.min(...nodes.map((n) => n.point.y - n.height / 2));
  const bottom = Math.max(...nodes.map((n) => n.point.y + n.height / 2));
  const zoom = Math.max(
    0.15,
    Math.min(
      nodes.length <= 8 ? 1.3 : 1,
      (viewport.width - 32) / (right - left),
      (viewport.height - 80) / (bottom - top),
    ),
  );
  return {
    zoom,
    x: (viewport.width - (right - left) * zoom) / 2 - left * zoom,
    y: 48 + (viewport.height - 48 - (bottom - top) * zoom) / 2 - top * zoom,
  };
}
export function graphProjection(
  scene: Size,
  projectedHeight: number | null,
  expanded: boolean,
  points: Point[],
  canvasWidth?: number,
): Projection {
  if (expanded)
    return {
      width: Math.max(scene.width, ...points.map((p) => p.x + 140)),
      height: Math.max(scene.height, ...points.map((p) => p.y + 120)),
      x: 1,
      y: 1,
    };
  const width = Math.max(640, Math.min(scene.width, canvasWidth ?? scene.width));
  const height = projectedHeight ?? scene.height;
  return { width, height, x: width / scene.width, y: height / scene.height };
}
export function dragPoint(
  origin: Point,
  delta: Point,
  scene: Size,
  camera: Camera,
  scale: Point,
): Point {
  return {
    x: Math.max(90, Math.min(scene.width - 90, origin.x + delta.x / camera.zoom / scale.x)),
    y: Math.max(65, Math.min(scene.height - 45, origin.y + delta.y / camera.zoom / scale.y)),
  };
}
function levelGroups(paths: GraphPaths) {
  const groups = new Map<number, string[]>();
  for (const key of paths.keys) {
    const level = paths.levels.get(key) ?? 0;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level)!.push(key);
  }
  return groups;
}
export function pathLayout(
  paths: GraphPaths,
  width: number,
  height: number,
  previous = new Map<string, Point>(),
  pinned = new Set<string>(),
) {
  const positions = new Map<string, Point>(),
    groups = levelGroups(paths);
  const maximum = Math.max(1, ...groups.keys());
  for (const [level, keys] of groups)
    for (const [index, key] of keys.entries())
      positions.set(
        key,
        pinned.has(key) && previous.has(key)
          ? { ...previous.get(key)! }
          : {
              x: width * (0.15 + (level / maximum) * 0.65),
              y: (height * (index + 1)) / (keys.length + 1),
            },
      );
  return positions;
}
/** Pack tall levels into adjacent readable columns, preserving pinned coordinates. */
export function investigationLayout(
  paths: GraphPaths,
  viewport: Size,
  potentialHeight: number,
  scale: Point,
  previous: Map<string, Point>,
  pinned: Set<string>,
) {
  const groups = levelGroups(paths);
  const rows = Math.max(1, Math.floor((potentialHeight - 48) / 74));
  const columns = [...groups]
    .sort(([a], [b]) => a - b)
    .flatMap(([, keys]) => {
      const chunks: string[][] = [];
      for (let start = 0; start < keys.length; start += rows)
        chunks.push(keys.slice(start, start + rows));
      return chunks;
    });
  const pitch = Math.max(
    220,
    Math.min(280, (viewport.width - 206) / Math.max(1, columns.length - 1)),
  );
  const estimate = Math.min(
    1,
    (viewport.width - 32) / (174 + pitch * Math.max(0, columns.length - 1)),
  );
  const rowPitch = 74 / Math.max(0.15, estimate);
  const positions = new Map<string, Point>();
  for (const [column, keys] of columns.entries())
    for (const [row, key] of keys.entries())
      positions.set(
        key,
        pinned.has(key) && previous.has(key)
          ? { ...previous.get(key)! }
          : {
              x: (column * pitch) / scale.x,
              y: ((row - (keys.length - 1) / 2) * rowPitch) / scale.y,
            },
      );
  return positions;
}
/** At most 100 candidates; dense scopes retain the bounded final fallback. */
export function missingPosition(
  anchor: Point,
  scene: Size,
  index: number,
  occupied: Iterable<Point>,
): Point {
  const others = [...occupied];
  let point = { ...anchor };
  for (let attempt = 0; attempt < 100; attempt++) {
    const angle = (attempt + index) * 2.399,
      radius = 115 + Math.floor(attempt / 8) * 65;
    point = {
      x: Math.max(105, Math.min(scene.width - 105, anchor.x + Math.cos(angle) * radius)),
      y: Math.max(85, Math.min(scene.height - 60, anchor.y + Math.sin(angle) * radius)),
    };
    if (
      others.every((other) => Math.abs(other.x - point.x) > 190 || Math.abs(other.y - point.y) > 85)
    )
      break;
  }
  return point;
}
