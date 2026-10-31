import { studyOrganization } from "../../ui/map/study-organization.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexFixture } from "../../ui/map/model.ts";
import { projectMap } from "../../ui/map/map-projection.ts";
import { folderKey, revealInDirectory } from "../../ui/map/organization.ts";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/medical-clean-data.json", import.meta.url), "utf8"),
);
const index = indexFixture(fixture),
  organization = studyOrganization(fixture);
const root = fixture.entities.find((item) => item.key === "PRS-01");
function state(patch = {}) {
  return {
    focus: null,
    depth: 1,
    direction: "downstream",
    relations: Object.keys(fixture.schema.relationshipTypes),
    types: Object.keys(fixture.schema.entityTypes),
    expanded: [],
    pages: {},
    detail: "folders",
    area: "All areas",
    folderScope: null,
    revealed: [],
    showBoundary: false,
    ...patch,
  };
}

test("a focused item draws its native trace rather than the model overview; level zero has exactly that identity", () => {
  const trace = projectMap(index, organization, state({ focus: root.id }), {});
  assert.ok(trace.nodes.some((node) => node.kind === "item" && node.id === root.id));
  assert.ok(trace.nodes.length > 1);
  const source = projectMap(index, organization, state({ focus: root.id, depth: 0 }), {});
  assert.deepEqual(
    source.nodes.map((node) => node.id),
    [root.id],
  );
  assert.equal(source.edges.length, 0);
});

test("invalidated focus returns a valid overview without inventing a missing record", () => {
  const overview = projectMap(index, organization, state({ focus: "removed" }), {});
  assert.ok(overview.nodes.some((node) => node.kind === "group"));
  assert.equal(
    overview.nodes.some((node) => node.id === "removed"),
    false,
  );
});

test("folder and explicit endpoint reveals retain canonical record identities and valid line endpoints", () => {
  const organized = { ...organization, [root.id]: { path: ["Selected"], areas: [] } };
  const folder = folderKey(root.type, ["Selected"]);
  const detail = projectMap(
    index,
    organized,
    state({ folderScope: folder, types: [root.type] }),
    {},
  );
  assert.deepEqual(detail.rootIds, [root.id]);
  const revealed = projectMap(
    index,
    organized,
    state({ ...revealInDirectory(index, organized, [root.id], [], {}), revealed: [root.id] }),
    {},
  );
  assert.ok(revealed.nodes.some((node) => node.kind === "item" && node.id === root.id));
  const ids = new Set(revealed.nodes.map((node) => node.id));
  assert.ok(revealed.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target)));
});
