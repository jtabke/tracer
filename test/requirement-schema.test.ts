import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import type { Fields, Schema } from "../src/core/model.ts";

const origin = { actor: "req001-verification", reason: "REQ-001 AC-1 and AC-2" };
const schema: Schema = {
  entityTypes: {
    test_article: {
      fields: {
        title: { type: "string", required: true },
        threshold: { type: "number", required: true },
        enabled: { type: "boolean", required: true },
        metadata: { type: "json", required: true },
        note: { type: "string" },
        offset: { type: "number" },
        retired: { type: "boolean" },
        extra: { type: "json" },
      },
    },
  },
  relationshipTypes: {},
};
const fields: Fields = {
  title: "Calibration article α",
  threshold: 0,
  enabled: false,
  metadata: { conditions: ["bench", 23.5, true, null], nested: { units: "W" } },
};

test("REQ-001 AC-1: custom required and optional field definitions and values survive database reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-req001-")),
    path = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(path);
  try {
    const tracer = new Tracer(repository);
    await tracer.setSchema({ schema, expectedVersion: 0, provenance: origin });
    const minimal = await tracer.createEntity({ type: "test_article", fields }, 1, origin);
    const complete = await tracer.createEntity(
      {
        type: "test_article",
        fields: {
          ...fields,
          note: "Optional annotation",
          offset: -0.5,
          retired: true,
          extra: null,
        },
      },
      1,
      origin,
    );
    const before = await tracer.exportProject();
    repository.close();
    repository = new SQLiteRepository(path);
    const reopened = new Tracer(repository);
    assert.deepEqual(await reopened.exportProject(), before);
    assert.deepEqual((await reopened.getSchema())?.entityTypes, schema.entityTypes);
    assert.deepEqual((await reopened.getEntity(minimal.id)).fields, fields);
    assert.deepEqual(await reopened.getEntity(complete.id), complete);
  } finally {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("REQ-001 AC-2: rejected definitions, values, updates and batches leave native history and evidence untouched", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    await tracer.setSchema(schema, 0, origin);
    const existing = await tracer.createEntity({ type: "test_article", fields }, 1, origin);
    const before = await tracer.exportProject();
    const badSchemas = [
      { ...schema, entityType: {} },
      {
        ...schema,
        entityTypes: { test_article: { ...schema.entityTypes.test_article, field: {} } },
      },
      {
        ...schema,
        entityTypes: { test_article: { fields: { title: { type: "string", requred: true } } } },
      },
    ];
    for (const invalid of badSchemas) {
      await assert.rejects(tracer.setSchema(invalid as Schema, 1, origin), { code: "validation" });
      assert.deepEqual(await tracer.exportProject(), before);
    }
    const badFields: Fields[] = [
      { ...fields, title: 12 },
      { ...fields, threshold: "20" },
      { ...fields, enabled: "false" },
      { ...fields, threshold: Number.NaN },
      { ...fields, unexpected: "discarding this would be a silent error" },
    ];
    for (const missing of ["title", "threshold", "enabled", "metadata"]) {
      const incomplete = { ...fields };
      delete incomplete[missing];
      badFields.push(incomplete);
    }
    for (const invalid of badFields) {
      await assert.rejects(
        tracer.createEntity({ type: "test_article", fields: invalid }, 1, origin),
        { code: "validation" },
      );
      await assert.rejects(
        tracer.updateEntity(existing.id, existing.version, { fields: invalid }, 1, origin),
        { code: "validation" },
      );
      assert.deepEqual(await tracer.exportProject(), before);
    }
    await assert.rejects(
      tracer.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: [
            { op: "entity.create", input: { type: "test_article", key: "ROLLBACK", fields } },
            {
              op: "entity.create",
              input: { type: "test_article", fields: { ...fields, enabled: 1 } },
            },
          ],
        },
        origin,
      ),
      { code: "validation" },
    );
    assert.deepEqual(await tracer.exportProject(), before);
  } finally {
    repository.close();
  }
});
