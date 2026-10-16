import { presets } from "./scale-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeAsterFixture } from "../../docs/ux-artifacts/map-first/aster-fixture.mjs";
import { asterTopics } from "../../docs/ux-artifacts/map-first/aster-content.mjs";
import { indexFixture } from "../../ui/map/model.ts";
import {
  buildDirectory,
  directoryProjection,
  folderKey,
  studyOrganization,
} from "../../docs/ux-artifacts/map-first/organization.mjs";
const base = JSON.parse(
  readFileSync(new URL("../../docs/ux-artifacts/map-first/fixture.json", import.meta.url)),
);
const data = makeAsterFixture(base),
  index = indexFixture(data),
  organization = studyOrganization(data);
const entity = (key) => data.entities.find((item) => item.key === key);
const links = (type, source) =>
  data.relationships.filter((link) => link.type === type && link.source === source.id);

test("expanded Aster retains the original fixture, uses unique identities and only schema-valid fields/links", () => {
  assert.equal(data.entities.length, 622);
  assert.equal(data.relationships.length, 1138);
  assert.deepEqual(data.schema, base.schema);
  for (const original of base.entities) assert.deepEqual(index.entities.get(original.id), original);
  for (const original of base.relationships)
    assert.deepEqual(index.linkById.get(original.id)?.fields, original.fields);
  assert.deepEqual(data.relationships.slice(0, base.relationships.length), base.relationships);
  assert.equal(new Set(data.entities.map((item) => item.id)).size, data.entities.length);
  assert.equal(new Set(data.entities.map((item) => item.key)).size, data.entities.length);
  assert.equal(new Set(data.relationships.map((link) => link.id)).size, data.relationships.length);
  for (const item of data.entities)
    for (const key of Object.keys(item.fields))
      assert.ok(data.schema.entityTypes[item.type].fields[key], `${item.key}: ${key}`);
  const pairs = new Set();
  for (const link of data.relationships) {
    const definition = data.schema.relationshipTypes[link.type];
    assert.ok(definition.source.includes(index.entities.get(link.source).type));
    assert.ok(definition.target.includes(index.entities.get(link.target).type));
    const pair = `${link.type}:${link.source}:${link.target}`;
    assert.ok(!pairs.has(pair), `Duplicate link: ${pair}`);
    pairs.add(pair);
  }
  assert.deepEqual(makeAsterFixture(base), data);
});

test("each development type has ten populated subject folders with useful branches and pageable requirements", () => {
  const tree = buildDirectory(index, organization);
  for (const type of [
    "user_need",
    "product_requirement",
    "subsystem_requirement",
    "component_requirement",
    "design_output",
    "verification_protocol",
    "validation_protocol",
  ]) {
    for (const topic of asterTopics) {
      const leaf = tree.groups.get(folderKey(type, [topic.area, topic.subject]));
      assert.ok(
        leaf.members.length >= (type === "user_need" || type === "validation_protocol" ? 3 : 6),
      );
      assert.equal(tree.groups.get(folderKey(type, [topic.area])).children.length, 2);
    }
  }
  const folder = folderKey("product_requirement", ["Power", "Battery"]);
  const options = {
    types: presets.requirements,
    organization,
    relations: Object.keys(data.schema.relationshipTypes),
    expanded: [folder],
    folder,
    pages: {},
  };
  const first = directoryProjection(index, options);
  const second = directoryProjection(index, { ...options, pages: { [folder]: 1 } });
  const ids = [...first.nodes, ...second.nodes]
    .filter((node) => node.kind === "item")
    .map((node) => node.id);
  assert.equal(new Set(ids).size, 7);
  assert.equal(first.boundaryLinks, second.boundaryLinks);
  assert.ok(first.boundaryLinks > 0);
});

test("authored need decomposition reaches distinct subsystem/component criteria, shared designs and separate V&V plans", () => {
  const need = entity("UN-BAT-01"),
    prs = entity("PRS-BAT-01");
  assert.equal(links("addressed_by_requirement", need).length, 2);
  const allocations = links("allocated_to_subsystem", prs);
  assert.equal(allocations.length, 2);
  const components = allocations.map(
    (link) => links("allocated_to_component", index.entities.get(link.target))[0].target,
  );
  assert.equal(new Set(components).size, 2);
  const outputs = components.map((id) => links("implemented_by", index.entities.get(id))[0].target);
  assert.equal(new Set(outputs).size, 1, "One shared design, not cloned per allocation");
  assert.equal(links("verified_by", prs).length, 1);
  assert.equal(links("validated_by", need).length, 1);
  const verification = index.entities.get(links("verified_by", prs)[0].target);
  assert.equal(links("examines_output", verification)[0].target, outputs[0]);
  assert.deepEqual(
    data.entities.filter((item) => item.type === "test_run"),
    base.entities.filter((item) => item.type === "test_run"),
  );
  assert.deepEqual(
    data.relationships.filter((link) => link.type === "produces_result"),
    base.relationships.filter((link) => link.type === "produces_result"),
  );
});

test("cross-area dependency and shared verification support the battery-save change review without claiming impact or completion", () => {
  const change = entity("CHG-BAT-REVIEW"),
    reviewed = links("requires_review_of", change).map((link) => index.entities.get(link.target));
  assert.deepEqual(
    new Set(reviewed.map((item) => item.studyFolder[0])),
    new Set(["Power", "Usability"]),
  );
  assert.equal(reviewed.length, 9);
  assert.ok(
    links("depends_on", entity("OUT-REC-03")).some(
      (link) => link.target === entity("OUT-SUP-04").id,
    ),
  );
  const shared = entity("VER-BAT-03");
  assert.ok(
    data.relationships.filter((link) => link.type === "verified_by" && link.target === shared.id)
      .length > 5,
  );
  const unfinished = entity("CMP-SRV-06B");
  assert.equal(links("implemented_by", unfinished).length, 0);
  assert.equal(links("verified_by", unfinished).length, 0);
  assert.match(
    entity("CHG-SRV-REVIEW").fields.statement,
    /neither a direct design contribution nor an assigned component verification/,
  );
});

test("expanded Aster keeps mixed detail bounded and all scoped links available beyond the drawing", () => {
  const tree = buildDirectory(index, organization);
  const graph = directoryProjection(index, {
    types: Object.keys(data.schema.entityTypes),
    relations: Object.keys(data.schema.relationshipTypes),
    expanded: [...tree.groups.keys()],
    pages: {},
    organization,
  });
  assert.ok(graph.nodes.length <= 160);
  assert.ok(graph.limitedGroups > 0);
  assert.equal(graph.totalRecords, data.entities.length);
  assert.equal(graph.scopedLinkIds.length, data.relationships.length);
  assert.ok(graph.edges.length <= 250);
});
