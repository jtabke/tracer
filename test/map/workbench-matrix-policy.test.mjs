import test from "node:test";
import assert from "node:assert/strict";
import {
  gridDestination,
  gridRange,
  inRange,
  rowPath,
  startsCellEdit,
} from "../../ui/workbench/matrix-selection.ts";
import { editorPlacement } from "../../ui/workbench/matrix-placement.ts";
import { matrixProposal } from "../../ui/workbench/matrix-proposal.ts";
import { createDelayedSelection } from "../../ui/workbench/selection-delay.ts";

test("merged-cell navigation distinguishes rendered spans from logical range extension", () => {
  const options = {
    current: { row: 1, column: 0 },
    origin: { row: 0, column: 0 },
    span: 3,
    rows: 5,
    columns: 3,
    extend: false,
  };
  assert.deepEqual(gridDestination("ArrowDown", options), { row: 3, column: 0 });
  assert.deepEqual(gridDestination("ArrowDown", { ...options, extend: true }), {
    row: 2,
    column: 0,
  });
  assert.equal(gridDestination("ArrowUp", options), null);
  assert.deepEqual(gridDestination("Tab", { ...options, current: { row: 1, column: 2 } }), {
    row: 2,
    column: 0,
  });
  assert.deepEqual(gridDestination("Tab", { ...options, extend: true }), { row: 0, column: 2 });
  assert.equal(
    gridDestination("Tab", { ...options, current: { row: 0, column: 0 }, extend: true }),
    null,
  );
  assert.equal(gridDestination("ArrowRight", { ...options, current: { row: 1, column: 2 } }), null);
  assert.equal(gridDestination("Escape", options), null);
  assert.equal(startsCellEdit({ key: "A" }), true);
  for (const event of [
    { key: "/" },
    { key: " " },
    { key: "a", ctrlKey: true },
    { key: "あ", isComposing: true },
  ])
    assert.equal(startsCellEdit(event), false);
});
test("range membership includes intersecting merged cells and excludes adjacent columns", () => {
  const state = { matrixCell: { row: 2, column: 0 }, matrixAnchor: { row: 5, column: 2 } };
  assert.deepEqual(gridRange(state), { top: 2, bottom: 5, left: 0, right: 2 });
  assert.equal(inRange(state, 0, 0, 3), true);
  assert.equal(inRange(state, 0, 0, 2), false);
  assert.equal(inRange(state, 3, 3), false);
  assert.equal(gridRange({ ...state, matrixCell: null }), null);
});
test("grouped row paths deduplicate artifact identities while retaining parallel recorded links", () => {
  const row = {
    keys: ["A", "B", null],
    links: ["prefix", null],
    terminals: [
      { key: "T", linkId: "one" },
      { key: "T", linkId: "two" },
      { key: "B", linkId: "prefix" },
    ],
  };
  const before = structuredClone(row);
  assert.deepEqual(rowPath(row), { keys: ["A", "B", "T"], links: ["prefix", "one", "two"] });
  assert.deepEqual(row, before);
});
test("editor placement keeps narrow sheets and desktop popovers inside the viewport", () => {
  assert.deepEqual(
    editorPlacement({ left: 500, bottom: 800 }, { width: 680, height: 900 }, 300, false, true),
    { width: 648, maxHeight: 590, left: 16, top: 584 },
  );
  assert.deepEqual(
    editorPlacement({ left: 1400, bottom: 800 }, { width: 1440, height: 900 }, 300, false, false),
    { width: 410, maxHeight: 590, left: 1014, top: 584 },
  );
  assert.equal(
    editorPlacement({ left: 20, bottom: 100 }, { width: 680, height: 900 }, 100, true, false).width,
    350,
  );
});
const entity = (id, key, version = 1) => ({
  id,
  key,
  type: "item",
  version,
  fields: { title: key },
  title: key,
  statement: "statement",
});
function context() {
  return {
    model: {
      records: new Map([
        ["A", entity("source-now", "A", 99)],
        ["B", entity("target-now", "B", 99)],
      ]),
      links: [],
    },
    data: {
      schema: {
        id: "project",
        version: 1,
        entityTypes: {
          item: {
            fields: {
              title: { type: "string", required: true },
              statement: { type: "string", required: true },
            },
          },
        },
        relationshipTypes: {
          references: { fields: { scope: { type: "string", required: true } } },
        },
      },
    },
  };
}
function relationship() {
  return {
    kind: "relationship",
    row: 0,
    column: 1,
    mode: "add",
    id: "exact-link",
    schemaVersion: 1,
    sourceKey: "A",
    sourceId: "source-captured",
    sourceVersion: 3,
    type: "references",
    targetType: "item",
    targetKey: "B",
    targetId: "target-captured",
    targetVersion: 2,
    scope: " retained scope ",
    query: "",
    fields: { custom: "retained" },
  };
}
test("native proposals keep captured endpoint identities and versions instead of adopting fresh reads", () => {
  const current = context(),
    draft = relationship(),
    before = structuredClone({ current, draft });
  const result = matrixProposal(current, draft);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.operations, [
    {
      op: "relationship.create",
      id: "exact-link",
      input: {
        source: "source-captured",
        target: "target-captured",
        type: "references",
        fields: { custom: "retained", scope: "retained scope" },
      },
      rejectExisting: true,
      expectedEndpoints: { sourceVersion: 3, targetVersion: 2 },
    },
  ]);
  assert.deepEqual({ current, draft }, before);
});
test("replacement keeps the exact relationship/version and rejects duplicate proposals without changing the draft", () => {
  const current = context(),
    draft = { ...relationship(), mode: "replace", version: 7 };
  current.model.links.push({ id: "exact-link", source: "A", target: "B", type: "references" });
  const result = matrixProposal(current, draft);
  assert.equal(result.operations[0].op, "relationship.update");
  assert.equal(result.operations[0].id, "exact-link");
  assert.equal(result.operations[0].expectedVersion, 7);
  current.model.links.push({ id: "parallel", source: "A", target: "B", type: "references" });
  const before = structuredClone(draft),
    invalid = matrixProposal(current, draft);
  assert.equal(invalid.status, "invalid");
  assert.match(invalid.error, /already linked/);
  assert.deepEqual(draft, before);
});
test("new-target creation is one atomic proposal and incomplete required fields produce no operations", () => {
  const current = context(),
    draft = {
      ...relationship(),
      create: true,
      newId: "new-target",
      targetId: null,
      targetVersion: null,
      key: "C",
      title: " Created ",
      statement: " required statement ",
    };
  const result = matrixProposal(current, draft);
  assert.equal(result.status, "ready");
  assert.equal(result.operations.length, 2);
  assert.deepEqual(result.operations[0], {
    op: "entity.create",
    id: "new-target",
    input: {
      type: "item",
      key: "C",
      fields: { title: "Created", statement: "required statement" },
    },
  });
  assert.equal(result.operations[1].input.target, "new-target");
  assert.equal(result.operations[1].expectedEndpoints.targetVersion, 1);
  assert.equal(matrixProposal(current, { ...draft, statement: "" }).status, "invalid");
});
test("artifact edits retain captured fields/version and schema-specific relationship defaults are explicit", () => {
  const current = context(),
    draft = {
      kind: "artifact",
      row: 0,
      column: 0,
      id: "old-artifact",
      version: 4,
      schemaVersion: 1,
      key: "A",
      title: " Updated ",
      statement: " changed ",
      fields: { custom: { retained: true } },
    };
  const result = matrixProposal(current, draft);
  assert.deepEqual(result.operations, [
    {
      op: "entity.update",
      id: "old-artifact",
      expectedVersion: 4,
      input: { fields: { custom: { retained: true }, title: "Updated", statement: "changed" } },
    },
  ]);
  assert.equal(matrixProposal(current, { ...draft, title: "" }).status, "invalid");
  Object.assign(current.data.schema.relationshipTypes.references.fields, {
    source_version: { type: "number" },
    review: { type: "string" },
  });
  const link = matrixProposal(current, relationship()).operations[0];
  assert.equal(link.input.fields.source_version, 3);
  assert.equal(link.input.fields.review, "Not reviewed");
});
test("Matrix selection refreshes coalesce by logical cell and cannot run after disposal", () => {
  const callbacks = [],
    calls = [];
  const delayed = createDelayedSelection(
    (cell) => calls.push(cell),
    {
      set: (callback, delay) => (
        assert.equal(delay, 180),
        callbacks.push(callback),
        callbacks.length - 1
      ),
      clear: () => {},
    },
    180,
  );
  delayed.defer({ row: 1, column: 0 });
  delayed.defer({ row: 2, column: 1 });
  callbacks[0]();
  assert.deepEqual(calls, []);
  delayed.clear();
  callbacks[1]();
  assert.deepEqual(calls, []);
  delayed.defer({ row: 3, column: 2 });
  callbacks[2]();
  assert.deepEqual(calls, [{ row: 3, column: 2 }]);
});
