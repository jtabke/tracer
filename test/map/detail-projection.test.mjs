import { presets } from "./scale-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeAsterFixture } from "./fixtures/aster-fixture.mjs";
import { indexFixture } from "../../ui/map/model.ts";
import {
  folderKey,
  buildDirectory,
  displayFolderChildren,
  fixtureOrganization as studyOrganization,
  directoryProjection,
  revealInDirectory,
} from "./fixtures/organization.mjs";
import {
  folderTraceProjection,
  itemTraceProjection,
  flatDirectoryProjection,
} from "../../ui/map/detail-projection.ts";
const data = makeAsterFixture(
  JSON.parse(readFileSync(new URL("./fixtures/fixture.json", import.meta.url))),
);
const index = indexFixture(data),
  organization = studyOrganization(data),
  relations = Object.keys(data.schema.relationshipTypes);
const folder = folderKey("user_need", ["Maintenance", "Cleaning"]);
const key = (id) => index.entities.get(id).key;

test("Cleaning opens to three user needs and their exact one-level downstream records without any containers", () => {
  const graph = folderTraceProjection(index, organization, {
    folder,
    depth: 1,
    direction: "downstream",
    relations,
  });
  assert.equal(graph.folderTotal, 3);
  assert.equal(graph.nodes.length, 12);
  assert.equal(graph.linkedCount, 9);
  assert.equal(graph.edges.length, 9);
  assert.ok(graph.nodes.every((node) => node.kind === "item" && !node.parentId && node.showFolder));
  assert.deepEqual(graph.rootIds.map(key), ["UN-CLN-01", "UN-CLN-02", "UN-CLN-03"]);
  for (const edge of graph.edges) {
    assert.ok(graph.rootIds.includes(edge.source));
    for (const id of edge.linkIds) assert.ok(index.linkById.has(id));
  }
  assert.equal(
    graph.nodes.some((node) => node.entity.type === "subsystem_requirement"),
    false,
  );
});

test("visible levels control exact reach and disclose the drawing bound instead of silently dropping decomposition", () => {
  const opts = { folder, direction: "downstream", relations };
  const none = folderTraceProjection(index, organization, { ...opts, depth: 0 });
  const two = folderTraceProjection(index, organization, { ...opts, depth: 2 });
  const three = folderTraceProjection(index, organization, { ...opts, depth: 3 });
  assert.equal(none.nodes.length, 3);
  assert.equal(none.edges.length, 0);
  assert.equal(two.nodes.length, 30);
  assert.ok(two.nodes.some((node) => node.entity.type === "subsystem_requirement"));
  assert.equal(
    two.nodes.some((node) => node.entity.type === "component_requirement"),
    false,
  );
  assert.ok(three.totalRecords > 30);
  assert.equal(three.omittedRecords, three.totalRecords - three.individualCount);
  assert.ok(three.nodes.length <= 30);
  assert.equal(new Set(three.nodes.map((node) => node.id)).size, three.nodes.length);
});

test("folder source pages retain all members and never pretend adjacent types belong to the folder", () => {
  const battery = folderKey("product_requirement", ["Power", "Battery"]),
    before = structuredClone(organization);
  const opts = { folder: battery, depth: 1, direction: "downstream", relations };
  const first = folderTraceProjection(index, organization, opts),
    second = folderTraceProjection(index, organization, { ...opts, page: 1 });
  assert.equal(first.folderTotal, 7);
  assert.equal(first.rootIds.length, 5);
  assert.equal(second.rootIds.length, 2);
  assert.equal(new Set([...first.rootIds, ...second.rootIds]).size, 7);
  assert.equal(first.sourcePageCount, 2);
  assert.ok(first.linkedCount > 0);
  assert.deepEqual(organization, before);
  const empty = folderTraceProjection(index, organization, { ...opts, folder: "missing" });
  assert.equal(empty.nodes.length, 0);
  assert.equal(empty.folderTotal, 0);
});

test("connection-kind and direction controls narrow actual item traces while keeping source identity", () => {
  const root = data.entities.find((entity) => entity.key === "UN-CLN-01").id;
  const direct = itemTraceProjection(index, organization, {
    root,
    depth: 1,
    direction: "downstream",
    relations,
  });
  assert.equal(direct.nodes.length, 4);
  const requirementsOnly = itemTraceProjection(index, organization, {
    root,
    depth: 1,
    direction: "downstream",
    relations: ["addressed_by_requirement"],
  });
  assert.equal(requirementsOnly.nodes.length, 3);
  assert.equal(
    requirementsOnly.nodes.some((node) => node.entity.type === "validation_protocol"),
    false,
  );
  const upstream = itemTraceProjection(index, organization, {
    root,
    depth: 1,
    direction: "upstream",
    relations,
  });
  assert.ok(upstream.nodes.some((node) => node.entity.key === "DEV-01"));
});

