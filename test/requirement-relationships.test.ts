import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import type { Schema } from "../src/core/model.ts";
const origin = { actor: "req002-verification", reason: "REQ-002 AC-1 and AC-2" };
const schema: Schema = {
  entityTypes: { need: { fields: {} }, component: { fields: {} }, other: { fields: {} } },
  relationshipTypes: {
    allocated_to: {
      source: ["need"],
      target: ["component"],
      fields: { rationale: { type: "string" } },
    },
    unrestricted: { fields: {} },
    no_sources: { source: [], fields: {} },
    no_targets: { target: [], fields: {} },
    no_endpoints: { source: [], target: [], fields: {} },
    source_only: { source: ["need"], fields: {} },
    target_only: { target: ["component"], fields: {} },
  },
};
async function setup(t: Tracer) {
  await t.setSchema(schema, 0, origin);
  return Promise.all(
    ["need", "component", "other"].map((type) =>
      t.createEntity({ type, key: type.toUpperCase(), fields: {} }, 1, origin),
    ),
  );
}

test("REQ-002 AC-1: permitted directed links retain UUID, endpoints and revisions after update/reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-req002-")),
    path = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(path);
  try {
    const t = new Tracer(repository),
      [source, target] = await setup(t);
    const link = await t.createRelationship(
      {
        type: "allocated_to",
        source: source.id,
        target: target.id,
        fields: { rationale: "Engineering allocation" },
      },
      1,
      origin,
    );
    assert.match(link.id, /^[0-9a-f-]{36}$/);
    assert.equal(link.version, 1);
    const edited = await t.updateRelationship(
      link.id,
      1,
      { ...link, fields: { rationale: "Reviewed allocation" } },
      1,
      origin,
    );
    assert.equal(edited.id, link.id);
    assert.equal(edited.version, 2);
    assert.equal(edited.source, source.id);
    assert.equal(edited.target, target.id);
    assert.deepEqual((await t.queryRelationships({ source: source.id, target: target.id })).items, [
      edited,
    ]);
    assert.deepEqual(
      (await t.queryRelationships({ source: target.id, target: source.id })).items,
      [],
    );
    const before = await t.exportProject();
    repository.close();
    repository = new SQLiteRepository(path);
    const reopened = new Tracer(repository);
    assert.deepEqual(await reopened.exportProject(), before);
    assert.deepEqual(await reopened.getRelationship(link.id), edited);
    assert.deepEqual((await reopened.getSchema())?.relationshipTypes, schema.relationshipTypes);
  } finally {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("REQ-002 AC-2: directed, unrestricted, one-sided and explicitly empty endpoint rules enforce the declared matrix", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const t = new Tracer(repository),
      entities = await setup(t);
    const expected: Record<string, string[]> = {
      allocated_to: ["need>component"],
      unrestricted: [
        "need>need",
        "need>component",
        "need>other",
        "component>need",
        "component>component",
        "component>other",
        "other>need",
        "other>component",
        "other>other",
      ],
      no_sources: [],
      no_targets: [],
      no_endpoints: [],
      source_only: ["need>need", "need>component", "need>other"],
      target_only: ["need>component", "component>component", "other>component"],
    };
    for (const [type, pairs] of Object.entries(expected))
      for (const source of entities)
        for (const target of entities) {
          const input = { type, source: source.id, target: target.id, fields: {} };
          if (pairs.includes(`${source.type}>${target.type}`)) {
            const link = await t.createRelationship(input, 1, origin);
            assert.deepEqual(await t.getRelationship(link.id), link);
          } else {
            const before = await t.exportProject();
            await assert.rejects(
              t.createRelationship(input, 1, origin),
              { code: "validation" },
              `${type}: ${source.type}>${target.type}`,
            );
            assert.deepEqual(await t.exportProject(), before);
          }
        }
    const resource = await t.createEntity(
      { type: "@resource", fields: {}, resource: { label: "Supporting document" } },
      1,
      origin,
    );
    const before = await t.exportProject();
    for (const [source, target] of [
      [resource, entities[0]],
      [entities[0], resource],
    ]) {
      await assert.rejects(
        t.createRelationship(
          { type: "unrestricted", source: source.id, target: target.id, fields: {} },
          1,
          origin,
        ),
        { code: "validation" },
      );
      assert.deepEqual(await t.exportProject(), before);
    }
  } finally {
    repository.close();
  }
});

test("REQ-002 AC-2: invalid endpoint edits, model changes, entity reclassification and mixed batches cannot bypass rules", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const t = new Tracer(repository),
      [source, target, other] = await setup(t);
    const link = await t.createRelationship(
      { type: "allocated_to", source: source.id, target: target.id, fields: {} },
      1,
      origin,
    );
    const before = await t.exportProject();
    for (const patch of [
      { source: target.id, target: source.id },
      { source: other.id },
      { target: other.id },
    ]) {
      await assert.rejects(
        t.updateRelationship(link.id, link.version, { ...link, ...patch }, 1, origin),
        { code: "validation" },
      );
      assert.deepEqual(await t.exportProject(), before);
    }
    const constrained = structuredClone(schema);
    constrained.relationshipTypes.allocated_to.target = [];
    await assert.rejects(t.setSchema(constrained, 1, origin), { code: "validation" });
    assert.deepEqual(await t.exportProject(), before);
    await assert.rejects(
      t.updateEntity(source.id, source.version, { type: "other", fields: {} }, 1, origin),
      { code: "validation" },
    );
    assert.deepEqual(await t.exportProject(), before);
    await assert.rejects(
      t.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: [
            { op: "entity.create", input: { type: "need", key: "ROLLBACK", fields: {} } },
            {
              op: "relationship.create",
              input: { type: "allocated_to", source: target.id, target: source.id, fields: {} },
            },
          ],
        },
        origin,
      ),
      { code: "validation" },
    );
    assert.deepEqual(await t.exportProject(), before);
    const unknownType = structuredClone(schema);
    unknownType.relationshipTypes.allocated_to.source = ["missing_type"];
    await assert.rejects(t.setSchema(unknownType, 1, origin), { code: "validation" });
    await assert.rejects(
      t.createRelationship({ ...link, source: crypto.randomUUID() }, 1, origin),
      { code: "referential_integrity" },
    );
    assert.deepEqual(await t.exportProject(), before);
  } finally {
    repository.close();
  }
});
