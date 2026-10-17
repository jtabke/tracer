import test from "node:test";
import assert from "node:assert/strict";
import { allowedTypes } from "../../ui/workbench/relationship-policy.ts";
import { significantEvents } from "../../ui/workbench/workspace-history.ts";
test("workbench honors unrestricted, one-sided and explicit directed relationship permissions", () => {
  const schema = {
    relationshipTypes: {
      reference: {},
      input: { target: ["requirement"] },
      output: { source: ["test"] },
      evaluates: { source: ["test"], target: ["requirement"] },
      forbidden: { source: ["design"] },
    },
  };
  assert.deepEqual(allowedTypes(schema, { type: "test" }, { type: "requirement" }), [
    "reference",
    "input",
    "output",
    "evaluates",
  ]);
  assert.deepEqual(allowedTypes(schema, { type: "requirement" }, { type: "test" }), ["reference"]);
  assert.deepEqual(allowedTypes(schema, undefined, { type: "test" }), []);
});

test("selected history includes both recorded directions and excludes unrelated artifacts", () => {
  const entry = (kind, projectRevision, snapshot, version = 1) => ({
    kind,
    projectRevision,
    snapshot,
    version,
  });
  const data = {
    revisions: [
      entry("entity", 2, { key: "A" }),
      entry("entity", 3, { key: "B" }),
      entry("relationship", 4, { source: "A", target: "B" }),
      entry("relationship", 5, { source: "C", target: "A" }),
      entry("relationship", 6, { source: "B", target: "C" }),
      entry("entity", 7, { key: "A" }, 2),
      entry("entity", 8, null, 2),
    ],
    changesets: [{ projectRevision: 7, reason: "Revised operating limit" }],
  };
  const events = significantEvents(data, "A");
  assert.deepEqual(
    events.map((event) => event.revision),
    [2, 5, 7],
  );
  assert.equal(events[1].title, "2 connections recorded");
  assert.equal(events[2].detail, "Revised operating limit");
  assert.equal(significantEvents(data, "missing").length, 0);
});
