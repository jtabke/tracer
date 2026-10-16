import "./register-ui.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Graph } from "../src/application/views.ts";
const { NativeInspector } = await import("./legacy-ui/components/native-inspector.tsx");

const node = {
  id: "item",
  key: "REQ-1",
  type: "item",
  version: 2,
  fields: { title: "Native <statement>" },
};
const graph: Graph = {
  schema: {
    id: "project",
    version: 1,
    entityTypes: { item: { fields: {} } },
    relationshipTypes: {},
  },
  rootId: node.id,
  nodes: [node],
  links: [],
  expanded: [],
  evaluations: [],
  external: [],
  temporal: { at: { id: "at", projectRevision: 4, schemaVersion: 1, actor: "test", at: "then" } },
};
const render = (props: Parameters<typeof NativeInspector>[0]) =>
  renderToStaticMarkup(createElement(NativeInspector, props));

test("native inspector distinguishes no selection from an absent captured object", () => {
  const empty = render({ graph });
  assert.match(empty, /Select a node or native connection/);
  assert.doesNotMatch(empty, /selected object is absent/);
  const absent = render({ graph, hasSelection: true });
  assert.match(absent, /selected object is absent/);
  const snapshot = render({ graph, node });
  assert.match(snapshot, /REQ-1/);
  assert.match(snapshot, /&quot;version&quot;: 2/);
  assert.match(snapshot, /Native &lt;statement&gt;/);
  assert.doesNotMatch(snapshot, /<button|<input|<select/);
});

test("native inspector renders before/after absence without importing current evidence", () => {
  const compared: Graph = {
    ...graph,
    differences: {
      nodes: [{ id: node.id, state: "removed", before: node, after: null }],
      links: [],
    },
  };
  const markup = render({ graph: compared, node });
  assert.match(markup, /removed/);
  assert.match(markup, /Not present at this revision/);
  assert.match(markup, /current freshness are excluded/);
});
