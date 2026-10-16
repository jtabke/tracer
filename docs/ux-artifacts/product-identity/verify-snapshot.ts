import assert from "node:assert/strict";
import { test } from "node:test";
import { projectWorkspace } from "./workspace-snapshot.ts";
import type { Entity, Relationship, Revision } from "../../../src/core/model.ts";
import type { ProjectSnapshot } from "../../../src/core/project-snapshot.ts";

test("presentation preserves deleted endpoint identities, history order and original native objects", () => {
  const source: Entity = {
    id: "source",
    key: "SPEC-01",
    type: "spec",
    version: 1,
    fields: { title: "A specification" },
  };
  const removed: Entity = {
    id: "removed",
    key: "RESULT-01",
    type: "result",
    version: 1,
    fields: { title: "An earlier result", measured: 12 },
  };
  const link: Relationship = {
    id: "link",
    source: source.id,
    target: removed.id,
    type: "supports",
    fields: { scope: "Temperature" },
    version: 1,
  };
  const revision = (
    kind: Revision["kind"],
    value: Entity | Relationship,
    number: number,
    deleted = false,
  ): Revision => ({
    kind,
    id: value.id,
    snapshot: deleted ? null : value,
    projectRevision: number,
    ordinal: 0,
    changesetId: `change-${number}`,
    schemaVersion: 1,
    version: deleted ? 2 : 1,
    revisionId: `revision-${number}`,
  });
  const revisions = [
    revision("entity", removed, 4, true),
    revision("relationship", link, 3),
    revision("entity", source, 1),
    revision("entity", removed, 2),
  ];
  const snapshot: ProjectSnapshot = {
    schema: null,
    projectRevision: 4,
    entities: [source],
    relationships: [],
  };
  const original = structuredClone({ snapshot, revisions });
  const projected = projectWorkspace(snapshot, revisions, [], source.key);
  const historicalLink = projected.revisions.find((entry) => entry.id === "link")
    ?.snapshot as unknown as Relationship;
  assert.equal(historicalLink.source, "SPEC-01");
  assert.equal(historicalLink.target, "RESULT-01");
  assert.deepEqual(
    projected.revisions.map((entry) => entry.projectRevision),
    [1, 2, 3, 4],
  );
  assert.equal(projected.revisions.at(-1)?.snapshot, null);
  assert.deepEqual(projected.entities[0].fields, source.fields);
  assert.deepEqual({ snapshot, revisions }, original);
  assert.deepEqual(projected.trace.keys, ["SPEC-01"]);
});

test("unkeyed artifacts retain canonical ID fallback and generic neighborhoods stay bounded", () => {
  const entities: Entity[] = Array.from({ length: 12 }, (_, i) => ({
    id: `artifact-${i}`,
    type: "generic",
    fields: {},
    version: 1,
  }));
  const relationships: Relationship[] = entities.slice(1).map((value, index) => ({
    id: `link-${index}`,
    type: "connects",
    source: entities[0].id,
    target: value.id,
    fields: {},
    version: 1,
  }));
  const result = projectWorkspace(
    { schema: null, projectRevision: 1, entities, relationships },
    [],
    [],
  );
  assert.equal(result.entities[0].key, entities[0].id);
  assert.equal(result.entities[0].title, entities[0].id);
  assert.equal(result.trace.keys.length, 8);
  assert.equal(new Set(result.trace.keys).size, 8);
  assert.equal(result.trace.links.length, 7);
  assert.ok(result.trace.links.every((link) => result.trace.keys.includes(link.target)));
});
