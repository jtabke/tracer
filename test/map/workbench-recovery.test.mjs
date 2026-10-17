import test from "node:test";
import assert from "node:assert/strict";
import { createRecovery } from "../../ui/workbench/recovery.ts";
const memory = () => {
  const entries = new Map();
  return {
    entries,
    getItem: (key) => entries.get(key),
    setItem: (key, value) => entries.set(key, value),
  };
};
const context = () => ({
  selected: "REQ",
  perspective: "graph",
  revision: 4,
  visible: new Set(["REQ", "RUN"]),
  pathLinkIds: new Set(["link"]),
  investigation: { event: 4, revision: 4, subject: { key: "REQ" } },
  camera: { zoom: 0.8, x: 30, y: 40 },
  matrixSteps: [{ type: "depends_on", targetType: "item" }],
  layout: new Map([["REQ", { x: 210, y: 190 }]]),
  drafts: new Map([["REQ", { statement: "Unsaved", expectedVersion: 1 }]]),
  evidenceDirty: true,
  evidenceToken: "must-not-persist",
  saving: true,
});
test("recovery retains exact investigation and positions without serializing drafts or save proposals", () => {
  const storage = memory(),
    recovery = createRecovery(storage, "project-a"),
    original = context();
  assert.equal(recovery.save(original, 4, true, true), true);
  const raw = [...storage.entries.values()][0];
  assert.ok(
    !raw.includes("Unsaved") &&
      !raw.includes("must-not-persist") &&
      !raw.includes("expectedVersion"),
  );
  const reopened = context();
  reopened.drafts.clear();
  reopened.camera.x = 0;
  const restored = recovery.restore(reopened, 5);
  assert.equal(restored.drafts, true);
  assert.equal(restored.uncertain, true);
  assert.equal(reopened.revision, 5);
  assert.deepEqual(reopened.investigation, original.investigation);
  assert.deepEqual(reopened.pathLinkIds, original.pathLinkIds);
  assert.deepEqual(reopened.layout, original.layout);
  assert.deepEqual(reopened.camera, original.camera);
  assert.equal(reopened.drafts.size, 0);
});
test("historical scope stays historical and recovery never crosses project identities or a restored older database", () => {
  const storage = memory(),
    recovery = createRecovery(storage, "project-a"),
    state = context();
  recovery.save(state, 6, false, false);
  const reopened = context();
  recovery.restore(reopened, 7);
  assert.equal(reopened.revision, 4);
  assert.equal(createRecovery(storage, "project-b").restore(context(), 7), null);
  assert.equal(recovery.restore(context(), 3), null);
});
test("unavailable or malformed browser storage leaves the default scope intact", () => {
  const unavailable = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("quota");
    },
  };
  assert.equal(createRecovery(unavailable, "a").restore(context(), 4), null);
  assert.equal(createRecovery(unavailable, "a").save(context(), 4, false, false), false);
  const storage = memory(),
    recovery = createRecovery(storage, "a");
  recovery.save(context(), 4, false, false);
  const [key, raw] = [...storage.entries][0],
    corrupt = JSON.parse(raw);
  corrupt.context.visible = ["REQ"];
  storage.setItem(key, JSON.stringify(corrupt));
  const target = context();
  assert.equal(recovery.restore(target, 4), null);
  assert.ok(target.visible instanceof Set);
});
