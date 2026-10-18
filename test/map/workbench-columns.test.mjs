import test from "node:test";
import assert from "node:assert/strict";
import { matrixColumns, matrixColumnChoices } from "../../ui/workbench/matrix-columns.ts";
import { projectTemplates } from "../../src/core/project-templates.ts";
import { focusedNeighborhood, potentialPaths } from "../../ui/workbench/workspace-journeys.mjs";

test("Engineering columns use legal endpoints and stop at a terminal type; authored valid choices persist", () => {
  const schema = projectTemplates.engineering.schema;
  const steps = matrixColumns(schema, "requirement", [], 4);
  assert.deepEqual(steps, [
    { type: "mapped_to", targetType: "design" },
    { type: "tested_by", targetType: "test" },
  ]);
  assert.deepEqual(
    matrixColumns(schema, "requirement", [{ type: "mapped_to", targetType: "test" }], 4),
    [{ type: "mapped_to", targetType: "test" }],
  );
  assert.deepEqual(matrixColumns(schema, "test", steps, 2), []);
  assert.deepEqual(matrixColumnChoices(schema, "missing"), []);
  const openSchema = {
    entityTypes: { a: { fields: {} }, b: { fields: {} } },
    relationshipTypes: {
      any: { fields: {} },
      none: { fields: {}, source: [] },
      emptyTarget: { fields: {}, target: [] },
    },
  };
  assert.deepEqual(matrixColumnChoices(openSchema, "a"), [
    { type: "any", targetType: "a" },
    { type: "any", targetType: "b" },
  ]);
});

test("focus and impact retain every starter/custom recorded relationship kind with exact direction and bounds", () => {
  const records = ["REQ", "DESIGN", "TEST", "INTENT", "OTHER"].map((key) => ({
    id: key,
    key,
    fields: {},
    version: 1,
  }));
  const links = [
    { id: "mapping", type: "mapped_to", source: "REQ", target: "DESIGN" },
    { id: "testing", type: "tested_by", source: "DESIGN", target: "TEST" },
    { id: "contribution", type: "contributes_to", source: "REQ", target: "INTENT" },
    { id: "custom", type: "custom_dependency", source: "TEST", target: "OTHER" },
    { id: "cycle", type: "custom_dependency", source: "TEST", target: "REQ" },
  ];
  const revisions = [
    ...records.map((snapshot) => ({
      kind: "entity",
      id: snapshot.id,
      projectRevision: 1,
      snapshot,
    })),
    ...links.map((snapshot) => ({
      kind: "relationship",
      id: snapshot.id,
      projectRevision: 2,
      snapshot,
    })),
    {
      kind: "entity",
      id: "REQ",
      projectRevision: 3,
      snapshot: { ...records[0], version: 2, fields: { title: "Changed requirement" } },
    },
  ];
  const data = { revisions };
  const paths = potentialPaths(data, 3);
  assert.deepEqual(paths.keys, ["REQ", "DESIGN", "INTENT", "TEST"]);
  assert.deepEqual(
    paths.links.map((link) => link.id),
    ["mapping", "testing", "contribution", "cycle"],
  );
  assert.ok(potentialPaths(data, 3, 3).keys.includes("OTHER"));
  const model = { records: new Map(records.map((record) => [record.key, record])), links };
  assert.deepEqual(focusedNeighborhood(model, "REQ", { depth: 2 }).keys, paths.keys);
  assert.deepEqual(focusedNeighborhood(model, "TEST", { depth: 1, direction: "upstream" }).keys, [
    "TEST",
    "DESIGN",
  ]);
});
