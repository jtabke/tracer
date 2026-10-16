import test from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import type { Repository } from "../src/persistence/contracts.ts";
import type { Operation } from "../src/application/commands.ts";

test("public native projection guards preserve synchronous versus rejected-Promise behavior before opening a transaction", async () => {
  let transactions = 0;
  const repository: Repository = {
    transaction: async () => {
      transactions++;
      throw new Error("Unexpected native transaction");
    },
    close() {},
  };
  const tracer = new Tracer(repository);
  const synchronous = [
    { call: () => tracer.getGraph(null as never), message: "Invalid graph query" },
    {
      call: () => tracer.getGraph({ rootId: "missing", compareRevision: 1 }),
      message: "Comparison requires a target revision",
    },
    {
      call: () => tracer.getGraph({ rootId: "missing", compareRevision: Infinity }),
      message: "Comparison requires a target revision",
    },
    {
      call: () => tracer.getChain({ type: 1, steps: [], limit: 0 } as never),
      message: "Invalid chain query",
    },
    {
      call: () => tracer.getConnections({ id: 1, limit: 0 } as never),
      message: "Connections need an item ID",
    },
    {
      call: () => tracer.getRecordedConnections({ type: 1, limit: 0 } as never),
      message: "Recorded connections need a relationship type",
    },
    {
      call: () => tracer.getWorkingSet({ field: "title", unexpected: true } as never),
      message: "Invalid query filter: unexpected",
    },
  ];
  for (const { call, message } of synchronous) assert.throws(call, { code: "validation", message });
  const asynchronous = [
    { call: () => tracer.getTable(null as never), message: "Query must be an object" },
    {
      call: () => tracer.getTable({ type: 1, limit: 0 } as never),
      message: "Invalid query filter: type",
    },
    {
      call: () =>
        tracer.getMatrix({ sourceType: 1, targetType: 1, relationshipType: 1, limit: 0 } as never),
      message: "Matrix page limit must be 1–25 per axis",
    },
    {
      call: () => tracer.getMatrix({ sourceType: 1, limit: 0, unexpected: true } as never),
      message: "Invalid matrix query",
    },
    {
      call: () => tracer.queryEntities({ limit: null } as never),
      message: "Page limit must be 1–1000",
    },
    {
      call: () => tracer.history({ kind: "invalid", limit: 0 } as never),
      message: "Page limit must be 1–1000",
    },
    { call: () => tracer.changesets(-1, 0), message: "Page limit must be 1–1000" },
  ];
  for (const { call, message } of asynchronous) {
    const result = call();
    assert.ok(result instanceof Promise);
    await assert.rejects(result, { code: "validation", message });
  }
  assert.equal(transactions, 0);
});

test("native table and matrix preserve focus/cursor precedence, nullish matrix defaults and consistent read-only pages", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository),
    actor = { actor: "native-query-contract" };
  const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
  try {
    const schema = await tracer.setSchema(
      {
        entityTypes: { item: { fields: { title: { type: "string" } } } },
        relationshipTypes: { references: { fields: {}, source: ["item"], target: ["item"] } },
      },
      0,
      actor,
    );
    const operations: Operation[] = Array.from({ length: 22 }, (_, index) => ({
      op: "entity.create",
      id: id(index + 1),
      input: { type: "item", fields: { title: `Item ${index + 1}` } },
    }));
    await tracer.applyChangeset({ expectedSchemaVersion: 1, operations }, actor);
    const history = await tracer.history(),
      head = (await tracer.timeline()).head;
    await assert.rejects(tracer.getTable({ type: "unknown", focusId: id(22), after: id(1) }), {
      code: "validation",
      message: "Unknown entity type",
    });
    await assert.rejects(tracer.getTable({ type: "item", focusId: id(22), after: id(1) }), {
      code: "validation",
      message: "Use either focus or page cursor",
    });
    const focused = await tracer.getTable({ type: "item", focusId: id(22) });
    assert.deepEqual(focused.schema, schema);
    assert.deepEqual(
      focused.entities.items.map((item) => item.id),
      [id(22)],
    );
    const query = { sourceType: "item", targetType: "item", relationshipType: "references" };
    const matrix = await tracer.getMatrix({ ...query, limit: null as never });
    assert.deepEqual(matrix.schema, schema);
    assert.equal(matrix.sources.items.length, 20);
    assert.equal(matrix.targets.items.length, 20);
    assert.ok(matrix.sources.nextAfter);
    assert.deepEqual(matrix.links, []);
    await assert.rejects(tracer.getMatrix({ ...query, sourceFocus: id(22), sourceAfter: id(1) }), {
      code: "validation",
      message: "Use either focus or page cursor",
    });
    await assert.rejects(tracer.getMatrix({ ...query, relationshipType: "toString" }), {
      code: "validation",
      message: "Unknown matrix type",
    });
    const earlier = await tracer.history({ after: "01:01" });
    assert.deepEqual(
      earlier.items.map((revision) => revision.id),
      operations.map((operation) => operation.id),
    );
    assert.deepEqual(await tracer.history(), history);
    assert.equal((await tracer.timeline()).head, head);
    assert.deepEqual((await tracer.evidence.list("receipt")).items, []);
  } finally {
    repository.close();
  }
});
