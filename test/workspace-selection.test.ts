import test from "node:test";
import assert from "node:assert/strict";
import { workspaceSelection } from "./legacy-ui/components/workspace-selection.ts";
import type { Entity, Relationship } from "../src/core/model.ts";
import type { FamilyWorkspace } from "../src/application/views.ts";

test("loaded inspector selection refreshes by identity; failed/omitted context retains but does not authorize the draft", () => {
  const entity: Entity = { id: "item", type: "item", version: 1, fields: { title: "Draft base" } };
  const current = { ...entity, version: 2, fields: { title: "Current" } };
  const link: Relationship = {
    id: "link",
    version: 1,
    type: "maps",
    source: "item",
    target: "peer",
    fields: {},
  };
  const snapshot: FamilyWorkspace = {
    schema: {
      id: "project",
      version: 1,
      entityTypes: { item: { fields: {} } },
      relationshipTypes: {},
    },
    projectRevision: 3,
    root: current,
    members: [current],
    membership: [],
    connections: [],
    nodes: [current],
    links: [link],
  };
  assert.deepEqual(workspaceSelection(snapshot, entity), {
    current,
    currentLink: undefined,
    loaded: true,
  });
  assert.equal(entity.version, 1);
  assert.deepEqual(workspaceSelection(undefined, entity, link), {
    current: entity,
    currentLink: link,
    loaded: false,
  });
  assert.equal(workspaceSelection({ ...snapshot, nodes: [] }, entity).loaded, false);
  assert.equal(workspaceSelection({ ...snapshot, links: [] }, entity, link).loaded, false);
  assert.equal(workspaceSelection(snapshot, entity, link).loaded, true);
  assert.equal(workspaceSelection(snapshot).loaded, true);
});
