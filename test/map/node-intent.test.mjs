import test from "node:test";
import assert from "node:assert/strict";
import { selectNode, activateNode } from "../../ui/map/node-intent.ts";
const item = { id: "shared-record", data: { kind: "item", type: "requirement" } };
const root = { focus: null, folderScope: null };
const projection = { nodes: [{ id: "parent", groupKey: "folder:review" }], rootIds: [item.id] };
test("map selection follows native identity and reveals context without replacing an active trace", () => {
  assert.deepEqual(selectNode(item, root, projection), {
    kind: "trace",
    id: item.id,
    fromClick: true,
  });
  assert.deepEqual(selectNode(item, { ...root, focus: "other" }, projection), {
    kind: "reveal",
    id: item.id,
  });
  assert.deepEqual(selectNode(item, { ...root, folderScope: "folder:review" }, projection), {
    kind: "trace",
    id: item.id,
    fromClick: true,
  });
  assert.deepEqual(
    selectNode(item, { ...root, folderScope: "folder:other" }, { ...projection, rootIds: [] }),
    { kind: "reveal", id: item.id },
  );
});
test("summarized records select their owning folder; malformed remainders cannot select missing identities", () => {
  const remainder = {
    id: "remainder",
    parentId: "parent",
    data: { kind: "remainder", type: "requirement" },
  };
  assert.deepEqual(selectNode(remainder, root, projection), {
    kind: "select",
    selection: { kind: "group", id: "parent", type: "requirement", groupKey: "folder:review" },
  });
  assert.deepEqual(selectNode({ ...remainder, parentId: undefined }, root, projection), {
    kind: "none",
  });
  const group = { id: "group:requirement", data: { kind: "group", type: "requirement" } };
  assert.deepEqual(selectNode(group, root, projection), {
    kind: "select",
    selection: { kind: "group", id: group.id, type: "requirement", groupKey: "requirement" },
  });
});
test("activation expands local groups while boundary groups and active traces keep their owners", () => {
  const group = {
    id: "folder",
    data: { kind: "group", type: "requirement", groupKey: "folder:review" },
  };
  assert.deepEqual(activateNode(group, root), { kind: "toggle", id: "folder:review" });
  assert.deepEqual(activateNode({ ...group, data: { ...group.data, external: true } }, root), {
    kind: "none",
  });
  assert.deepEqual(activateNode(item, root), { kind: "trace", id: item.id, fromClick: false });
  assert.deepEqual(activateNode(item, { ...root, focus: item.id }), { kind: "none" });
  assert.deepEqual(activateNode(item, { ...root, folderScope: "folder:review" }), { kind: "none" });
});
