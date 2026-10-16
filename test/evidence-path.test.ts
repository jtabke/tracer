import { test } from "node:test";
import assert from "node:assert/strict";
import type { Entity } from "../src/core/model.ts";
import type { InputComparison } from "../src/core/evidence.ts";
import { recordedDependencyPath } from "../ui/evidence-path.ts";

const output: Entity = { id: "output-id", type: "test", key: "TEST-1", version: 2, fields: {} };
const input: Entity = { id: "input-id", type: "requirement", key: "REQ-1", version: 3, fields: {} };
const comparison: InputComparison = {
  entityId: input.id,
  dependencyPath: [output.id, input.id],
  state: "changed",
  hasChanged: true,
  hasUnknown: false,
  reasons: [],
  recorded: { entityId: input.id, entity: input, links: [] },
  current: { entity: { ...input, key: "RENAMED", version: 4 }, observation: null, links: [] },
};
test("recorded dependency path names captured endpoints, never current revisions", () => {
  assert.equal(
    recordedDependencyPath(comparison, output),
    "TEST-1 · recorded v2 → REQ-1 · recorded v3",
  );
  assert.equal(
    recordedDependencyPath(
      { ...comparison, dependencyPath: [output.id, "unknown-intermediate", input.id] },
      output,
    ),
    "TEST-1 · recorded v2 → unknown-intermediate → REQ-1 · recorded v3",
  );
});
test("recorded dependency path uses captured title when a key is absent", () => {
  assert.equal(
    recordedDependencyPath(
      {
        ...comparison,
        recorded: {
          ...comparison.recorded,
          entity: { ...input, key: undefined, fields: { title: "Original intent" } },
        },
      },
      output,
    ),
    "TEST-1 · recorded v2 → Original intent · recorded v3",
  );
});
