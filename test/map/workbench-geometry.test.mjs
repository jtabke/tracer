import test from "node:test";
import assert from "node:assert/strict";
import {
  zoomCamera,
  missingPosition,
  graphProjection,
  dragPoint,
  projectPoint,
  fitCamera,
  pathLayout,
  investigationLayout,
} from "../../ui/workbench/graph-geometry.ts";

test("cursor-anchored zoom preserves the world point through both zoom bounds", () => {
  const camera = { x: -50, y: 30, zoom: 0.8 },
    anchor = { x: 320, y: 200 };
  for (const value of [0.001, 1.5, 100]) {
    const next = zoomCamera(camera, value, anchor);
    assert.equal(next.zoom, Math.max(0.15, Math.min(2.5, value)));
    assert.ok(
      Math.abs((anchor.x - next.x) / next.zoom - (anchor.x - camera.x) / camera.zoom) < 1e-9,
    );
    assert.ok(
      Math.abs((anchor.y - next.y) / next.zoom - (anchor.y - camera.y) / camera.zoom) < 1e-9,
    );
  }
  assert.deepEqual(camera, { x: -50, y: 30, zoom: 0.8 });
});
test("proportional and expanded projection remain distinct; drag applies both scales", () => {
  const scene = { width: 1000, height: 800 };
  const scale = graphProjection(scene, 510, false, [], 680);
  assert.deepEqual(scale, { width: 680, height: 510, x: 0.68, y: 0.6375 });
  assert.deepEqual(graphProjection(scene, null, true, [{ x: 1200, y: 1000 }], 680), {
    width: 1340,
    height: 1120,
    x: 1,
    y: 1,
  });
  const origin = { x: 200, y: 200 };
  assert.deepEqual(dragPoint(origin, { x: 68, y: 51 }, scene, { x: 0, y: 0, zoom: 2 }, scale), {
    x: 250,
    y: 240,
  });
  assert.deepEqual(
    dragPoint(origin, { x: -10000, y: 10000 }, scene, { x: 0, y: 0, zoom: 1 }, scale),
    { x: 90, y: 755 },
  );
});
test("fitting measured cards respects the available viewport and toolbar allowance", () => {
  const nodes = [
    { point: { x: 100, y: 100 }, width: 174, height: 66 },
    { point: { x: 600, y: 300 }, width: 174, height: 100 },
  ];
  const viewport = { width: 680, height: 420 };
  const camera = fitCamera(nodes, viewport);
  for (const node of nodes) {
    const p = projectPoint(node.point, { x: camera.zoom, y: camera.zoom });
    assert.ok(p.x + camera.x - (node.width * camera.zoom) / 2 >= 0);
    assert.ok(p.x + camera.x + (node.width * camera.zoom) / 2 <= viewport.width);
    assert.ok(p.y + camera.y - (node.height * camera.zoom) / 2 >= 48);
    assert.ok(p.y + camera.y + (node.height * camera.zoom) / 2 <= viewport.height);
  }
});
test("investigation packing is deterministic and preserves pinned coordinates without sharing objects", () => {
  const keys = Array.from({ length: 12 }, (_, i) => `A${i}`);
  const paths = { keys, levels: new Map(keys.map((key) => [key, 1])) };
  const previous = new Map([["A0", { x: 45, y: 65 }]]),
    pinned = new Set(["A0"]);
  const viewport = { width: 680, height: 400 };
  const result = investigationLayout(paths, viewport, 300, { x: 1, y: 1 }, previous, pinned);
  assert.equal(result.size, 12);
  assert.deepEqual(result.get("A0"), previous.get("A0"));
  assert.notEqual(result.get("A0"), previous.get("A0"));
  assert.ok(new Set([...result.values()].map((p) => p.x)).size > 1);
  assert.deepEqual(
    result,
    investigationLayout(paths, viewport, 300, { x: 1, y: 1 }, previous, pinned),
  );
  const initial = pathLayout(paths, 1000, 600, previous, pinned);
  assert.deepEqual(initial.get("A0"), previous.get("A0"));
  result.get("A0").x = 999;
  assert.equal(previous.get("A0").x, 45);
});

test("missing-node placement is bounded and deterministic without changing arranged points", () => {
  const scene = { width: 640, height: 510 },
    anchor = { x: 300, y: 250 };
  assert.deepEqual(missingPosition(anchor, scene, 0, []), { x: 415, y: 250 });
  const occupied = Array.from({ length: 100 }, (_, i) => ({
    x: 50 + (i % 10) * 60,
    y: 40 + Math.floor(i / 10) * 45,
  }));
  const before = structuredClone(occupied);
  const position = missingPosition(anchor, scene, 3, occupied);
  assert.ok(position.x >= 105 && position.x <= scene.width - 105);
  assert.ok(position.y >= 85 && position.y <= scene.height - 60);
  assert.deepEqual(position, missingPosition(anchor, scene, 3, occupied));
  assert.deepEqual(occupied, before);
});
