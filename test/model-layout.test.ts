import test from "node:test";
import assert from "node:assert/strict";
import { modelLayout, routeGeometry } from "../ui/model-layout.ts";
import { projectTemplates } from "../src/core/project-templates.ts";
import type { Schema } from "../src/core/model.ts";

test("engineering constellation follows declared direction and alternate destinations", () => {
  const layout = modelLayout(projectTemplates.engineering.schema, "");
  assert.equal(layout.nodes[0].name, "requirement");
  assert.deepEqual(
    layout.routes.map(({ name, source, target }) => [source.name, name, target.name]),
    [
      ["requirement", "contributes_to", "intent"],
      ["requirement", "mapped_to", "design"],
      ["requirement", "mapped_to", "test"],
      ["design", "tested_by", "test"],
    ],
  );
  for (const [index, route] of layout.routes.entries()) {
    const geometry = routeGeometry(route, index);
    assert.ok(!geometry.path.includes("NaN"));
    assert.ok(Number.isFinite(geometry.x) && Number.isFinite(geometry.y));
  }
});

test("Any and None are not expanded into invented type connections; self loops are explicit", () => {
  const schema: Schema = {
    entityTypes: { alpha: { fields: {} } },
    relationshipTypes: {
      any: { fields: {} },
      none: { fields: {}, source: [], target: ["alpha"] },
      self: { fields: {}, source: ["alpha"], target: ["alpha"] },
    },
  };
  const layout = modelLayout(schema, "alpha");
  assert.equal(layout.routes.length, 1);
  assert.equal(layout.routes[0].name, "self");
  assert.match(routeGeometry(layout.routes[0], 0).path, / C /);
  assert.deepEqual(modelLayout({ entityTypes: {}, relationshipTypes: {} }, ""), {
    nodes: [],
    routes: [],
    omittedTypes: 0,
    omittedRoutes: 0,
  });
});

test("dense models bound nodes and paths, disclose omissions and allow any type as focus", () => {
  const names = Array.from({ length: 30 }, (_, index) => `type-${index}`);
  const schema: Schema = {
    entityTypes: Object.fromEntries(names.map((name) => [name, { fields: {} }])),
    relationshipTypes: { all: { fields: {}, source: names, target: names } },
  };
  const layout = modelLayout(schema, "type-29");
  assert.equal(layout.nodes[0].name, "type-29");
  assert.equal(layout.nodes.length, 9);
  assert.equal(layout.omittedTypes, 21);
  assert.equal(layout.routes.length, 24);
  assert.equal(layout.omittedRoutes, 57);
  assert.equal(modelLayout(schema, "removed-type").nodes[0].name, "type-0");
});
