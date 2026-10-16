import test from "node:test";
import assert from "node:assert/strict";
import { runLayout } from "../../ui/map/layout-task.ts";
import { moveGeometry, trapFocus } from "../../ui/map/graph-interaction.ts";
import { applyMapCamera, applyWalkCamera } from "../../ui/map/camera.ts";
import { edgeRoute, manualRoute } from "../../ui/map/edge-route.ts";

const settle = () => new Promise(setImmediate);
function frames() {
  const pending = new Map();
  let next = 0;
  return {
    pending,
    requestAnimationFrame(callback) {
      pending.set(++next, callback);
      return next;
    },
    cancelAnimationFrame(id) {
      pending.delete(id);
    },
    flush() {
      const [id, callback] = pending.entries().next().value;
      pending.delete(id);
      callback();
    },
  };
}
function task(calculate, scheduler, events) {
  return runLayout(
    {
      calculate,
      onResult: (value) => events.push(["result", value]),
      onMeasure: (value) => events.push(["measure", value]),
      onReady: (value) => events.push(["camera", value]),
      onError: (error) => events.push(["error", error.message]),
    },
    scheduler,
  );
}

test("an obsolete pending layout cannot replace the next scope or move its camera", async () => {
  const scheduler = frames(),
    events = [];
  let finishOld;
  const old = new Promise((resolve) => {
    finishOld = resolve;
  });
  const dispose = task(() => old, scheduler, events);
  await settle();
  dispose();
  const finish = task(() => "new scope", scheduler, events);
  await settle();
  scheduler.flush();
  scheduler.flush();
  finishOld("old scope");
  await settle();
  assert.deepEqual(events, [
    ["result", "new scope"],
    ["measure", "new scope"],
    ["camera", "new scope"],
  ]);
  assert.equal(scheduler.pending.size, 0);
  finish();
});

for (const completedFrames of [0, 1]) {
  test(`disposing after ${completedFrames} measurement frames prevents all remaining layout work`, async () => {
    const scheduler = frames(),
      events = [];
    const dispose = task(() => "scope", scheduler, events);
    await settle();
    for (let i = 0; i < completedFrames; i++) scheduler.flush();
    dispose();
    dispose();
    assert.equal(scheduler.pending.size, 0);
    assert.deepEqual(
      events.map(([name]) => name),
      completedFrames ? ["result", "measure"] : ["result"],
    );
  });
}

test("synchronous and asynchronous layout failures are reported once and never schedule a camera", async () => {
  for (const calculate of [
    () => {
      throw new Error("sync");
    },
    () => Promise.reject(new Error("async")),
  ]) {
    const scheduler = frames(),
      events = [];
    task(calculate, scheduler, events);
    await settle();
    assert.equal(events.length, 1);
    assert.equal(events[0][0], "error");
    assert.equal(scheduler.pending.size, 0);
  }
});

test("unmount before calculation skips work; late rejection after disposal is ignored", async () => {
  const scheduler = frames(),
    events = [];
  task(
    () => {
      throw new Error("must not run");
    },
    scheduler,
    events,
  )();
  await settle();
  let reject;
  const pending = new Promise((_, fail) => {
    reject = fail;
  });
  const dispose = task(() => pending, scheduler, events);
  await settle();
  dispose();
  reject(new Error("old error"));
  await settle();
  assert.deepEqual(events, []);
});

test("measurement failure cancels the layout before the camera stage", async () => {
  const scheduler = frames(),
    events = [];
  runLayout(
    {
      calculate: () => "scope",
      onResult() {},
      onMeasure() {
        throw new Error("measurement");
      },
      onReady: () => events.push("camera"),
      onError: (error) => events.push(error.message),
    },
    scheduler,
  );
  await settle();
  scheduler.flush();
  assert.deepEqual(events, ["measurement"]);
  assert.equal(scheduler.pending.size, 0);
});

