import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";

const origin = { actor: "test" };
async function fixture(work: (tracer: Tracer) => Promise<void>) {
  const repo = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repo);
    await tracer.setSchema(
      {
        entityTypes: {
          source: { fields: { title: { type: "string", required: true } } },
          target: { fields: {} },
        },
        relationshipTypes: { connects: { source: ["source"], target: ["target"], fields: {} } },
      },
      0,
      origin,
    );
    await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: [
          {
            op: "entity.create",
            id: "00000000-0000-4000-8000-000000000001",
            input: { type: "source", fields: { title: "Source" } },
          },
          {
            op: "entity.create",
            id: "00000000-0000-4000-8000-000000000002",
            input: { type: "target", fields: {} },
          },
          {
            op: "entity.create",
            id: "00000000-0000-4000-8000-000000000003",
            input: { type: "target", fields: {} },
          },
        ],
      },
      origin,
    );
    await work(tracer);
  } finally {
    repo.close();
  }
}
const query = {
  sourceType: "source",
  targetType: "target",
  relationshipType: "connects",
  limit: 1,
};
test("matrix coverage includes targets outside the current page, and projections reflect shared edits", () =>
  fixture(async (tracer) => {
    const first = await tracer.getMatrix(query),
      source = first.sources.items[0],
      hiddenTarget = "00000000-0000-4000-8000-000000000003";
    assert.deepEqual(first.missingSourceIds, [source.id]);
    assert.ok(first.targets.nextAfter);
    const link = await tracer.createRelationship(
      { type: "connects", source: source.id, target: hiddenTarget, fields: {} },
      1,
      origin,
    );
    const covered = await tracer.getMatrix(query);
    assert.deepEqual(covered.links, []);
    assert.deepEqual(covered.missingSourceIds, []);
    const next = await tracer.getMatrix({ ...query, targetAfter: first.targets.nextAfter });
    assert.equal(next.links[0].id, link.id);
    await tracer.updateEntity(source.id, 1, { fields: { title: "Edited in table" } }, 1, origin);
    assert.equal(
      (await tracer.getTable({ type: "source" })).entities.items[0].fields.title,
      "Edited in table",
    );
    assert.equal((await tracer.getMatrix(query)).sources.items[0].fields.title, "Edited in table");
    await tracer.removeRelationship(link.id, 1, 1, origin);
    assert.deepEqual((await tracer.getMatrix(query)).missingSourceIds, [source.id]);
  }));
test("view queries validate bounds, type names, endpoint semantics, and filters", () =>
  fixture(async (tracer) => {
    await assert.rejects(tracer.getTable({ type: "unknown" }), { code: "validation" });
    await assert.rejects(tracer.getMatrix({ ...query, limit: 26 }), { code: "validation" });
    await assert.rejects(tracer.getMatrix({ ...query, sourceType: "target" }), {
      code: "validation",
    });
    await assert.rejects(tracer.getMatrix({ ...query, relationshipType: "toString" }), {
      code: "validation",
    });
    await assert.rejects(
      tracer.getMatrix({ ...query, sourceAfter: 42 } as unknown as typeof query),
      { code: "validation" },
    );
  }));
test("duplicate links remain first-class and matrix overflow fails instead of hiding links", () =>
  fixture(async (tracer) => {
    const input = {
      type: "connects",
      source: "00000000-0000-4000-8000-000000000001",
      target: "00000000-0000-4000-8000-000000000002",
      fields: {},
    };
    await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: Array.from({ length: 1000 }, () => ({ op: "relationship.create", input })),
      },
      origin,
    );
    assert.equal((await tracer.getMatrix(query)).links.length, 1000);
    await tracer.createRelationship(input, 1, origin);
    await assert.rejects(tracer.getMatrix(query), { code: "validation" });
  }));
