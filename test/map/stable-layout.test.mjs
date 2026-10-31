import { presets } from "./scale-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stableLayout } from "../../ui/map/stable-layout.ts";
import { layoutProjection } from "../../ui/map/layout.ts";
import {
  directoryProjection,
  fixtureOrganization as studyOrganization,
  folderKey,
} from "./fixtures/organization.mjs";
import { indexFixture } from "../../ui/map/model.ts";
import { readableLabels } from "../../ui/map/connection-labels.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/fixture.json", import.meta.url)));
const index = indexFixture(fixture),
  organization = studyOrganization(fixture);
const options = {
  types: presets.requirements,
  relations: Object.keys(fixture.schema.relationshipTypes),
  organization,
  expanded: [],
  pages: {},
};
const byId = (layout, id) => layout.nodes.find((node) => node.id === id);

test("connection captions avoid record cards, group controls and each other without moving nodes", () => {
  const nodes = [
    {
      id: "group",
      position: { x: 100, y: 100 },
      width: 500,
      height: 300,
      data: { open: true, organization: true },
    },
    { id: "item", parentId: "group", position: { x: 18, y: 76 }, width: 220, height: 82, data: {} },
  ];
  const before = structuredClone(nodes);
  const edges = [0, 1, 2].map((i) => ({
    id: `edge:${i}`,
    source: "item",
    target: "group",
    label: "verified by",
    data: { showLabel: true, labelPosition: { x: 228, y: 195 } },
  }));
  const captions = readableLabels(nodes, edges, true);
  const rectangles = [
    { x: 100, y: 100, width: 500, height: 76 },
    { x: 118, y: 176, width: 220, height: 82 },
  ];
  for (const edge of edges) {
    const { position, origin } = captions.get(edge.id);
    assert.deepEqual(origin, { x: 228, y: 195 });
    const width = edge.label.length * 6.3 + 100;
    const box = { x: position.x - width / 2, y: position.y - 13, width, height: 26 };
    for (const other of rectangles)
      assert.ok(
        box.x + box.width <= other.x ||
          other.x + other.width <= box.x ||
          box.y + box.height <= other.y ||
          other.y + other.height <= box.y,
      );
    rectangles.push(box);
  }
  assert.deepEqual(nodes, before);
  assert.deepEqual(readableLabels(nodes, edges, true), captions);
  const self = [
    {
      id: "self",
      source: "item",
      target: "item",
      label: "depends on",
      data: { showLabel: true, manual: true },
    },
  ];
  assert.deepEqual(readableLabels(nodes, self, true).get("self").origin, { x: 368, y: 217 });
  assert.deepEqual(readableLabels(nodes, self, false).get("self").origin, { x: 228, y: 146 });
});
function disjointSiblings(layout) {
  for (const a of layout.nodes)
    for (const b of layout.nodes) {
      if (a.id >= b.id || a.parentId !== b.parentId) continue;
      assert.ok(
        a.position.x + a.width <= b.position.x ||
          b.position.x + b.width <= a.position.x ||
          a.position.y + a.height <= b.position.y ||
          b.position.y + b.height <= a.position.y,
        `${a.id} overlaps ${b.id}`,
      );
    }
}

for (const direction of ["DOWN", "RIGHT"]) {
  test(`local nested expansion keeps anchors, noncolliding branches and exact native links (${direction})`, async () => {
    const display = { direction };
    const initial = await layoutProjection(directoryProjection(index, options), display);
    let current = initial;
    const keys = [
      "product_requirement",
      folderKey("product_requirement", ["Measurement"]),
      folderKey("product_requirement", ["Measurement", "Acquisition"]),
    ];
    for (let i = 0; i < keys.length; i++) {
      const graph = directoryProjection(index, { ...options, expanded: keys.slice(0, i + 1) });
      const anchor = i ? keys[i] : "group:product_requirement";
      const next = stableLayout(graph, display, current, anchor);
      assert.deepEqual(next.absolute.get(anchor), current.absolute.get(anchor));
      assert.deepEqual(
        next.absolute.get("group:user_need"),
        initial.absolute.get("group:user_need"),
      );
      assert.deepEqual(
        next.edges.flatMap((edge) => edge.linkIds).sort(),
        graph.edges.flatMap((edge) => edge.linkIds).sort(),
      );
      for (const node of next.nodes) {
        assert.ok(Number.isFinite(node.position.x) && Number.isFinite(node.position.y));
        if (node.parentId) {
          const parent = byId(next, node.parentId);
          assert.ok(node.position.x >= 0 && node.position.y >= 0);
          assert.ok(node.position.x + node.width <= parent.width);
          assert.ok(node.position.y + node.height <= parent.height);
        }
      }
      disjointSiblings(next);
      current = next;
    }
    const collapsed = stableLayout(directoryProjection(index, options), display, current);
    for (const node of collapsed.nodes)
      assert.deepEqual(
        node.position,
        byId(current, node.id).position,
        "Collapse leaves surrounding positions alone; Arrange can close gaps",
      );
  });
}

test("only colliding siblings move, and manually positioned distant branches stay put", () => {
  const definitions = ["a", "b", "c"].map((id) => ({ id, kind: "group", organization: true }));
  const previous = {
    nodes: definitions.map((data, i) => ({
      id: data.id,
      data,
      position: { x: i === 2 ? 1500 : 0, y: i * 150 },
      width: 248,
      height: 100,
    })),
    edges: [],
  };
  const graph = {
    nodes: [
      { ...definitions[0], open: true },
      { id: "item", kind: "item", parentId: "a" },
      ...definitions.slice(1),
    ],
    edges: [],
  };
  const expanded = stableLayout(graph, { direction: "DOWN" }, previous, "a");
  assert.deepEqual(byId(expanded, "a").position, byId(previous, "a").position);
  assert.ok(byId(expanded, "b").position.y > byId(previous, "b").position.y);
  assert.deepEqual(byId(expanded, "c").position, byId(previous, "c").position);
  disjointSiblings(expanded);
});

test("paging reuses vacated record slots and filtering links preserves node geometry", async () => {
  const display = { direction: "DOWN" };
  const first = directoryProjection(index, {
    ...options,
    mode: "items",
    expanded: ["product_requirement"],
  });
  const before = await layoutProjection(first, display);
  const nextProjection = directoryProjection(index, {
    ...options,
    mode: "items",
    expanded: ["product_requirement"],
    pages: { product_requirement: 1 },
  });
  const next = stableLayout(nextProjection, display, before, "group:product_requirement");
  const slots = (layout) =>
    layout.nodes
      .filter((node) => node.data.kind !== "group")
      .map((node) => JSON.stringify(node.position))
      .sort();
  assert.deepEqual(slots(next), slots(before));
  const filtered = stableLayout({ ...nextProjection, edges: [] }, display, next);
  assert.deepEqual(
    filtered.nodes.map((node) => [node.id, node.position, node.width, node.height]),
    next.nodes.map((node) => [node.id, node.position, node.width, node.height]),
  );
});
