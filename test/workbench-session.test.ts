import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceSession } from "../ui/workbench/workspace-session.ts";
import type { WorkspaceEntity, WorkspaceRelationship } from "../ui/workbench/workspace-snapshot.ts";

type Data = Parameters<typeof createWorkspaceSession>[0];
const entity: WorkspaceEntity = {
  id: "entity-id",
  key: "A",
  type: "item",
  fields: { title: "Recorded" },
  version: 1,
  title: "Recorded",
  statement: "",
};
const link: WorkspaceRelationship = {
  id: "link-id",
  type: "references",
  source: "A",
  target: "B",
  fields: {},
  version: 1,
  scope: "",
};
function data(head = 2, record = entity): Data {
  const metadata = {
    revisionId: "revision-id",
    changesetId: "changeset-id",
    ordinal: 0,
    schemaVersion: 1,
    version: 1,
  };
  return {
    schema: { version: 1, entityTypes: {}, relationshipTypes: {} },
    snapshotReference: { revision: head, historicalSnapshotsLoaded: true },
    entities: [record],
    relationships: [link],
    revisions: [
      { ...metadata, kind: "entity", id: record.id, projectRevision: 1, snapshot: record },
      { ...metadata, kind: "relationship", id: link.id, projectRevision: 2, snapshot: link },
    ],
    changesets: [],
    trace: { root: "A", keys: ["A", "B"], links: [link] },
  };
}
function state() {
  return {
    revision: 1,
    event: 1,
    assessment: 1,
    evidenceEpoch: 3,
    readBlocked: true,
    matrixDraft: { version: 1, title: "Retained proposal" },
    localEntities: new Map<string, WorkspaceEntity>(),
    localLinks: new Map<string, WorkspaceRelationship>(),
    removed: new Set<string>(),
  };
}

for (const reason of ["saved", "refreshed", "pending-inspected", "editor-inspected"] as const) {
  test(`${reason} adopts one snapshot while preserving its assessment/evidence policy and caller-owned guards`, () => {
    const workspace = createWorkspaceSession(data());
    const current = state();
    const draft = current.matrixDraft;
    const next = data(4);
    workspace.adopt(next, reason, current);
    assert.equal(workspace.data, next);
    assert.equal(workspace.head, 4);
    assert.equal(current.revision, 4);
    assert.equal(current.event, 4);
    assert.equal(current.assessment, reason === "saved" ? 4 : 1);
    assert.equal(current.evidenceEpoch, reason === "editor-inspected" ? 3 : 4);
    assert.equal(current.readBlocked, true);
    assert.equal(current.matrixDraft, draft);
  });
}

test("adoption invalidates cached historical revisions even when the loaded head is unchanged", () => {
  const workspace = createWorkspaceSession(data());
  const current = state();
  assert.equal(workspace.model(current).records.get("A"), entity);
  const replacement = { ...entity, title: "Freshly loaded" };
  workspace.adopt(data(2, replacement), "refreshed", current);
  current.revision = 1;
  assert.equal(workspace.model(current).records.get("A"), replacement);
});

test("local overlays apply only at the head without changing cached recorded snapshots", () => {
  const workspace = createWorkspaceSession(data());
  const current = state();
  const local = { ...entity, title: "Local proposal" };
  const localLink = { ...link, id: "local-link" };
  current.localEntities.set("A", local);
  current.localLinks.set(localLink.id, localLink);
  current.removed.add(link.id);
  current.revision = 2;
  const proposed = workspace.model(current);
  assert.equal(proposed.records.get("A"), local);
  assert.deepEqual(proposed.links, [localLink]);
  proposed.records.clear();
  current.revision = 1;
  assert.equal(workspace.model(current).records.get("A"), entity);
  assert.deepEqual(workspace.model(current).links, []);
  current.revision = 2;
  current.localEntities.clear();
  current.localLinks.clear();
  current.removed.clear();
  assert.equal(workspace.model(current).records.get("A"), entity);
  assert.deepEqual(workspace.model(current).links, [link]);
  assert.equal(workspace.data.entities[0], entity);
});
