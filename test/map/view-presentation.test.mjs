import test from "node:test";
import assert from "node:assert/strict";
import { initialView, viewReducer, viewOf } from "../../ui/map/view-state.ts";
import { indexFixture, linksFor } from "../../ui/map/model.ts";
import { presentEdges } from "../../ui/map/edge-presentation.ts";
import { absolutePositions } from "../../ui/map/flow-geometry.ts";

const settings = { presets: { all: ["record"] }, defaultPreset: "all", relationTypes: ["uses"] };

test("view transitions preserve retained snapshots and apply queued functional changes", () => {
  const original = initialView(settings);
  const focused = viewReducer(original, { focus: "a", expanded: (ids) => [...ids, "a"] });
  const next = viewReducer(focused, { expanded: (ids) => [...ids, "b"], depth: 3 });
  assert.deepEqual(original.expanded, []);
  assert.equal(original.focus, null);
  assert.deepEqual(focused.expanded, ["a"]);
  assert.deepEqual(next.expanded, ["a", "b"]);
  assert.equal(next.depth, 3);
});

test("saved view restoration excludes camera metadata and rejects unrelated state", () => {
  const original = initialView(settings);
  const snapshot = {
    ...original,
    selected: { kind: "item", id: "a" },
    viewport: { zoom: 2 },
    geometry: {},
  };
  const restored = viewOf(snapshot, initialView(settings));
  assert.deepEqual(restored, { ...original, selected: snapshot.selected });
  assert.throws(() => viewReducer(original, { geometry: {} }), /Unknown view field/);
});

function fixture() {
  return indexFixture({
    schema: {
      entityTypes: { record: {} },
      relationshipTypes: {
        uses: {
          workflow: [
            { source: "record", target: "record", direction: "reverse", label: "used by" },
          ],
        },
      },
    },
    entities: ["a", "b", "c"].map((id) => ({ id, key: id, type: "record", fields: {} })),
    relationships: [
      { id: "ab1", source: "a", target: "b", type: "uses" },
      { id: "ab2", source: "a", target: "b", type: "uses" },
      { id: "loop", source: "a", target: "a", type: "uses" },
      { id: "bc", source: "b", target: "c", type: "uses" },
    ],
  });
}

test("incident lookup retains native endpoints, parallel links and one copy of a self-loop", () => {
  const index = fixture();
  assert.deepEqual(
    linksFor(index, "a").map((link) => link.id),
    ["ab1", "ab2", "loop"],
  );
  assert.equal(index.linkById.get("ab1").source, "b");
  assert.deepEqual(linksFor(index, "missing"), []);
});

function drawing() {
  const nodes = ["group", "a", "b", "c"].map((id, position) => ({
    id,
    parentId: id === "a" ? "group" : undefined,
    position: { x: position * 400, y: 0 },
    width: 220,
    height: 82,
    data: {},
  }));
  const edges = [
    { id: "bundle", source: "a", target: "b", linkIds: ["ab1", "ab2"] },
    { id: "other", source: "b", target: "c", linkIds: ["bc"] },
  ].map((edge) => ({ ...edge, data: { manual: true }, markerEnd: {}, label: "uses" }));
  return { nodes, edges };
}
function render(options = {}) {
  const geometry = drawing();
  const projection = {
    nodes: geometry.nodes.map((node) => ({
      ...node,
      kind: node.id === "group" ? "group" : "item",
    })),
  };
  const defaults = {
    display: initialView(settings).display,
    activeRoute: { edgeIds: [], nextEdgeIds: [] },
    emphasizing: false,
    pathDetail: false,
  };
  return presentEdges(fixture(), projection, geometry, { ...defaults, ...options });
}

test("bundled connection selection counts parallel native links and dims unrelated branches", () => {
  const [bundle, other] = render({
    selected: { kind: "item", id: "a" },
    tray: { linkIds: ["ab2"] },
  });
  assert.equal(bundle.data.selectedLinks, 2);
  assert.equal(bundle.data.selected, true);
  assert.equal(bundle.data.showLabel, true);
  assert.equal(other.data.dim, true);
  const hidden = render({ selected: { kind: "item", id: "off-page" } });
  assert.equal(hidden[1].data.dim, false);
});

test("group branch filtering and isolated trace paths use displayed edge identities", () => {
  const display = initialView(settings).display;
  assert.deepEqual(
    render({
      selected: { kind: "group", id: "group" },
      display: { ...display, links: "selection" },
    }).map((edge) => edge.id),
    ["bundle"],
  );
  const path = render({
    emphasizing: true,
    activeRoute: { edgeIds: ["bundle"], nextEdgeIds: ["other"] },
    display: { ...display, traceEmphasis: "path", labels: "none" },
  });
  assert.deepEqual(
    path.map((edge) => edge.id),
    ["bundle"],
  );
  assert.equal(path[0].data.showLabel, false);
  assert.equal(path[0].data.onPath, true);
  assert.deepEqual(render({ display: { ...display, links: "none" } }), []);
});

test("nested layout positions share one absolute coordinate conversion without mutation", () => {
  const nodes = [
    { id: "parent", position: { x: 20, y: 30 } },
    { id: "child", parentId: "parent", position: { x: 4, y: 8 } },
    { id: "leaf", parentId: "child", position: { x: -2, y: 5 } },
  ];
  assert.deepEqual(absolutePositions(nodes).get("leaf"), { x: 22, y: 43 });
  assert.deepEqual(nodes[2].position, { x: -2, y: 5 });
});
