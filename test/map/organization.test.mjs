import { presets } from "./scale-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexFixture } from "../../ui/map/model.ts";
import {
  fixtureOrganization as studyOrganization,
  buildDirectory,
  directoryProjection,
  folderKey,
  revealInDirectory,
} from "./fixtures/organization.mjs";
import { makeConnectedFixture } from "./fixtures/connected-fixture.mjs";
import { layoutProjection } from "../../ui/map/layout.ts";
const fixture = JSON.parse(readFileSync(new URL("./fixtures/fixture.json", import.meta.url)));
const data = makeConnectedFixture(fixture),
  index = indexFixture(data),
  organization = studyOrganization(data);
const options = {
  types: presets.development,
  relations: Object.keys(data.schema.relationshipTypes),
  expanded: [],
  pages: {},
  organization,
};

test("Aster uses a subject-folder level only where that item type has multiple subjects", () => {
  const asterIndex = indexFixture(fixture),
    metadata = studyOrganization(fixture);
  const tree = buildDirectory(asterIndex, metadata);
  const measurement = tree.groups.get(folderKey("user_need", ["Measurement"]));
  assert.equal(measurement.members.length, 1);
  assert.equal(measurement.children.length, 0);
  assert.equal(tree.groups.has(folderKey("user_need", ["Measurement", "Acquisition"])), false);
  const requirements = tree.groups.get(folderKey("product_requirement", ["Measurement"]));
  assert.equal(requirements.members.length, 4);
  assert.deepEqual(
    requirements.children.map((group) => group.title),
    ["Acquisition", "Quality"],
  );
  for (const group of tree.groups.values())
    if (group.path.length) assert.notEqual(group.children.length, 1);
  const authored = studyOrganization({
    entities: [
      {
        id: "custom",
        type: "user_need",
        key: "UN-01",
        studyFolder: ["My area", "My subject"],
        studyAreas: ["My category"],
      },
    ],
  });
  assert.deepEqual(authored.custom, { path: ["My area", "My subject"], areas: ["My category"] });
});

test("connected study has shared identities, cross-area paths, a cycle and an isolated unfiled item", () => {
  assert.equal(data.entities.length, 505);
  assert.equal(data.relationships.length, 888);
  assert.equal(data.entities.filter((e) => e.type === "test_run").length, 0);
  const linked = new Set(data.relationships.flatMap((link) => [link.source, link.target]));
  assert.equal(linked.size, 504);
  const todo = [data.entities[0].id],
    reached = new Set(todo);
  for (let i = 0; i < todo.length; i++)
    for (const link of data.relationships) {
      const next =
        link.source === todo[i] ? link.target : link.target === todo[i] ? link.source : null;
      if (next && !reached.has(next)) {
        reached.add(next);
        todo.push(next);
      }
    }
  assert.equal(reached.size, 504);
  assert.ok(
    index.links.filter(
      (link) =>
        link.nativeTarget === data.entities.find((e) => e.type === "verification_protocol").id,
    ).length > 90,
  );
});

test("nested folder aggregation preserves every link once at mixed detail and the node budget", () => {
  const tree = buildDirectory(index, organization);
  const graph = directoryProjection(index, { ...options, expanded: [...tree.groups.keys()] });
  assert.ok(graph.nodes.length <= 160);
  assert.ok(graph.limitedGroups > 0);
  assert.equal(graph.totalRecords, 505);
  const expandedLinks = graph.edges.flatMap((edge) => edge.linkIds);
  assert.equal(new Set(expandedLinks).size, expandedLinks.length);
  assert.equal(graph.scopedLinks, 888);
  if (!graph.omittedEdges) assert.equal(expandedLinks.length, 888);
  const collapsed = directoryProjection(index, options);
  assert.equal(collapsed.edges.flatMap((edge) => edge.linkIds).length, 888);
  const allIds = new Set(graph.nodes.map((node) => node.id));
  for (const node of graph.nodes) if (node.parentId) assert.ok(allIds.has(node.parentId));
});

