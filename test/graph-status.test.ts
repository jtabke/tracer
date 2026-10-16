import test from "node:test";
import assert from "node:assert/strict";
import type { Graph } from "../src/application/views.ts";
import { nodeStatus } from "./legacy-ui/components/graph-status.ts";

const entity = { id: "output", type: "item", version: 1, fields: {} };
const schema: Graph["schema"] = {
  id: "project",
  version: 1,
  entityTypes: { item: { fields: {} } },
  relationshipTypes: {},
};
function graph(): Graph {
  return {
    schema,
    rootId: entity.id,
    expanded: [],
    nodes: [entity],
    links: [],
    external: [],
    evaluations: [
      {
        receipt: {
          id: "receipt",
          at: "then",
          actor: "test",
          outcome: "Recorded",
          output: entity,
          schema,
          inputs: [],
        },
        comparison: {
          receiptId: "receipt",
          token: "captured-token",
          state: "current",
          hasChanged: false,
          hasUnknown: false,
          inputs: [],
          review: { state: "unreviewed" },
          supersededBy: [],
        },
      },
    ],
  };
}

test("graph node status prioritizes unknown inputs, then changed, without inferring acceptance", () => {
  const value = graph();
  const comparison = value.evaluations[0].comparison;
  assert.deepEqual(nodeStatus(value, entity.id), { state: "current", text: "Inputs current" });
  comparison.state = "changed";
  assert.deepEqual(nodeStatus(value, entity.id), { state: "changed", text: "Inputs changed" });
  comparison.review = { state: "accepted" };
  assert.deepEqual(nodeStatus(value, entity.id), {
    state: "changed",
    text: "Input drift · accepted",
  });
  value.external.push({
    identity: {
      id: entity.id,
      system: "file",
      externalId: "stable",
      ownership: "external",
      actor: "test",
      at: "then",
    },
    observation: null,
  });
  assert.deepEqual(nodeStatus(value, entity.id), { state: "unknown", text: "Unknown input" });
  comparison.supersededBy = ["replacement"];
  value.external = [];
  assert.deepEqual(nodeStatus(value, entity.id), { state: "connected", text: "Connected" });
  assert.deepEqual(nodeStatus(value, "unrelated"), { state: "connected", text: "Connected" });
});

test("graph node status includes declared input state without treating an accepted output as an accepted input", () => {
  const value = graph();
  value.evaluations[0].comparison.review = { state: "accepted" };
  value.evaluations[0].comparison.inputs.push({
    entityId: "input",
    state: "changed",
    hasChanged: true,
    hasUnknown: false,
    reasons: ["Native version changed"],
    dependencyPath: [entity.id, "input"],
    recorded: { entityId: "input", entity: { ...entity, id: "input" }, links: [] },
    current: { entity: { ...entity, id: "input", version: 2 }, observation: null, links: [] },
  });
  assert.deepEqual(nodeStatus(value, "input"), { state: "changed", text: "Inputs changed" });
  value.evaluations[0].comparison.inputs[0].state = "unknown";
  assert.deepEqual(nodeStatus(value, "input"), { state: "unknown", text: "Unknown input" });
});

test("native graph status ignores live receipt freshness and reports native delta or snapshot only", () => {
  const value = graph();
  value.evaluations[0].comparison.state = "unknown";
  value.temporal = {
    at: { id: "changeset", projectRevision: 2, schemaVersion: 1, at: "then", actor: "test" },
  };
  assert.deepEqual(nodeStatus(value, entity.id), { state: "snapshot", text: "Native snapshot" });
  value.differences = {
    nodes: [{ id: entity.id, state: "removed", before: entity, after: null }],
    links: [],
  };
  assert.deepEqual(nodeStatus(value, entity.id), { state: "removed", text: "Removed" });
});
