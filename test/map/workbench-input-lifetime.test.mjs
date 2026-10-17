import test from "node:test";
import assert from "node:assert/strict";
import { createDelayedSelection } from "../../ui/workbench/selection-delay.ts";
import { listenWorkbenchEvents } from "../../ui/workbench/workspace-events.ts";

test("replaced and cancelled pointer selections cannot fire after the scope changes", () => {
  const callbacks = [],
    cleared = [],
    selected = [];
  const selection = createDelayedSelection((key) => selected.push(key), {
    set: (callback) => (callbacks.push(callback), callbacks.length - 1),
    clear: (id) => cleared.push(id),
  });
  selection.defer("A");
  selection.defer("B");
  callbacks[0]();
  assert.deepEqual(selected, []);
  selection.flush();
  assert.deepEqual(selected, ["B"]);
  callbacks[1]();
  assert.deepEqual(selected, ["B"]);
  selection.defer("C");
  selection.clear();
  callbacks[2]();
  assert.deepEqual(selected, ["B"]);
  assert.ok(cleared.includes(0));
  selection.defer("D");
  callbacks[3]();
  assert.deepEqual(selected, ["B", "D"]);
});
class FrameTarget extends EventTarget {
  frames = new Map();
  next = 0;
  cancelled = [];
  requestAnimationFrame(callback) {
    this.frames.set(++this.next, callback);
    return this.next;
  }
  cancelAnimationFrame(id) {
    this.cancelled.push(id);
    this.frames.delete(id);
  }
  flush() {
    const work = [...this.frames.values()];
    this.frames.clear();
    for (const callback of work) callback();
  }
}
const transition = (type, persisted) => Object.assign(new Event(type), { persisted });
test("page suspension cancels input and resize work; cached return restores one listener lifetime", () => {
  const doc = new EventTarget(),
    target = new FrameTarget();
  let keys = 0,
    resizes = 0,
    suspends = 0,
    resumes = 0;
  const stop = listenWorkbenchEvents(
    {
      keydown: () => keys++,
      resize: () => resizes++,
      suspend: () => suspends++,
      resume: () => resumes++,
    },
    doc,
    target,
  );
  doc.dispatchEvent(new Event("keydown"));
  assert.equal(keys, 1);
  target.dispatchEvent(new Event("resize"));
  target.dispatchEvent(new Event("resize"));
  assert.equal(target.frames.size, 1);
  target.flush();
  assert.equal(resizes, 1);
  target.dispatchEvent(new Event("resize"));
  const late = [...target.frames.values()][0];
  target.dispatchEvent(transition("pagehide", true));
  late();
  target.flush();
  doc.dispatchEvent(new Event("keydown"));
  assert.equal(keys, 1);
  assert.equal(resizes, 1);
  assert.equal(suspends, 1);
  target.dispatchEvent(transition("pageshow", true));
  doc.dispatchEvent(new Event("keydown"));
  assert.equal(keys, 2);
  assert.equal(resumes, 1);
  target.dispatchEvent(new Event("resize"));
  target.flush();
  assert.equal(resizes, 2);
  stop();
  stop();
  target.dispatchEvent(transition("pageshow", true));
  doc.dispatchEvent(new Event("keydown"));
  target.dispatchEvent(new Event("resize"));
  target.flush();
  assert.equal(keys, 2);
  assert.equal(resizes, 2);
  assert.equal(resumes, 1);
});
test("normal page exit disposes the global lifecycle instead of allowing a later resume", () => {
  const doc = new EventTarget(),
    target = new FrameTarget();
  let resumed = 0;
  listenWorkbenchEvents(
    {
      keydown: () => assert.fail("disposed listener"),
      resize: () => assert.fail("disposed frame"),
      suspend: () => {},
      resume: () => resumed++,
    },
    doc,
    target,
  );
  target.dispatchEvent(transition("pagehide", false));
  target.dispatchEvent(transition("pageshow", true));
  doc.dispatchEvent(new Event("keydown"));
  assert.equal(resumed, 0);
});
