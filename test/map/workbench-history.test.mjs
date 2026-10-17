import test from "node:test";
import assert from "node:assert/strict";
import { snapshotAt, diffAt } from "../../ui/workbench/workspace-history.ts";

const record = (key, fields = {}) => ({ id: key, key, type: "requirement", fields });
const entry = (kind, id, projectRevision, snapshot) => ({ kind, id, projectRevision, snapshot });
test("historical projection preserves deletion, recreation and separate entity/link identities", () => {
  const original = record("A", { statement: "original" });
  const recreated = record("A", { statement: "recreated" });
  const link = { id: "shared", source: "A", target: "B", fields: {} };
  const data = {
    revisions: [
      entry("entity", "shared", 1, original),
      entry("relationship", "shared", 2, link),
      entry("entity", "shared", 3, null),
      entry("entity", "shared", 4, recreated),
    ],
  };
  const unchanged = structuredClone(data);
  assert.equal(snapshotAt(data, 2).records.get("A"), original);
  assert.equal(snapshotAt(data, 3).records.size, 0);
  assert.deepEqual(snapshotAt(data, 3).links, [link]);
  assert.equal(snapshotAt(data, 4).records.get("A"), recreated);
  assert.equal(diffAt(data, 4)[0].before, null);
  assert.deepEqual(data, unchanged);
});
test("one changeset compares every object with the preceding revision and retains endpoint order", () => {
  const original = {
    id: "r",
    type: "verifies",
    source: "A",
    target: "B",
    fields: { scope: "old" },
  };
  const next = {
    ...original,
    type: "references",
    source: "C",
    target: "D",
    fields: { scope: "new" },
  };
  const data = {
    revisions: [
      entry("entity", "r", 1, record("r")),
      entry("relationship", "r", 2, original),
      entry("entity", "r", 3, record("r", { statement: "changed" })),
      entry("relationship", "r", 3, next),
      entry("relationship", "r", 4, null),
    ],
  };
  const changes = diffAt(data, 3);
  assert.equal(changes[1].before, original);
  assert.deepEqual(
    changes[1].fields.map((value) => value.key),
    ["target", "type", "source", "scope"],
  );
  assert.equal(diffAt(data, 4)[0].after, null);
  assert.deepEqual(diffAt(data, 4)[0].fields, [{ key: "scope", before: "new", after: undefined }]);
  assert.deepEqual(diffAt(data, 99), []);
});