test("entering Battery exposes exact boundary links without classifying its neighbors", () => {
  const folder = folderKey("product_requirement", ["Power", "Battery"]),
    before = JSON.stringify(organization);
  const graph = directoryProjection(index, {
    ...options,
    types: ["product_requirement"],
    folder,
    expanded: [folder],
    showBoundary: true,
  });
  assert.equal(graph.totalRecords, 4);
  assert.ok(graph.boundaryLinks > 0);
  assert.ok(graph.contextRecords > 0);
  const boundaryCount = index.links.filter(
    (link) => graph.scopeIds.includes(link.source) !== graph.scopeIds.includes(link.target),
  ).length;
  assert.equal(graph.boundaryLinks, boundaryCount);
  assert.equal(JSON.stringify(organization), before);
  assert.ok(graph.nodes.some((node) => node.external));
  for (const edge of graph.edges) for (const id of edge.linkIds) assert.ok(index.linkById.has(id));
});

test("reveal respects identity and preserves off-page represented links", () => {
  const scoped = index.fixture.entities
    .filter((e) => e.type === "product_requirement")
    .slice(0, 12)
    .map((e) => e.id);
  const reveal = revealInDirectory(index, organization, scoped, [], {});
  const graph = directoryProjection(index, { ...options, ...reveal, revealed: scoped });
  for (const id of scoped) assert.equal(graph.nodes.filter((node) => node.id === id).length, 1);
  assert.equal(
    new Set(graph.edges.flatMap((edge) => edge.linkIds)).size,
    graph.edges.flatMap((edge) => edge.linkIds).length,
  );
  assert.ok(graph.scopedLinkIds.every((id) => index.linkById.has(id)));
});

test("study folder/category edits preserve canonical engineering records and relationships", () => {
  const before = JSON.stringify(data),
    id = data.entities[0].id;
  const modified = {
    ...organization,
    [id]: { path: ["Review", "Shared"], areas: ["Power", "Safety"] },
  };
  const tree = buildDirectory(index, modified);
  assert.equal(tree.leaves.get(id).key, folderKey(data.entities[0].type, ["Review", "Shared"]));
  const power = directoryProjection(index, { ...options, organization: modified, area: "Power" });
  const safety = directoryProjection(index, { ...options, organization: modified, area: "Safety" });
  assert.ok(power.scopeIds.includes(id) && safety.scopeIds.includes(id));
  assert.equal(JSON.stringify(data), before);
});

test("revealing a nonadjacent item exposes only that canonical context record", () => {
  const id = "connected:unfiled";
  const graph = directoryProjection(index, {
    ...options,
    area: "Power",
    revealed: [id],
    showBoundary: false,
  });
  assert.equal(graph.nodes.filter((node) => node.id === id && node.external).length, 1);
  assert.equal(graph.scopeIds.includes(id), false);
  assert.equal(
    graph.edges.some((edge) => edge.source === id || edge.target === id),
    false,
  );
  assert.equal(organization[id].areas.length, 0);
});

test("nested groups and boundary connections route in both orientations", async () => {
  const aster = indexFixture(fixture),
    org = studyOrganization(fixture);
  const group = folderKey("product_requirement", ["Power"]);
  const projection = directoryProjection(aster, {
    types: presets.requirements,
    relations: Object.keys(fixture.schema.relationshipTypes),
    expanded: ["product_requirement", group],
    pages: {},
    organization: org,
  });
  for (const direction of ["DOWN", "RIGHT"]) {
    const layout = await layoutProjection(projection, { direction });
    assert.equal(layout.edges.length, projection.edges.length);
    assert.ok(layout.edges.every((edge) => edge.data.points.length >= 2));
    for (const node of layout.nodes)
      assert.ok(Number.isFinite(node.position.x) && Number.isFinite(node.position.y));
  }
});
