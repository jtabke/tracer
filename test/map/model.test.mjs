import { makeScaleFixture, presets } from "./scale-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAGE_SIZE,
  TRACE_LIMIT,
  indexFixture,
  modelProjection,
  traceProjection,
  searchItems,
} from "../../ui/map/model.ts";
import { layoutProjection } from "../../ui/map/layout.ts";
import {
  relevantRelationships,
  groupedChoices,
  itemFilterGroups,
  connectionFilterGroups,
  connectionEndpoints,
} from "../../ui/map/filters.ts";

const fixture = JSON.parse(
  readFileSync(new URL("../../docs/ux-artifacts/map-first/fixture.json", import.meta.url)),
);
const index = indexFixture(fixture);
const options = {
  types: presets.requirements,
  relations: Object.keys(fixture.schema.relationshipTypes),
  expanded: [],
  pages: {},
};
const identity = (key) => fixture.entities.find((e) => e.key === key).id;

test("filter relevance respects declared endpoint pairs and retains allowed zero-link routes", () => {
  assert.deepEqual(relevantRelationships(fixture.schema, presets.requirements), [
    "addressed_by_requirement",
    "allocated_to_subsystem",
    "verified_by",
    "validated_by",
  ]);
  const schema = {
    relationshipTypes: {
      precise: {
        source: ["a", "b"],
        target: ["x", "y"],
        workflow: [
          { source: "a", target: "x" },
          { source: "b", target: "y" },
        ],
      },
      generic: { source: ["a"], target: ["y"] },
    },
  };
  assert.deepEqual(relevantRelationships(schema, ["a", "y"]), ["generic"]);
  assert.ok(
    relevantRelationships(fixture.schema, Object.keys(fixture.schema.entityTypes)).includes(
      "evaluated_configuration",
    ),
  );
  assert.equal(
    connectionEndpoints(fixture.schema.relationshipTypes.examines_output),
    "Verification plans → Design outputs",
  );
});

test("filter presentation exposes every schema choice once, including unfamiliar types", () => {
  for (const [groups, types] of [
    [itemFilterGroups, Object.keys(fixture.schema.entityTypes)],
    [connectionFilterGroups, Object.keys(fixture.schema.relationshipTypes)],
  ]) {
    const actual = groupedChoices(groups, [...types, "custom_kind"]).flatMap(
      (group) => group.types,
    );
    assert.deepEqual([...actual].sort(), [...types, "custom_kind"].sort());
    assert.equal(new Set(actual).size, actual.length);
  }
});

test("study data preserves the source schema, identities, fields and links exactly", () => {
  const source = JSON.parse(
    readFileSync(
      new URL(
        "../../docs/ux-artifacts/task-surface-reset/medical-clean-data.json",
        import.meta.url,
      ),
    ),
  );
  for (const key of ["title", "domain", "schema", "entities", "relationships"]) {
    assert.deepEqual(fixture[key], source[key]);
  }
});

test("collapsed model aggregates exact recorded links without manufacturing membership", () => {
  const graph = modelProjection(index, options);
  assert.equal(graph.nodes.length, 5);
  assert.equal(graph.totalRecords, 50);
  assert.equal(graph.scopedLinks, 71);
  assert.equal(graph.edges.flatMap((e) => e.linkIds).length, 71);
  assert.equal(new Set(graph.edges.flatMap((e) => e.linkIds)).size, 71);
  assert.equal(graph.individualCount, 0);
});

test("expanded groups page without dropping records or links from the summaries", () => {
  const expanded = { ...options, expanded: ["product_requirement"] };
  const first = modelProjection(index, expanded);
  const next = modelProjection(index, { ...expanded, pages: { product_requirement: 1 } });
  const last = modelProjection(index, { ...expanded, pages: { product_requirement: 2 } });
  assert.equal(first.individualCount, PAGE_SIZE);
  const allIds = [first, next, last].flatMap((g) =>
    g.nodes.filter((n) => n.kind === "item").map((n) => n.id),
  );
  assert.equal(new Set(allIds).size, 14);
  for (const graph of [first, next, last]) {
    assert.equal(graph.edges.flatMap((e) => e.linkIds).length, 71);
    assert.equal(graph.nodes.find((n) => n.kind === "remainder").count + graph.individualCount, 14);
    const ids = new Set(graph.nodes.map((n) => n.id));
    assert.ok(graph.edges.every((e) => ids.has(e.source) && ids.has(e.target)));
  }
});