test("explicit endpoint reveals flatten opened ancestors while preserving every recorded bundle and remainder page", () => {
  const ids = ["PRS-BAT-03", "SYS-BAT-03A", "CMP-BAT-03A"].map(
    (key) => data.entities.find((entity) => entity.key === key).id,
  );
  const reveal = revealInDirectory(index, organization, ids, [], {});
  const graph = directoryProjection(index, {
    organization,
    types: presets.development,
    relations,
    ...reveal,
    revealed: ids,
  });
  const flat = flatDirectoryProjection(index, organization, graph);
  assert.ok(flat.nodes.every((node) => !node.parentId));
  assert.ok(flat.nodes.every((node) => !(node.kind === "group" && node.open)));
  for (const id of ids) assert.equal(flat.nodes.filter((node) => node.id === id).length, 1);
  assert.deepEqual(
    flat.edges
      .filter((edge) => !edge.allowed)
      .flatMap((edge) => edge.linkIds)
      .sort(),
    graph.edges
      .filter((edge) => !edge.allowed)
      .flatMap((edge) => edge.linkIds)
      .sort(),
  );
  for (const node of flat.nodes.filter((node) => node.kind === "remainder"))
    assert.ok(node.pageCount >= 1);
});

test("chosen next-level reveals retain the original root and visible records without opening sibling branches", async () => {
  const { stableLayout } = await import("../../ui/map/stable-layout.ts");
  const { layoutProjection } = await import("../../ui/map/layout.ts");
  const id = (key) => [...index.entities.values()].find((entity) => entity.key === key).id;
  const opts = { root: id("UN-CLN-01"), depth: 1, direction: "downstream", relations };
  const base = itemTraceProjection(index, organization, opts);
  const keepIds = base.nodes.map((node) => node.id);
  const one = itemTraceProjection(index, organization, {
    ...opts,
    expandedFrom: [id("PRS-CLN-01")],
    keepIds,
  });
  assert.ok(one.nodes.some((node) => node.entity.key === "SYS-CLN-01A"));
  assert.ok(!one.nodes.some((node) => node.entity.key === "SYS-CLN-02A"));
  assert.ok(keepIds.every((id) => one.nodes.some((node) => node.id === id)));
  const two = itemTraceProjection(index, organization, {
    ...opts,
    expandedFrom: [id("PRS-CLN-01"), id("SYS-CLN-01A")],
    keepIds: one.nodes.map((node) => node.id),
  });
  assert.ok(two.nodes.some((node) => node.entity.key === "CMP-CLN-01A"));
  assert.equal(new Set(two.nodes.map((node) => node.id)).size, two.nodes.length);
  const bounded = folderTraceProjection(index, organization, {
    folder,
    depth: 3,
    direction: "downstream",
    relations,
  });
  const extended = folderTraceProjection(index, organization, {
    folder,
    depth: 3,
    direction: "downstream",
    relations,
    expandedFrom: bounded.nodes.map((node) => node.id),
    keepIds: bounded.nodes.map((node) => node.id),
  });
  assert.equal(extended.nodes.length, 30);
  assert.deepEqual(
    extended.nodes.map((node) => node.id),
    bounded.nodes.map((node) => node.id),
  );
  assert.ok(extended.omittedRecords > 0);
  for (const direction of ["DOWN", "RIGHT"]) {
    const display = { direction, spacing: "comfortable" };
    const before = await layoutProjection(base, display);
    const after = stableLayout(one, display, before);
    for (const node of before.nodes)
      assert.deepEqual(after.nodes.find((next) => next.id === node.id).position, node.position);
  }
});

test("project search pages the complete canonical match set and applies type before counting and paging", async () => {
  const { searchItems } = await import("../../ui/map/model.ts");
  const expected = [...index.entities.values()]
    .filter((entity) =>
      `${entity.key} ${entity.fields.title} ${entity.fields.statement}`
        .toLowerCase()
        .includes("battery"),
    )
    .sort((a, b) => a.key.localeCompare(b.key));
  const all = [];
  for (let offset = 0; offset < expected.length; offset += 8) {
    const page = searchItems(index, " battery ", 8, { offset });
    assert.equal(page.total, expected.length);
    all.push(...page.items.map((entity) => entity.id));
  }
  assert.deepEqual(
    all,
    expected.map((entity) => entity.id),
  );
  assert.equal(new Set(all).size, all.length);
  const typed = searchItems(index, "battery", 8, { type: "product_requirement" });
  assert.equal(
    typed.total,
    expected.filter((entity) => entity.type === "product_requirement").length,
  );
  assert.ok(typed.items.every((entity) => entity.type === "product_requirement"));
  assert.equal(searchItems(index, "impossible matching text").total, 0);
});

