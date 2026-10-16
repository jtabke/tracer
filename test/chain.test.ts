import { test } from "node:test";
import assert from "node:assert/strict";
import { chainFixture } from "./chain-fixture.ts";

const steps = [
  { type: "requirement", relationshipType: "derives" },
  { type: "output", relationshipType: "verifies" },
];
test("incoming columns preserve stored direction, shared parents and endpoint constraints", async () => {
  const f = await chainFixture();
  try {
    const head = (await f.tracer.timeline()).head;
    const chain = await f.tracer.getChain({
      type: "requirement",
      search: "R1",
      steps: [{ type: "need", relationshipType: "derives", direction: "incoming" }],
    });
    assert.equal(chain.rows.length, 2);
    assert.ok(
      chain.rows.every(
        (row) =>
          row.cells[0]?.id === f.r1.id &&
          row.links[0]?.target === f.r1.id &&
          row.links[0]?.source === row.cells[1]?.id,
      ),
    );
    assert.deepEqual(
      new Set(chain.rows.map((row) => row.cells[1]?.id)),
      new Set([f.n1.id, f.n2.id]),
    );
    await assert.rejects(
      () =>
        f.tracer.getChain({
          type: "need",
          steps: [{ type: "requirement", relationshipType: "derives", direction: "incoming" }],
        }),
      { code: "validation" },
    );
    await assert.rejects(
      () =>
        f.tracer.getChain({
          type: "requirement",
          steps: [
            { type: "need", relationshipType: "derives", direction: "sideways" as "incoming" },
          ],
        }),
      { code: "validation" },
    );
    assert.equal((await f.tracer.timeline()).head, head);
  } finally {
    f.repository.close();
  }
});
test("chain keeps complete branching paths, shared identity, gaps, duplicates and root pagination without revisions", async () => {
  const f = await chainFixture();
  try {
    const head = (await f.tracer.timeline()).head;
    const chain = await f.tracer.getChain({ type: "need", steps });
    assert.equal(chain.rows.length, 6);
    assert.equal(chain.rows.filter((row) => row.cells[1]?.id === f.r1.id).length, 4);
    assert.ok(
      chain.rows.some((row) => row.cells[0]?.id === f.n3.id && !row.cells[1] && !row.cells[2]),
    );
    assert.ok(chain.rows.some((row) => row.cells[1]?.id === f.r2.id && !row.cells[2]));
    const page = await f.tracer.getChain({ type: "need", steps, limit: 1 });
    assert.ok(page.roots.nextAfter);
    const next = await f.tracer.getChain({
      type: "need",
      steps,
      limit: 1,
      after: page.roots.nextAfter,
    });
    assert.notEqual(page.roots.items[0].id, next.roots.items[0].id);
    assert.equal(
      (await f.tracer.getChain({ type: "need", steps, search: "N1" })).roots.items.length,
      1,
    );
    assert.equal((await f.tracer.timeline()).head, head);
    await f.tracer.createRelationship(
      { type: "derives", source: f.n1.id, target: f.r1.id, fields: {} },
      1,
      { actor: "chain-test" },
    );
    assert.equal((await f.tracer.getChain({ type: "need", steps })).rows.length, 8);
    for (const query of [
      { type: "__proto__", steps },
      { type: "need", steps: [{ type: "output", relationshipType: "derives" }] },
      { type: "need", steps: Array(8).fill(steps[0]) },
      { type: "need", steps, limit: 21 },
      { type: "need", steps, search: "x".repeat(201) },
    ])
      await assert.rejects(async () => f.tracer.getChain(query), { code: "validation" });
  } finally {
    f.repository.close();
  }
});
test("finite columns bound native cycles without suppressing repeated identity", async () => {
  const f = await chainFixture();
  try {
    const schema = await f.tracer.getSchema();
    await f.tracer.setSchema(
      {
        entityTypes: schema!.entityTypes,
        relationshipTypes: {
          ...schema!.relationshipTypes,
          returns: { source: ["output"], target: ["need"], fields: {} },
        },
      },
      1,
      { actor: "chain-test" },
    );
    await f.tracer.createRelationship(
      { type: "returns", source: f.o1.id, target: f.n1.id, fields: {} },
      2,
      { actor: "chain-test" },
    );
    const cycle = [...steps, { type: "need", relationshipType: "returns" }, ...steps];
    const chain = await f.tracer.getChain({ type: "need", search: "N1", steps: cycle });
    assert.ok(
      chain.rows.some((row) => row.cells[0]?.id === f.n1.id && row.cells[3]?.id === f.n1.id),
    );
    assert.ok(chain.rows.every((row) => row.cells.length === 6));
  } finally {
    f.repository.close();
  }
});

test("chain overflow returns no silently truncated branch", async () => {
  const f = await chainFixture();
  try {
    const operations: import("../src/application/commands.ts").Operation[] = [];
    for (let i = 0; i < 301; i++) {
      const id = crypto.randomUUID();
      operations.push(
        {
          op: "entity.create",
          id,
          input: { type: "requirement", key: `DENSE-${i}`, fields: { title: "Child" } },
        },
        {
          op: "relationship.create",
          input: { type: "derives", source: f.n3.id, target: id, fields: {} },
        },
      );
    }
    await f.tracer.applyChangeset(
      { expectedSchemaVersion: 1, operations },
      { actor: "chain-test" },
    );
    await assert.rejects(
      f.tracer.getChain({ type: "need", steps: steps.slice(0, 1), search: "N3" }),
      /300 rows/,
    );
  } finally {
    f.repository.close();
  }
});