test("mixed granularity retains shared identity and other model groups", () => {
  const graph = modelProjection(index, {
    ...options,
    expanded: ["user_need", "product_requirement"],
  });
  assert.equal(graph.nodes.filter((n) => n.kind === "group").length, 5);
  assert.equal(graph.individualCount, 10);
  assert.equal(new Set(graph.nodes.map((n) => n.id)).size, graph.nodes.length);
});

test("expanded groups expose exact item traces and count off-page links separately", () => {
  const graph = modelProjection(index, {
    ...options,
    expanded: ["user_need", "product_requirement"],
  });
  const visible = new Set(
    graph.nodes.filter((node) => node.kind === "item").map((node) => node.id),
  );
  const direct = graph.edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target));
  assert.ok(direct.length > 0);
  for (const edge of direct)
    for (const id of edge.linkIds) {
      const recorded = index.linkById.get(id);
      assert.equal(recorded.source, edge.source);
      assert.equal(recorded.target, edge.target);
    }
  assert.ok(
    graph.edges.some(
      (edge) => edge.source.startsWith("remainder:") || edge.target.startsWith("remainder:"),
    ),
  );
  assert.equal(new Set(graph.edges.flatMap((edge) => edge.linkIds)).size, graph.scopedLinks);
});

test("validation follows verification in either layout without fabricating a trace between them", async () => {
  for (const expanded of [[], ["user_need", "product_requirement"]]) {
    const graph = modelProjection(index, { ...options, expanded });
    assert.ok(
      !graph.edges.some(
        (edge) =>
          edge.source === "group:verification_protocol" &&
          edge.target === "group:validation_protocol",
      ),
    );
    assert.ok(graph.edges.some((edge) => edge.type === "validated_by"));
    for (const direction of ["RIGHT", "DOWN"]) {
      const layout = await layoutProjection(graph, { direction });
      const verification = layout.nodes.find((node) => node.id === "group:verification_protocol");
      const validation = layout.nodes.find((node) => node.id === "group:validation_protocol");
      if (direction === "RIGHT")
        assert.ok(validation.position.x >= verification.position.x + verification.width);
      else assert.ok(validation.position.y >= verification.position.y + verification.height);
      assertNativeEndpoints(layout);
    }
  }
});

test("schema permission without a recorded result stays explicit and uncounted", () => {
  const graph = modelProjection(index, { ...options, types: presets.development });
  const allowed = graph.edges.find((e) => e.allowed && e.type === "produces_result");
  assert.ok(allowed);
  assert.equal(allowed.linkIds.length, 0);
  assert.equal(allowed.source, "group:validation_protocol");
  assert.equal(graph.edges.flatMap((e) => e.linkIds).length, graph.scopedLinks);
});

test("same-type dependencies are retained as counted group self-loops", () => {
  const graph = modelProjection(index, { ...options, types: presets.all });
  const self = graph.edges.find((e) => e.type === "depends_on");
  assert.equal(self.source, self.target);
  assert.ok(self.linkIds.length > 0);
  assert.equal(graph.edges.flatMap((e) => e.linkIds).length, fixture.relationships.length);
});

test("relationship filters remove only selected link types and retain isolated records", () => {
  const graph = modelProjection(index, { ...options, expanded: ["user_need"], relations: [] });
  assert.equal(graph.edges.length, 0);
  assert.equal(graph.nodes.filter((n) => n.kind === "item").length, 5);
  assert.equal(graph.outsideLinks, index.links.length);
});

test("flow direction uses authored reversal without changing native endpoints", () => {
  const examination = index.links.find((l) => l.type === "examines_output");
  assert.equal(examination.source, examination.nativeTarget);
  assert.equal(examination.target, examination.nativeSource);
  assert.equal(
    fixture.relationships.find((l) => l.id === examination.id).source,
    examination.nativeSource,
  );
});

