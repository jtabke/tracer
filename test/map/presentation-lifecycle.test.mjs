import test from "node:test";
import assert from "node:assert/strict";
import { listenForResize } from "../../ui/map/resize-listener.ts";
import { placeLabel } from "../../ui/map/label-placement.ts";
import { readableLabels } from "../../ui/map/connection-labels.ts";

function windowFrames() {
  const callbacks = new Map(),
    listeners = new Set();
  let sequence = 0;
  return {
    callbacks,
    listeners,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
    requestAnimationFrame(callback) {
      callbacks.set(++sequence, callback);
      return sequence;
    },
    cancelAnimationFrame: (id) => callbacks.delete(id),
    resize() {
      for (const listener of listeners) listener();
    },
    flush() {
      const [id, callback] = callbacks.entries().next().value;
      callbacks.delete(id);
      callback();
    },
  };
}

test("a resize burst schedules one camera update after both measurement frames", () => {
  const target = windowFrames(),
    calls = [];
  const dispose = listenForResize(() => calls.push("camera"), 2, target);
  target.resize();
  target.resize();
  target.resize();
  assert.equal(target.callbacks.size, 1);
  target.flush();
  assert.deepEqual(calls, []);
  target.resize();
  target.flush();
  target.flush();
  assert.deepEqual(calls, ["camera"]);
  dispose();
  assert.equal(target.listeners.size, 0);
});

for (const completedFrames of [0, 1]) {
  test(`replacing a resize scope after ${completedFrames} frames cancels its camera update`, () => {
    const target = windowFrames(),
      calls = [];
    const dispose = listenForResize(() => calls.push("obsolete"), 2, target);
    target.resize();
    if (completedFrames) target.flush();
    dispose();
    dispose();
    assert.equal(target.callbacks.size, 0);
    const next = listenForResize(() => calls.push("current"), 1, target);
    target.resize();
    target.flush();
    assert.deepEqual(calls, ["current"]);
    next();
  });
}

test("label placement retains a clear origin and moves a blocked label without mutating inputs", () => {
  const origin = { x: 50, y: 50 },
    obstacles = [{ x: 0, y: 0, width: 100, height: 100 }];
  assert.deepEqual(placeLabel(origin, 40, []), origin);
  const snapshot = structuredClone(obstacles);
  assert.deepEqual(placeLabel(origin, 40, obstacles), { x: 50, y: -19 });
  assert.deepEqual(obstacles, snapshot);
  assert.deepEqual(origin, { x: 50, y: 50 });
});

test("dense collision search terminates deterministically beyond the obstacle field", () => {
  const obstacles = Array.from({ length: 40 }, (_, row) =>
    Array.from({ length: 40 }, (_, column) => ({
      x: column * 25,
      y: row * 25,
      width: 30,
      height: 30,
    })),
  ).flat();
  const position = placeLabel({ x: 500, y: 500 }, 330, obstacles);
  assert.deepEqual(position, { x: 1182, y: 500 });
  assert.deepEqual(placeLabel({ x: 500, y: 500 }, 330, obstacles), position);
});

function graphNodes() {
  return [
    { id: "parent", position: { x: 20, y: 30 }, width: 500, height: 400, data: { open: true } },
    {
      id: "child",
      parentId: "parent",
      position: { x: 50, y: 100 },
      width: 220,
      height: 82,
      data: {},
    },
    { id: "other", position: { x: 700, y: 200 }, width: 220, height: 82, data: {} },
  ];
}
test("parallel labels avoid earlier labels; hidden and missing-endpoint links reserve no space", () => {
  const data = { showLabel: true, manual: false, labelPosition: { x: 600, y: 150 } };
  const edge = { id: "first", source: "child", target: "other", label: "connects", data };
  const edges = [
    edge,
    { ...edge, id: "second" },
    { ...edge, id: "hidden", data: { ...data, showLabel: false } },
    { ...edge, id: "missing", target: "absent" },
  ];
  const nodes = graphNodes();
  const before = structuredClone({ nodes, edges });
  const labels = readableLabels(nodes, edges, true);
  assert.deepEqual([...labels.keys()], ["first", "second"]);
  assert.notDeepEqual(labels.get("first").position, labels.get("second").position);
  assert.deepEqual({ nodes, edges }, before);
});

for (const vertical of [true, false]) {
  test(`manual self-loop labels use the nested absolute geometry (${vertical ? "vertical" : "horizontal"})`, () => {
    const labels = readableLabels(
      graphNodes(),
      [
        {
          id: "loop",
          source: "child",
          target: "child",
          label: "retries",
          data: { showLabel: true, manual: true },
        },
      ],
      vertical,
    );
    const origin = labels.get("loop").origin;
    assert.deepEqual(origin, vertical ? { x: 320, y: 171 } : { x: 180, y: 100 });
  });
}
