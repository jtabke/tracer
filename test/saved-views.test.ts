import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { viewDefinition } from "../src/core/presentation.ts";
import type { ViewDefinition } from "../src/core/presentation.ts";

const schema = {
  entityTypes: { requirement: { fields: {} }, design: { fields: {} } },
  relationshipTypes: { realized_by: { source: ["requirement"], target: ["design"], fields: {} } },
};
const chain: ViewDefinition = {
  kind: "chain",
  type: "requirement",
  steps: [{ relationshipType: "realized_by", type: "design", direction: "outgoing" }],
};

test("project views persist separately, guard stale updates/deletion and preserve native/evidence history", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-saved-views-"));
  const path = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(path);
  try {
    let tracer = new Tracer(repository);
    await tracer.setSchema(schema, 0, { actor: "test" });
    const root = await tracer.createEntity({ type: "requirement", key: "REQ-1", fields: {} }, 1, {
      actor: "test",
    });
    const output = await tracer.createEntity({ type: "design", fields: {} }, 1, { actor: "test" });
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        expectedOutputVersion: 1,
        inputs: [{ entityId: root.id, expectedVersion: 1 }],
        outcome: "Illustrative",
      },
      { actor: "test" },
    );
    const history = await tracer.changesets();
    const family: ViewDefinition = {
      kind: "family",
      rootId: root.id,
      direction: "outgoing",
      layout: "trace",
      columns: [{ relationshipType: "realized_by", targetType: "design", direction: "outgoing" }],
    };
    const saved = await tracer.savedViews.save({
      name: "Engineering allocation",
      definition: family,
      expectedVersion: 0,
      expectedSchemaVersion: 1,
    });
    await tracer.savedViews.save({
      name: "Goal-to-design path",
      definition: chain,
      expectedVersion: 0,
      expectedSchemaVersion: 1,
    });
    repository.close();
    repository = new SQLiteRepository(path);
    tracer = new Tracer(repository);
    assert.deepEqual(
      (await tracer.savedViews.list()).find((view) => view.id === saved.id),
      saved,
    );
    const updated = await tracer.savedViews.save({
      id: saved.id,
      definition: saved.definition,
      expectedVersion: 1,
      expectedSchemaVersion: 1,
      name: "Revised allocation",
    });
    assert.equal(updated.version, 2);
    await assert.rejects(
      tracer.savedViews.save({ ...saved, expectedVersion: 1, expectedSchemaVersion: 1 }),
      { code: "validation" },
    ); // version is not an accepted command field
    await assert.rejects(
      tracer.savedViews.save({
        id: saved.id,
        name: "Stale",
        definition: family,
        expectedVersion: 1,
        expectedSchemaVersion: 1,
      }),
      { code: "conflict" },
    );
    await assert.rejects(tracer.savedViews.remove(saved.id, 1), { code: "conflict" });
    assert.equal((await tracer.savedViews.list()).length, 2);
    await tracer.savedViews.remove(saved.id, 2);
    await assert.rejects(
      tracer.savedViews.save({
        id: saved.id,
        name: "Restore implicitly",
        definition: family,
        expectedVersion: 2,
        expectedSchemaVersion: 1,
      }),
      { code: "not_found" },
    );
    assert.deepEqual(await tracer.changesets(), history);
    assert.deepEqual(
      (await tracer.evidence.list("receipt", { subject: output.id })).items[0],
      receipt,
    );
    assert.equal((await tracer.savedViews.list()).length, 1);
  } finally {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("format 3 upgrades add presentation storage without rewriting records, revisions or evidence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-view-migration-"));
  const path = join(directory, "project.sqlite");
  const repository = new SQLiteRepository(path);
  try {
    const tracer = new Tracer(repository);
    await tracer.setSchema(schema, 0, { actor: "test" });
    const root = await tracer.createEntity({ type: "requirement", fields: {} }, 1, {
      actor: "test",
    });
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: root.id,
        expectedOutputVersion: 1,
        inputs: [{ entityId: root.id, expectedVersion: 1 }],
        outcome: "Fixture",
      },
      { actor: "test" },
    );
    const history = await tracer.changesets();
    repository.close();
    const old = new DatabaseSync(path);
    old.exec(
      "DROP TABLE receipt_dependencies; DROP INDEX receipt_supersedes; DROP INDEX coverage_source_target; DROP INDEX coverage_target_source; DROP TABLE baselines; DROP TABLE workspace_views; DROP TABLE configurations; UPDATE storage_version SET version=3",
    );
    old.close();
    const upgraded = new SQLiteRepository(path);
    try {
      const next = new Tracer(upgraded);
      assert.deepEqual(await next.changesets(), history);
      assert.deepEqual(
        (await next.evidence.list("receipt", { subject: root.id })).items[0],
        receipt,
      );
      assert.deepEqual(await next.savedViews.list(), []);
      await next.savedViews.save({
        name: "After migration",
        definition: chain,
        expectedVersion: 0,
        expectedSchemaVersion: 1,
      });
      assert.deepEqual(await next.changesets(), history);
    } finally {
      upgraded.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("view recipes reject extra query fields, oversized or duplicate columns and undeclared paths", async () => {
  assert.deepEqual(viewDefinition({ ...chain, search: "   " }), chain);
  assert.throws(() => viewDefinition({ ...chain, after: "page" }), { code: "validation" });
  assert.throws(() => viewDefinition({ ...chain, steps: Array(8).fill(chain.steps[0]) }), {
    code: "validation",
  });
  const column = { relationshipType: "realized_by", targetType: "design", direction: "outgoing" };
  const family = { kind: "family", rootId: "id", layout: "trace", columns: [column, column] };
  assert.throws(() => viewDefinition(family), { code: "validation" });
  assert.throws(() => viewDefinition({ ...family, columns: Array(7).fill(column) }), {
    code: "validation",
  });
  assert.throws(() => viewDefinition({ ...family, columns: [{ ...column, direction: "both" }] }), {
    code: "validation",
  });
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    await tracer.setSchema(schema, 0, { actor: "test" });
    await assert.rejects(
      tracer.savedViews.save({
        name: "Wrong endpoints",
        definition: {
          ...chain,
          steps: [{ type: "requirement", relationshipType: "realized_by", direction: "outgoing" }],
        },
        expectedVersion: 0,
        expectedSchemaVersion: 1,
      }),
      { code: "validation" },
    );
    await assert.rejects(
      tracer.savedViews.save({
        name: "Stale model",
        definition: chain,
        expectedVersion: 0,
        expectedSchemaVersion: 0,
      }),
      { code: "schema_conflict" },
    );
    const saved = await tracer.savedViews.save({
      name: "Valid",
      definition: chain,
      expectedVersion: 0,
      expectedSchemaVersion: 1,
    });
    await tracer.setSchema({ ...schema, relationshipTypes: {} }, 1, { actor: "test" });
    assert.deepEqual((await tracer.savedViews.list())[0], saved);
    await assert.rejects(
      tracer.savedViews.save({
        id: saved.id,
        name: saved.name,
        definition: saved.definition,
        expectedVersion: 1,
        expectedSchemaVersion: 2,
      }),
      { code: "validation" },
    );
  } finally {
    repository.close();
  }
});

test("saved view names and project capacity fail atomically without allocating engineering revisions", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    await tracer.setSchema(schema, 0, { actor: "test" });
    const history = await tracer.changesets();
    for (let i = 0; i < 50; i++)
      await tracer.savedViews.save({
        name: `Path ${i}`,
        definition: chain,
        expectedVersion: 0,
        expectedSchemaVersion: 1,
      });
    await assert.rejects(
      tracer.savedViews.save({
        name: "51st",
        definition: chain,
        expectedVersion: 0,
        expectedSchemaVersion: 1,
      }),
      { code: "validation" },
    );
    await assert.rejects(
      tracer.savedViews.save({
        name: " Path 0 ",
        definition: chain,
        expectedVersion: 0,
        expectedSchemaVersion: 1,
      }),
      { code: "validation" },
    );
    assert.equal((await tracer.savedViews.list()).length, 50);
    assert.deepEqual(await tracer.changesets(), history);
  } finally {
    repository.close();
  }
});
