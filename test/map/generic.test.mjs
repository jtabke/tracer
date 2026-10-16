import test from "node:test";
import assert from "node:assert/strict";
import { studyOrganization } from "../../ui/map/organization.ts";
import { asterFolders } from "../../examples/map-organization.mjs";
import { indexFixture, typeNames } from "../../ui/map/model.ts";
test("native data never receives study folder assignments from matching keys", () => {
  const fixture = {
    schema: { entityTypes: { requirement: { fields: {} } }, relationshipTypes: {} },
    entities: [
      { id: "one", type: "requirement", key: "PRS-12", fields: { title: "Real project" } },
    ],
    relationships: [],
  };
  assert.deepEqual(studyOrganization(fixture).one, { path: ["Unfiled"], areas: [] });
  assert.ok(Object.keys(asterFolders).length > 0);
  assert.equal(indexFixture(fixture).entities.get("one").fields.title, "Real project");
  assert.equal(typeNames.arbitrary_custom_type, "Arbitrary custom type");
});

const { relevantRelationships, connectionEndpoints } = await import("../../ui/map/filters.ts");
test("unconstrained endpoint permissions remain Any while explicit empty permissions remain None", () => {
  const schema = {
    entityTypes: { item: { fields: {} } },
    relationshipTypes: {
      any: { fields: {} },
      incoming: { fields: {}, target: ["item"] },
      none: { fields: {}, source: [], target: ["item"] },
    },
  };
  assert.deepEqual(relevantRelationships(schema, ["item"]), ["any", "incoming"]);
  assert.equal(connectionEndpoints(schema.relationshipTypes.any), "Any item type → Any item type");
  assert.equal(connectionEndpoints(schema.relationshipTypes.none), "No item types → Item");
});
