import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { recordedConnections } from "../src/application/recorded-connections.ts";
import type { Transaction } from "../src/persistence/contracts.ts";
import type { SchemaObject, Relationship } from "../src/core/model.ts";

const schema: SchemaObject = {
  id: "project",
  version: 1,
  entityTypes: { note: { fields: { title: { type: "string" } } } },
  relationshipTypes: { ref: { fields: {} } },
};
test("recorded page deduplicates endpoints and exposes unavailable summaries without inferred types", async () => {
  const reads: string[] = [];
  const links = Array.from({ length: 25 }, (_, i): Relationship => ({
    id: String(i),
    type: "ref",
    source: "a",
    target: "missing",
    fields: {},
    version: 1,
  }));
  const tx = {
    async query(kind, filters) {
      assert.equal(kind, "relationship");
      assert.deepEqual(filters, { type: "ref", limit: 25 });
      return { items: links, nextAfter: "cursor" };
    },
    async get(kind, id) {
      assert.equal(kind, "entity");
      reads.push(id);
      return id === "a"
        ? {
            id,
            type: "note",
            key: "N-01",
            fields: { title: "Recognizable", hidden: "not projected" },
            version: 2,
          }
        : undefined;
    },
  } as Transaction;
  const result = await recordedConnections(tx, schema, { type: "ref" });
  assert.deepEqual(reads, ["a", "missing"]);
  assert.deepEqual(result.endpoints, [
    { id: "a", type: "note", key: "N-01", title: "Recognizable" },
  ]);
  assert.equal(result.relationships.nextAfter, "cursor");
  assert.equal(result.relationships.items.length, 25);
});
test("recorded relation service bounds, exact filter and page endpoint facts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tracer-recorded-test-"));
  const repo = new SQLiteRepository(join(dir, "project.sqlite"));
  const tracer = new Tracer(repo);
  const actor = { actor: "test" };
  try {
    await tracer.setSchema(schema, 0, actor);
    const a = await tracer.createEntity(
      { type: "note", key: "N-01", fields: { title: "First" } },
      1,
      actor,
    );
    const b = await tracer.createEntity({ type: "note", fields: {} }, 1, actor);
    for (let i = 0; i < 26; i++)
      await tracer.createRelationship(
        { type: "ref", source: a.id, target: b.id, fields: {} },
        1,
        actor,
      );
    const first = await tracer.getRecordedConnections({ type: "ref" });
    assert.equal(first.relationships.items.length, 25);
    assert.equal(first.endpoints.length, 2);
    assert.equal(first.endpoints.find((item) => item.id === a.id)?.title, "First");
    const second = await tracer.getRecordedConnections({
      type: "ref",
      after: first.relationships.nextAfter,
    });
    assert.equal(second.relationships.items.length, 1);
    await assert.rejects(
      async () => tracer.getRecordedConnections({ type: "ref", limit: 26 }),
      /at most 25/,
    );
    await assert.rejects(
      async () => tracer.getRecordedConnections({ type: "unknown" }),
      /Unknown relationship/,
    );
    await assert.rejects(
      async () => tracer.getRecordedConnections({ type: "ref", source: a.id } as never),
      /need a relationship type/,
    );
  } finally {
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