test("trace depth/direction narrow actual paths and shared records appear once", () => {
  const root = identity("PRS-02");
  const base = { root, relations: options.relations, depth: 1, direction: "both" };
  const one = traceProjection(index, base),
    two = traceProjection(index, { ...base, depth: 2 });
  const upstream = traceProjection(index, { ...base, direction: "upstream" });
  const downstream = traceProjection(index, { ...base, direction: "downstream" });
  assert.ok(two.totalRecords > one.totalRecords);
  assert.ok(upstream.totalRecords < one.totalRecords);
  assert.ok(downstream.totalRecords < one.totalRecords);
  assert.equal(new Set(two.nodes.map((n) => n.id)).size, two.nodes.length);
  assert.equal(two.nodes[0].id, root);
});

test("dense trace reports reached records beyond its drawing budget", () => {
  const graph = traceProjection(index, {
    root: identity("DEV-01"),
    relations: options.relations,
    depth: 3,
    direction: "both",
  });
  assert.equal(graph.individualCount, TRACE_LIMIT);
  assert.ok(graph.omittedRecords > 0);
  assert.equal(graph.individualCount + graph.omittedRecords, graph.totalRecords);
});

test("large fixture keeps drawing bounded and finds off-page identities", () => {
  const scale = indexFixture(makeScaleFixture(fixture));
  assert.equal(scale.entities.size, 9900);
  assert.equal(scale.links.length, 21900);
  const graph = modelProjection(scale, { ...options, expanded: presets.requirements });
  assert.ok(graph.nodes.length <= 40);
  assert.equal(graph.individualCount, 25);
  const result = searchItems(scale, "PRS-02.100");
  assert.equal(result.total, 1);
  assert.ok(!graph.nodes.some((n) => n.id === result.items[0].id));
  assert.equal(result.items[0].key, "PRS-02.100");
});

test("ELK routes compound groups and their records remain disjoint", async () => {
  const graph = modelProjection(index, {
    ...options,
    expanded: ["product_requirement", "subsystem_requirement"],
  });
  const layout = await layoutProjection(graph, { direction: "DOWN" });
  assert.equal(layout.nodes.length, graph.nodes.length);
  assert.equal(layout.edges.length, graph.edges.length);
  assert.ok(
    layout.nodes.every((n) => Number.isFinite(n.position.x) && Number.isFinite(n.position.y)),
  );
  assert.ok(layout.edges.every((e) => e.data.points.length >= 2));
  const leaves = layout.nodes.filter((n) => n.data.kind !== "group");
  for (let i = 0; i < leaves.length; i++)
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i],
        b = leaves[j],
        ap = layout.absolute.get(a.id),
        bp = layout.absolute.get(b.id);
      assert.ok(
        ap.x + a.width <= bp.x ||
          bp.x + b.width <= ap.x ||
          ap.y + a.height <= bp.y ||
          bp.y + b.height <= ap.y,
        `Overlapping records ${a.id}/${b.id}`,
      );
    }
});

test("all decompositions and types can expand without losing internal or cross-group traces", async () => {
  const graph = modelProjection(index, { ...options, types: presets.all, expanded: presets.all });
  assert.equal(
    new Set(graph.edges.flatMap((edge) => edge.linkIds)).size,
    fixture.relationships.length,
  );
  for (const direction of ["RIGHT", "DOWN"]) {
    const layout = await layoutProjection(graph, { direction });
    assert.equal(layout.nodes.length, graph.nodes.length);
    assert.equal(layout.edges.length, graph.edges.length);
    assert.ok(layout.edges.every((edge) => edge.data.points.length >= 2));
  }
});

function assertNativeEndpoints(layout) {
  for (const edge of layout.edges.filter(
    (edge) => !edge.source.startsWith("group:") && !edge.target.startsWith("group:"),
  )) {
    for (const [id, point] of [
      [edge.source, edge.data.points[0]],
      [edge.target, edge.data.points.at(-1)],
    ]) {
      const node = layout.nodes.find((n) => n.id === id),
        position = layout.absolute.get(id);
      const onX =
        Math.abs(point.x - position.x) < 1 || Math.abs(point.x - position.x - node.width) < 1;
      const onY =
        Math.abs(point.y - position.y) < 1 || Math.abs(point.y - position.y - node.height) < 1;
      assert.ok(onX || onY, "Trace endpoint attaches to the actual item border");
    }
  }
}
