import test from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";

const actor = { actor: "temporal-test" };
async function fixture(work: (tracer: Tracer) => Promise<void>) {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    await tracer.setSchema(
      {
        entityTypes: { item: { fields: { title: { type: "string" } } } },
        relationshipTypes: { references: { fields: {} } },
      },
      0,
      actor,
    );
    await work(tracer);
  } finally {
    repository.close();
  }
}
const create = (tracer: Tracer, key: string) =>
  tracer.createEntity({ type: "item", key, fields: { title: key } }, 1, actor);

test("native snapshots use complete changesets, schema versions and tombstones; evidence never enters history", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "ROOT"),
      input = await create(tracer, "INPUT"),
      receiptOnly = await create(tracer, "RECEIPT-ONLY");
    const link = await tracer.createRelationship(
      { type: "references", source: root.id, target: input.id, fields: {} },
      1,
      actor,
    );
    const old = (await tracer.timeline()).head;
    await tracer.evidence.recordReceipt(
      { outputId: root.id, outcome: "Conclusion", inputs: [{ entityId: receiptOnly.id }] },
      actor,
    );
    assert.equal((await tracer.timeline()).head, old);
    await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: [
          {
            op: "entity.update",
            id: root.id,
            expectedVersion: 1,
            input: { fields: { title: "Intermediate" } },
          },
          {
            op: "entity.update",
            id: root.id,
            expectedVersion: 2,
            input: { fields: { title: "Final" } },
          },
          { op: "entity.remove", id: input.id, expectedVersion: 1, cascade: true },
        ],
      },
      actor,
    );
    const head = (await tracer.timeline()).head;
    const before = await tracer.getGraph({ rootId: root.id, atRevision: old });
    assert.deepEqual(before.nodes.map((item) => item.key).sort(), ["INPUT", "ROOT"]);
    assert.equal(before.nodes.find((item) => item.id === root.id)?.version, 1);
    assert.equal(before.links[0].id, link.id);
    assert.deepEqual(before.evaluations, []);
    assert.deepEqual(before.external, []);
    const after = await tracer.getGraph({ rootId: root.id, atRevision: head });
    assert.equal(after.nodes[0].fields.title, "Final");
    assert.equal(after.nodes[0].version, 3);
    assert.equal(after.links.length, 0);
    assert.equal((await tracer.getGraph({ rootId: input.id, atRevision: head })).nodes.length, 0);
    assert.equal((await tracer.getGraph({ rootId: root.id, atRevision: 1 })).nodes.length, 0);
    const diff = await tracer.getGraph({ rootId: root.id, atRevision: head, compareRevision: old });
    assert.equal(diff.differences?.nodes.find((item) => item.id === root.id)?.state, "modified");
    assert.equal(diff.differences?.nodes.find((item) => item.id === input.id)?.state, "removed");
    assert.equal(diff.differences?.links[0].state, "removed");
    assert.equal((await tracer.timeline()).head, head);
    await tracer.setSchema(
      {
        entityTypes: { item: { fields: { title: { type: "string" }, note: { type: "string" } } } },
        relationshipTypes: { references: { fields: {} } },
      },
      1,
      actor,
    );
    assert.equal((await tracer.getGraph({ rootId: root.id, atRevision: old })).schema.version, 1);
    assert.equal(
      (await tracer.getGraph({ rootId: root.id, atRevision: head + 1 })).schema.version,
      2,
    );
    for (const value of [0, -1, 1.5, NaN, head + 2])
      await assert.rejects(tracer.getGraph({ rootId: root.id, atRevision: value }), {
        code: "validation",
      });
    assert.throws(() => tracer.getGraph({ rootId: root.id, compareRevision: old }), {
      code: "validation",
    });
  }));

