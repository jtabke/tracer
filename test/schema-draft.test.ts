import { test } from "node:test";
import assert from "node:assert/strict";
import {
  captureDraft,
  endpointMode,
  endpointSummary,
  nativeDraft,
  parseDraft,
  pendingChanges,
  rootExtensions,
} from "../ui/schema-draft.ts";

test("native schema draft preserves omitted/empty constraints and duplicate endpoints", () => {
  const native = parseDraft(
    JSON.stringify({
      entityTypes: {
        note: {
          fields: { text: { type: "string", required: false } },
        },
      },
      relationshipTypes: {
        open: { fields: {} },
        none: { fields: {}, source: [] },
        several: { fields: {}, target: ["note", "note"] },
      },
    }),
  );
  const draft = nativeDraft(native);
  assert.deepEqual(draft, native);
  assert.notEqual(draft, native);
  assert.deepEqual(pendingChanges(native, draft), []);
  assert.deepEqual(rootExtensions(draft), []);
  assert.equal(endpointSummary(undefined, "source"), "Any configured type");
  assert.equal(endpointSummary([], "target"), "No target types allowed");
  assert.equal(endpointSummary(["note", "note"], "source"), "One of: note, note");
  assert.throws(() => parseDraft("{invalid"));
  assert.throws(() => parseDraft('{"entityTypes":{}}'));
});

test("pending changes distinguish additions, changed definitions, removals and root changes", () => {
  const base = parseDraft('{"entityTypes":{"note":{"fields":{}}},"relationshipTypes":{}}');
  const draft = nativeDraft(base);
  draft.entityTypes.note.fields.text = { type: "string" };
  draft.relationshipTypes.ref = { fields: {}, source: [] };
  assert.deepEqual(pendingChanges(base, draft), [
    "note: changed field text",
    "Add relationship: ref",
  ]);
  delete draft.entityTypes.note;
  assert.ok(pendingChanges(base, draft).includes("Remove type: note"));
  assert.deepEqual(pendingChanges(base, { ...base, extra: true } as typeof base), [
    "Change native schema properties",
  ]);
});

test("capture keeps original version and endpoint choice distinguishes selected zero from Any", () => {
  assert.deepEqual(captureDraft(null), {
    base: { entityTypes: {}, relationshipTypes: {} },
    version: 0,
  });
  assert.equal(endpointMode(undefined, true), "any");
  assert.equal(endpointMode([], false), "none");
  assert.equal(endpointMode([], true), "selected");
  assert.equal(endpointMode(["note"], false), "selected");
  const captured = captureDraft({
    id: "project",
    version: 9,
    entityTypes: {},
    relationshipTypes: {},
  });
  assert.equal(captured.version, 9);
  assert.deepEqual(captured.base, { entityTypes: {}, relationshipTypes: {} });
});
