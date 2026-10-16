import "./register-ui.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Graph } from "../src/application/views.ts";
import type { Editing } from "../ui/editing.ts";
const { GraphView, GraphHeading, GraphNotices, GraphActions, GraphInspection, GraphSurface } =
  await import("./legacy-ui/components/graph.tsx");
const node = {
  id: "root",
  key: "REQ",
  type: "item",
  version: 2,
  fields: { title: "Captured statement" },
};
const graph: Graph = {
  schema: {
    id: "project",
    version: 1,
    entityTypes: { item: { fields: { title: { type: "string" } } } },
    relationshipTypes: {},
  },
  rootId: node.id,
  nodes: [node],
  expanded: [node.id],
  links: [],
  external: [],
  evaluations: [],
};
const editing: Editing = {
  async mutate() {
    throw Error("render must not mutate");
  },
  busy: false,
  epoch: 0,
  report(error) {
    throw error;
  },
  async commit() {
    throw Error("render must not mutate");
  },
};
const never = () => {
  throw Error("render must not invoke an action");
};
const render = (element: React.ReactElement) => renderToStaticMarkup(element);

test("graph view starts with bounded browser/timeline controls without implying a loaded neighborhood", () => {
  const markup = render(
    createElement(GraphView, { schema: graph.schema, editing, changed: never }),
  );
  assert.match(markup, /Your graph starts with an entity/);
  assert.match(markup, /Find on this page/);
  assert.match(markup, /Current · editable/);
  assert.match(markup, /trace evaluations may need review/);
  assert.doesNotMatch(markup, /graph-node|graph-inspector/);
});
test("graph heading keeps native metadata separate from live evaluation counts", () => {
  const temporal = {
    ...graph,
    temporal: {
      at: {
        id: "at",
        projectRevision: 7,
        schemaVersion: 1,
        actor: "author",
        at: "then",
        reason: "Native <change>",
      },
    },
  };
  const markup = render(
    createElement(GraphHeading, {
      graph: temporal,
      time: { atRevision: 7, compareRevision: 6 },
      matching: true,
    }),
  );
  assert.match(markup, /comparison 6 → 7/);
  assert.match(markup, /Native &lt;change&gt;/);
  assert.match(markup, /No evidence or freshness is reconstructed/);
  assert.doesNotMatch(markup, /evaluations may need review/);
  const pending = render(
    createElement(GraphHeading, { graph: temporal, time: { atRevision: 8 }, matching: false }),
  );
  assert.doesNotMatch(pending, /Native &lt;change&gt;/);
});
test("graph notices retain draft/failure guidance and distinguish a missing historical focus", () => {
  const markup = render(
    createElement(GraphNotices, {
      root: node.id,
      pendingSelection: true,
      loading: true,
      failed: true,
      historical: true,
      matching: true,
      graph: { ...graph, nodes: [] },
    }),
  );
  assert.match(markup, /Shared selection pending/);
  assert.match(markup, /drafts are retained; editing is paused/);
  assert.match(markup, /Loading neighborhood/);
  assert.match(markup, /focus entity does not exist at this native revision/);
});
test("graph global actions retain explicit bounds and inspector controls", () => {
  for (const expanded of [[], Array.from({ length: 20 }, (_, i) => String(i))]) {
    const markup = render(
      createElement(GraphActions, {
        graph,
        selectedNode: node,
        loading: false,
        expanded,
        setExpanded: never,
        focus: never,
        inspectorOpen: true,
        setInspectorOpen: never,
      }),
    );
    assert.doesNotMatch(markup, /Expand selected node/);
    assert.match(markup, /60 nodes \/ 200 connections \/ 50/);
    assert.match(markup, /Hide inspector/);
  }
});
test("graph inspection never renders a stale native inspector while a temporal read is pending", () => {
  const props = {
    graph,
    node,
    selection: { kind: "node" as const, node },
    historical: true,
    matching: false,
    inspectorOpen: true,
    editing,
    onDirty: never,
    onNavigate: never,
    onReceipt: never,
    changed: never,
    disabled: true,
  };
  assert.doesNotMatch(render(createElement(GraphInspection, props)), /Native history inspector/);
  assert.match(render(createElement(GraphInspection, { ...props, matching: true })), /REQ/);
  const layout = render(
    createElement(GraphSurface, {
      inspectorOpen: false,
      actions: createElement("span", null, "Actions"),
      canvas: createElement("span", null, "Canvas"),
      inspector: createElement("span", null, "Inspection"),
    }),
  );
  assert.match(layout, /graph-layout canvas-only/);
  assert.match(layout, /Actions/);
  assert.match(layout, /Canvas/);
  assert.match(layout, /Inspection/);
});

test("graph canvas executes self/duplicate edge geometry with separate stable identities and no writes", async () => {
  const { GraphCanvas } = await import("./legacy-ui/components/graph-canvas.tsx");
  const links = ["link-one", "link-two"].map((id) => ({
    id,
    version: 1,
    type: "references",
    source: node.id,
    target: node.id,
    fields: {},
  }));
  const markup = render(
    createElement(GraphCanvas, {
      graph: { ...graph, links },
      selectedEdge: "link:link-one",
      onNode: never,
      onEdge: never,
    }),
  );
  assert.equal((markup.match(/data-edge="link:link-/g) ?? []).length, 2);
  assert.match(markup, /data-edge="link:link-one"[^>]*aria-pressed="true"/);
  assert.match(markup, /Connection: REQ → REQ/);
  assert.match(markup, /class="edge-line" marker-end="url\(#[^"]+-arrow\)"/);
  assert.match(markup, /<title>references · ordinary relationship<\/title>/);
  assert.doesNotMatch(markup, /NaN|undefined/);
});
test("graph inspector owns captured native editing and unselected instructions without invoking actions", async () => {
  const { GraphInspector } = await import("./legacy-ui/components/graph-inspector.tsx");
  const props = {
    graph,
    editing,
    onDirty: never,
    onNavigate: never,
    onReceipt: never,
    changed: never,
    disabled: false,
  };
  const markup = render(createElement(GraphInspector, { ...props, node }));
  assert.match(markup, /Captured statement/);
  assert.match(markup, /version 2/);
  assert.match(markup, /No visible connections/);
  assert.match(markup, /disabled="">Save node/);
  assert.match(
    render(createElement(GraphInspector, props)),
    /Select a node or connection to explore its meaning/,
  );
});