test("dragging a group marks descendant routes manual without changing prior geometry; layout ignores drag", () => {
  const geometry = {
    nodes: [
      { id: "group", position: { x: 0, y: 0 }, data: {} },
      { id: "child", parentId: "group", position: { x: 10, y: 10 }, data: {} },
    ],
    edges: [{ id: "edge", source: "child", target: "other", data: {} }],
  };
  const changes = [{ type: "position", id: "group", position: { x: 50, y: 25 } }];
  assert.equal(moveGeometry(geometry, changes, true), geometry);
  const moved = moveGeometry(geometry, changes, false);
  assert.deepEqual(moved.nodes[0].position, { x: 50, y: 25 });
  assert.equal(moved.edges[0].data.manual, true);
  assert.equal(geometry.edges[0].data.manual, undefined);
  assert.deepEqual(geometry.nodes[0].position, { x: 0, y: 0 });
});

test("focus wrapping skips hidden controls and works in both directions without trapping ordinary focus", () => {
  const doc = { activeElement: null },
    focused = [];
  const control = (name, visible = true) => ({
    getClientRects: () => (visible ? [1] : []),
    focus: () => focused.push(name),
  });
  const first = control("first"),
    last = control("last"),
    hidden = control("hidden", false);
  const container = { ownerDocument: doc, querySelectorAll: () => [first, hidden, last] };
  const event = { key: "Tab", shiftKey: false, preventDefault: () => focused.push("prevent") };
  doc.activeElement = first;
  trapFocus(event, container);
  assert.deepEqual(focused, []);
  doc.activeElement = last;
  trapFocus(event, container);
  doc.activeElement = first;
  trapFocus({ ...event, shiftKey: true }, container);
  assert.deepEqual(focused, ["prevent", "first", "prevent", "last"]);
});

test("camera restoration preserves the anchor; narrow fitting uses one source and walking pans only enough", () => {
  const calls = [],
    flow = {
      fitView: (value) => calls.push(value),
      setViewport: (value) => calls.push(value),
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    };
  const result = {
    absolute: new Map([["anchor", { x: 20, y: 30 }]]),
    nodes: [{ id: "current", position: { x: 400, y: 20 }, width: 100, height: 80 }],
  };
  const viewport = { x: 5, y: 6, zoom: 2 };
  applyMapCamera(
    flow,
    { viewport, anchor: { id: "anchor", x: 10, y: 20 } },
    result,
    {},
    null,
    null,
    1440,
  );
  assert.deepEqual(calls.pop(), { x: -15, y: -14, zoom: 2 });
  assert.deepEqual(viewport, { x: 5, y: 6, zoom: 2 });
  applyMapCamera(flow, { fit: true, frameIds: ["one", "two"] }, result, {}, null, "folder", 390);
  assert.deepEqual(calls.pop().nodes, [{ id: "one" }]);
  applyWalkCamera(flow, {}, result, "current", { clientWidth: 400, clientHeight: 300 });
  assert.deepEqual(calls.pop(), { x: -130, y: 10, zoom: 1 });
});

test("manual self-loop paths and label origins share one routing calculation in both orientations", () => {
  const props = {
    source: "same",
    target: "same",
    sourceX: 100,
    sourceY: 120,
    targetX: 100,
    targetY: 20,
    data: { manual: true, vertical: true, selfWidth: 200, selfHeight: 100 },
  };
  assert.deepEqual(edgeRoute(props), manualRoute(props));
  assert.deepEqual(edgeRoute(props).labelPosition, { x: 230, y: 70 });
  const horizontal = { ...props, data: { ...props.data, vertical: false } };
  assert.deepEqual(edgeRoute(horizontal).labelPosition, { x: 100, y: 40 });
  const automatic = {
    ...props,
    data: {
      points: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      labelPosition: { x: 2, y: 3 },
    },
  };
  assert.deepEqual(edgeRoute(automatic), { path: "M1,2 L3,4", labelPosition: { x: 2, y: 3 } });
});
