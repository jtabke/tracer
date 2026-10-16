import test from "node:test";
import assert from "node:assert/strict";
import type { Graph } from "../src/application/views.ts";
import type { Entity, Relationship } from "../src/core/model.ts";
import {
  visibleGraph,
  resolveSelection,
  resolveFocusNode,
  shouldAdoptSharedFocus,
} from "./legacy-ui/components/graph-state.ts";
import type { Selection } from "./legacy-ui/components/graph-state.ts";

const node: Entity = { id: "root", type: "item", version: 1, fields: { title: "Captured" } };
const link: Relationship = {
  id: "link",
  type: "references",
  source: node.id,
  target: node.id,
  version: 1,
  fields: {},
};
const schema: Graph["schema"] = {
  id: "project",
  version: 1,
  entityTypes: { item: { fields: {} } },
  relationshipTypes: { references: { fields: {} } },
};
const live: Graph = {
  schema,
  rootId: node.id,
  expanded: [node.id],
  nodes: [node],
  links: [link],
  evaluations: [
    {
      receipt: {
        id: "receipt",
        actor: "test",
        at: "now",
        outcome: "Recorded",
        output: node,
        schema,
        inputs: [],
      },
      comparison: {
        receiptId: "receipt",
        state: "current",
        hasChanged: false,
        hasUnknown: false,
        inputs: [],
        token: "token",
        review: { state: "unreviewed" },
        supersededBy: [],
      },
    },
  ],
  external: [
    {
      identity: {
        id: node.id,
        system: "file",
        externalId: "stable-file",
        ownership: "external",
        actor: "test",
        at: "now",
      },
      observation: null,
    },
  ],
};
const past: Graph = {
  ...live,
  evaluations: [],
  external: [],
  temporal: {
    at: { id: "changeset", projectRevision: 2, schemaVersion: 1, actor: "test", at: "then" },
  },
  differences: { nodes: [{ id: node.id, before: null, after: node, state: "added" }], links: [] },
};
const selectedNode: Selection = { kind: "node", node };
const selectedEdge: Selection = {
  kind: "edge",
  edge: {
    id: "link:link",
    source: node.id,
    target: node.id,
    name: link.type,
    relationshipId: link.id,
    relationship: link,
    phase: "before",
  },
};

test("visible graph retains current drafts, but not across roots or temporal boundaries", () => {
  assert.equal(visibleGraph(undefined, node.id, "/current", false), undefined);
  const loaded = { endpoint: "/current", graph: live };
  assert.equal(visibleGraph(loaded, "other-root", "/current", false), undefined);
  assert.equal(visibleGraph(loaded, node.id, "/current", false), live);
  assert.equal(visibleGraph(loaded, node.id, "/expanded", false), live);
  const placeholder = visibleGraph(loaded, node.id, "/past", true)!;
  assert.equal(placeholder.rootId, node.id);
  for (const field of ["nodes", "links", "evaluations", "external"] as const)
    assert.deepEqual(placeholder[field], []);
  assert.deepEqual(live.nodes, [node]);
  assert.equal(live.evaluations.length, 1);
});

test("pending historical changes and return to current preserve only canvas identity", () => {
  const loaded = { endpoint: "/past", graph: past };
  assert.equal(visibleGraph(loaded, node.id, "/past", true), past);
  for (const historical of [true, false]) {
    const placeholder = visibleGraph(loaded, node.id, "/another-boundary", historical)!;
    assert.equal(placeholder.rootId, node.id);
    assert.deepEqual(placeholder.nodes, []);
    assert.deepEqual(placeholder.links, []);
    assert.equal(placeholder.differences, undefined);
  }
});

test("selection prefers loaded nodes; stale snapshots and shared focus are current-only", () => {
  const refreshed = { ...node, version: 2, fields: { title: "Refreshed" } };
  const graph = { ...live, nodes: [refreshed] };
  for (const historical of [true, false])
    assert.equal(resolveSelection(graph, selectedNode, historical).node, refreshed);
  assert.equal(resolveSelection({ ...graph, nodes: [] }, selectedNode, false).node, node);
  assert.equal(resolveSelection(undefined, selectedNode, true).node, undefined);
  assert.equal(resolveSelection({ ...graph, nodes: [] }, selectedNode, true).node, undefined);
  assert.equal(resolveSelection(graph, undefined, false, node.id).node, refreshed);
  assert.equal(resolveSelection(graph, undefined, true, node.id).node, undefined);
  assert.equal(resolveSelection(graph, selectedEdge, false, node.id).node, undefined);
});

test("historical edges resolve native snapshots only; deleted edges and receipt overlays never fall back", () => {
  const updated = { ...link, version: 2 };
  const graph = { ...past, links: [updated] };
  assert.equal(resolveSelection(graph, selectedEdge, false).edge, selectedEdge.edge);
  const edge = resolveSelection(graph, selectedEdge, true).edge!;
  assert.equal(edge.relationship, updated);
  assert.equal(edge.phase, "before");
  assert.equal(resolveSelection({ ...graph, links: [] }, selectedEdge, true).edge, undefined);
  assert.equal(resolveSelection(undefined, selectedEdge, true).edge, undefined);
  assert.equal(
    resolveSelection(
      live,
      {
        kind: "edge",
        edge: {
          id: "dependency",
          source: node.id,
          target: node.id,
          name: "evaluated using",
          receiptId: "receipt",
        },
      },
      true,
    ).edge,
    undefined,
  );
});

test("graph focus resolution uses the exact identity and shared adoption respects drafts, visibility and native time", () => {
  const refreshed = { ...node, version: 2 };
  assert.equal(resolveFocusNode([refreshed], live, selectedNode, node.id), refreshed);
  assert.equal(resolveFocusNode([], live, selectedNode, node.id), node);
  assert.equal(resolveFocusNode([], undefined, selectedNode, node.id), node);
  assert.equal(resolveFocusNode([], undefined, selectedNode, "other"), undefined);
  assert.equal(resolveFocusNode([], undefined, selectedEdge, node.id), undefined);
  assert.equal(shouldAdoptSharedFocus(true, { id: node.id }, false, undefined, false), true);
  assert.equal(shouldAdoptSharedFocus(true, { id: node.id }, false, node.id, false), false);
  assert.equal(shouldAdoptSharedFocus(false, { id: node.id }, false, undefined, false), false);
  assert.equal(shouldAdoptSharedFocus(true, undefined, false, undefined, false), false);
  assert.equal(shouldAdoptSharedFocus(true, { id: node.id }, true, undefined, false), false);
  assert.equal(shouldAdoptSharedFocus(true, { id: node.id }, false, undefined, true), false);
});