test("the sole product appears as its actual context record rather than Product/Unfiled wrappers", () => {
  const graph = directoryProjection(index, {
    types: presets.development,
    relations,
    expanded: ["device"],
    pages: {},
    organization,
  });
  const product = [...index.entities.values()].find((entity) => entity.type === "device");
  const node = graph.nodes.find((node) => node.id === product.id);
  assert.equal(node.productContext, true);
  assert.equal(node.kind, "item");
  assert.equal(node.parentId, undefined);
  assert.ok(!graph.nodes.some((node) => node.kind === "group" && node.type === "device"));
  const ids = new Set(graph.nodes.map((node) => node.id));
  assert.ok(graph.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target)));
  const needs = graph.edges.find(
    (edge) => edge.source === product.id && edge.type === "has_user_need",
  );
  assert.equal(needs.linkIds.length, 35);
  assert.equal(graph.totalRecords, 563);
  assert.deepEqual(
    product.fields.intended_use,
    "Adult home spot measurements; pediatric, ambulatory and emergency use excluded from this example.",
  );
});

test("unfiled means direct membership, with no artificial folder and complete mixed-folder paging", () => {
  const members = index.byType
    .get("product_requirement")
    .slice(0, 7)
    .map((entity) => entity.id);
  const mixed = { ...organization };
  for (const id of members) mixed[id] = { ...mixed[id], path: ["Unfiled"] };
  const tree = buildDirectory(index, mixed);
  assert.equal(tree.groups.has(folderKey("product_requirement", ["Unfiled"])), false);
  const opts = {
    types: ["product_requirement"],
    relations,
    expanded: ["product_requirement"],
    organization: mixed,
    pages: {},
  };
  const first = directoryProjection(index, opts);
  const second = directoryProjection(index, { ...opts, pages: { product_requirement: 1 } });
  const direct = (graph) =>
    graph.nodes.filter((node) => node.kind === "item").map((node) => node.id);
  assert.equal(direct(first).length, 5);
  assert.equal(direct(second).length, 2);
  assert.deepEqual(new Set([...direct(first), ...direct(second)]), new Set(members));
  assert.ok(first.nodes.some((node) => node.kind === "group" && node.path?.length));
  assert.ok(!first.nodes.some((node) => node.title === "Unfiled"));
  const only = { ...mixed };
  for (const entity of index.byType.get("product_requirement"))
    only[entity.id] = { ...only[entity.id], path: [] };
  const allDirect = directoryProjection(index, { ...opts, organization: only });
  assert.equal(allDirect.nodes.filter((node) => node.kind === "group").length, 1);
  assert.equal(allDirect.nodes.filter((node) => node.kind === "item").length, 5);
});

test("sparse collections, singleton configurations and pass-through folders do not require extra drilldown", () => {
  const tree = buildDirectory(index, organization);
  const changes = directoryProjection(index, {
    types: ["design_change"],
    relations,
    expanded: ["design_change"],
    pages: {},
    organization,
  });
  assert.equal(changes.nodes.filter((node) => node.kind === "item").length, 5);
  assert.equal(changes.nodes.filter((node) => node.kind === "group").length, 1);
  assert.ok(
    changes.nodes.filter((node) => node.kind === "item").every((node) => node.folderPath.length),
  );
  const config = directoryProjection(index, {
    types: ["evaluation_configuration"],
    relations,
    expanded: [],
    pages: {},
    organization,
  });
  assert.equal(config.nodes.length, 1);
  assert.equal(config.nodes[0].kind, "item");
  const displayed = displayFolderChildren(tree.roots.get("test_run"));
  const safety = displayed.find((group) => group.path[0] === "Safety");
  assert.deepEqual(safety.path, ["Safety", "Pressure protection"]);
  assert.equal(safety.title, "Safety / Pressure protection");
  assert.ok(tree.groups.has(folderKey("test_run", ["Safety"])));
  const requirements = directoryProjection(index, {
    types: ["product_requirement"],
    relations,
    expanded: ["product_requirement"],
    pages: {},
    organization,
  });
  assert.equal(
    requirements.nodes.filter((node) => node.kind === "group" && node.path?.length).length,
    5,
  );
  assert.equal(requirements.nodes.filter((node) => node.kind === "item").length, 0);
  const empty = directoryProjection(index, {
    types: ["evaluation_configuration"],
    relations,
    expanded: [],
    pages: {},
    organization,
    area: "Maintenance",
  });
  assert.equal(empty.nodes.length, 0);
});
