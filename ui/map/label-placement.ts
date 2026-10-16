type Point = Readonly<{ x: number; y: number }>;
type Box = Point & Readonly<{ width: number; height: number }>;

const CLEARANCE = 6;
export const LABEL_HEIGHT = 26;
const MAX_ATTEMPTS = 160;

function overlaps(point: Point, width: number, box: Box) {
  return (
    point.x - width / 2 < box.x + box.width + CLEARANCE &&
    point.x + width / 2 > box.x - CLEARANCE &&
    point.y - LABEL_HEIGHT / 2 < box.y + box.height + CLEARANCE &&
    point.y + LABEL_HEIGHT / 2 > box.y - CLEARANCE
  );
}
function distance(point: Point, origin: Point) {
  return Math.abs(point.x - origin.x) + Math.abs(point.y - origin.y);
}
function tryPosition(
  pending: Point[],
  visited: Set<string>,
  obstacles: readonly Box[],
  origin: Point,
  width: number,
) {
  pending.sort((a, b) => distance(a, origin) - distance(b, origin));
  const point = pending.shift();
  if (!point) return;
  const key = `${point.x}:${point.y}`;
  if (visited.has(key)) return;
  visited.add(key);
  const blocker = obstacles.find((box) => overlaps(point, width, box));
  if (!blocker) return point;
  pending.push(
    { x: blocker.x - width / 2 - CLEARANCE, y: point.y },
    { x: blocker.x + blocker.width + width / 2 + CLEARANCE, y: point.y },
    { x: point.x, y: blocker.y - LABEL_HEIGHT / 2 - CLEARANCE },
    { x: point.x, y: blocker.y + blocker.height + LABEL_HEIGHT / 2 + CLEARANCE },
  );
}

// Stable nearest-first search with at most 160 candidate attempts.
// Each collision lookup scans the current obstacles.
// On exhaustion, place the label beyond the right edge of every prior obstacle.
export function placeLabel(origin: Point, width: number, obstacles: readonly Box[]): Point {
  const pending = [{ ...origin }],
    visited = new Set<string>();
  for (let attempt = 0; pending.length && attempt < MAX_ATTEMPTS; attempt++) {
    const position = tryPosition(pending, visited, obstacles, origin, width);
    if (position) return position;
  }
  return {
    x: Math.max(...obstacles.map((box) => box.x + box.width)) + width / 2 + 12,
    y: origin.y,
  };
}
