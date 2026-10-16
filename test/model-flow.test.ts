import test from "node:test";
import assert from "node:assert/strict";
import { modelFlow, overviewRoutes, flowPath, routeActive, focusFlow } from "../ui/model-flow.ts";
import type { Schema } from "../src/core/model.ts";

const schema: Schema = {
  entityTypes: {
    intent: { fields: {} },
    requirement: { fields: {} },
    design: { fields: {} },
    evidence: { fields: {} },
    isolated: { fields: {} },
  },
  relationshipTypes: {
    defines: { fields: {}, source: ["intent"], target: ["requirement"] },
    realized_by: { fields: {}, source: ["requirement"], target: ["design"] },
    checked_by: { fields: {}, source: ["requirement", "design"], target: ["evidence"] },
    revises: { fields: {}, source: ["evidence"], target: ["requirement"] },
    depends_on: { fields: {}, source: ["design"], target: ["design"] },
    any: { fields: {} },
    none: { fields: {}, source: [], target: ["design"] },
  },
};

test("visual workflow preserves forward links, alternatives and feedback without inventing Any/None pairs", () => {
  const flow = modelFlow(schema);
  assert.equal(flow.nodes.length, 5);
  assert.equal(flow.routes.length, 6);
  assert.deepEqual(
    flow.routes.filter((route) => route.name === "checked_by").map((route) => route.source.name),
    ["requirement", "design"],
  );
  const overview = overviewRoutes(flow.routes, flow.nodes);
  assert.deepEqual(
    new Set(overview.map((route) => route.name)),
    new Set(["defines", "realized_by", "checked_by", "revises", "depends_on"]),
  );
  assert.equal(new Set(overview.map((route) => route.key)).size, overview.length);
  assert.ok(overview.every((route) => flow.routes.includes(route)));
  assert.ok(!overview.some((route) => route.target.name === "isolated"));
  for (const [index, route] of flow.routes.entries())
    assert.ok(!flowPath(route, index).includes("NaN"));
  assert.match(
    flowPath(
      flow.routes.find((route) => route.name === "depends_on")!,
      0,
    ),
    / C /,
  );
  assert.equal(flow.routes.filter((route) => routeActive(route, "evidence", "")).length, 3);
  assert.equal(flow.routes.filter((route) => routeActive(route, "", "checked_by")).length, 2);
  assert.equal(modelFlow({ entityTypes: {}, relationshipTypes: {} }).routes.length, 0);
  const focused = focusFlow(flow, "requirement");
  assert.equal(focused.nodes.length, 4);
  assert.equal(new Set(focused.nodes.map((node) => node.name)).size, focused.nodes.length);
  assert.ok(!focused.nodes.some((node) => node.name === "isolated"));
  assert.equal(focused.routes.find((route) => route.name === "defines")?.target.x, 408);
  assert.equal(focused.routes.find((route) => route.name === "realized_by")?.source.x, 408);
});