test("relinked neighborhoods distinguish membership changes from native object additions", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "ROOT"),
      a = await create(tracer, "A"),
      b = await create(tracer, "B");
    const link = await tracer.createRelationship(
      { type: "references", source: root.id, target: a.id, fields: {} },
      1,
      actor,
    );
    const old = (await tracer.timeline()).head;
    await tracer.updateRelationship(
      link.id,
      1,
      { type: "references", source: root.id, target: b.id, fields: {} },
      1,
      actor,
    );
    const head = (await tracer.timeline()).head;
    const historical = await tracer.getGraph({ rootId: a.id, atRevision: old });
    assert.equal(historical.links.length, 1);
    assert.equal((await tracer.getGraph({ rootId: a.id, atRevision: head })).links.length, 0);
    const diff = await tracer.getGraph({ rootId: root.id, atRevision: head, compareRevision: old });
    assert.equal(diff.differences?.links[0].state, "modified");
    assert.equal(diff.differences?.links[0].before?.target, a.id);
    assert.equal(diff.differences?.links[0].after?.target, b.id);
    assert.ok(diff.differences?.nodes.every((item) => item.state === "unchanged"));
    const newNode = await create(tracer, "NEW");
    await tracer.createRelationship(
      { type: "references", source: root.id, target: newNode.id, fields: {} },
      1,
      actor,
    );
    const added = await tracer.getGraph({
      rootId: root.id,
      atRevision: (await tracer.timeline()).head,
      compareRevision: old,
    });
    assert.equal(added.differences?.nodes.find((item) => item.id === newNode.id)?.state, "added");
  }));

test("shared focus anchors table and both matrix axes beyond their first pages", () =>
  fixture(async (tracer) => {
    const ids = Array.from(
      { length: 65 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: ids.map((id, index) => ({
          op: "entity.create",
          id,
          input: { type: "item", key: `ITEM-${index}`, fields: {} },
        })),
      },
      actor,
    );
    const focus = ids[60];
    await assert.rejects(tracer.getTable(null as never), { code: "validation" });
    assert.equal(
      (await tracer.getTable({ type: "item", focusId: focus })).entities.items[0].id,
      focus,
    );
    const matrix = await tracer.getMatrix({
      sourceType: "item",
      targetType: "item",
      relationshipType: "references",
      sourceFocus: focus,
      targetFocus: focus,
    });
    assert.equal(matrix.sources.items[0].id, focus);
    assert.equal(matrix.targets.items[0].id, focus);
    await assert.rejects(tracer.getTable({ type: "item", focusId: focus, after: ids[0] }), {
      code: "validation",
    });
    await assert.rejects(tracer.getTable({ type: "item", focusId: "missing" }), {
      code: "not_found",
    });
    assert.equal(
      (await tracer.getTable({ type: "item", focusId: ids[0] })).entities.items[0].id,
      ids[0],
    );
  }));

test("timeline windows paginate complete native revisions without evidence or read side effects", () =>
  fixture(async (tracer) => {
    for (let index = 0; index < 204; index++) await create(tracer, "ITEM-" + index);
    const latest = await tracer.timeline();
    assert.equal(latest.head, 205);
    assert.equal(latest.items.length, 200);
    assert.equal(latest.items[0].projectRevision, 6);
    const earlier = await tracer.timeline(latest.nextBefore);
    assert.deepEqual(
      earlier.items.map((item) => item.projectRevision),
      [1, 2, 3, 4, 5],
    );
    assert.equal(earlier.nextBefore, undefined);
    assert.equal((await tracer.timeline()).head, 205);
    for (const cursor of [0, -1, 207, 1.5])
      await assert.rejects(tracer.timeline(cursor), { code: "validation" });
  }));

test("comparison union overflow is explicit even when each native neighborhood fits", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "ROOT");
    const oldLinks = [];
    for (let index = 0; index < 30; index++) {
      const node = await create(tracer, "OLD-" + index);
      oldLinks.push(
        await tracer.createRelationship(
          { type: "references", source: root.id, target: node.id, fields: {} },
          1,
          actor,
        ),
      );
    }
    const before = (await tracer.timeline()).head;
    await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: oldLinks.map((link) => ({
          op: "relationship.remove",
          id: link.id,
          expectedVersion: 1,
        })),
      },
      actor,
    );
    for (let index = 0; index < 30; index++) {
      const node = await create(tracer, "NEW-" + index);
      await tracer.createRelationship(
        { type: "references", source: root.id, target: node.id, fields: {} },
        1,
        actor,
      );
    }
    const after = (await tracer.timeline()).head;
    assert.equal((await tracer.getGraph({ rootId: root.id, atRevision: before })).nodes.length, 31);
    assert.equal((await tracer.getGraph({ rootId: root.id, atRevision: after })).nodes.length, 31);
    await assert.rejects(
      tracer.getGraph({ rootId: root.id, atRevision: after, compareRevision: before }),
      { code: "validation" },
    );
  }));
