import test from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/index.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";

const actor = { actor: "next-work verification", reason: "Explain declared relationship drift" };

test("next-work evidence counts include directly captured relationships after edit and removal", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    await tracer.setSchema(
      {
        entityTypes: { item: { fields: { title: { type: "string" } } } },
        relationshipTypes: { depends_on: { fields: { scope: { type: "string" } } } },
      },
      0,
      actor,
    );
    const source = await tracer.createEntity(
      { type: "item", fields: { title: "Design" } },
      1,
      actor,
    );
    const target = await tracer.createEntity(
      { type: "item", fields: { title: "Definition" } },
      1,
      actor,
    );
    const link = await tracer.createRelationship(
      { type: "depends_on", source: source.id, target: target.id, fields: { scope: "Original" } },
      1,
      actor,
    );
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: source.id,
        outcome: "Fixture result; engineering success is not inferred",
        inputs: [],
        relationshipInputs: [{ id: link.id, role: "Explicit dependency" }],
      },
      actor,
    );
    assert.equal((await tracer.getNextWork()).queues.changedEvidence.items.length, 0);
    const edited = await tracer.updateRelationship(
      link.id,
      link.version,
      {
        type: link.type,
        source: link.source,
        target: link.target,
        fields: { scope: "Revised definition scope" },
      },
      1,
      actor,
    );
    for (const removed of [false, true]) {
      if (removed) await tracer.removeRelationship(edited.id, edited.version, 1, actor);
      const before = await tracer.exportProject();
      const comparison = await tracer.evidence.compareReceipt(receipt.id);
      assert.equal(comparison.hasChanged, true);
      assert.equal(comparison.hasUnknown, removed);
      const queues = (await tracer.getNextWork()).queues;
      const row = queues.changedEvidence.items.find((item) => item.receiptId === receipt.id);
      assert.ok(row, "The changed relationship must remain in the changed-evidence queue");
      assert.equal(
        row.changedInputs,
        1,
        "The qualifying directly captured relationship is counted",
      );
      assert.equal(row.unknownInputs, removed ? 1 : 0);
      const review = queues.reviews.items.find((item) => item.receiptId === receipt.id);
      assert.deepEqual(review, row, "Both queues explain the same captured-input state");
      assert.equal(row.outcome, receipt.outcome);
      assert.match(queues.changedEvidence.explanation, /dependency links/);
      assert.deepEqual(
        await tracer.exportProject(),
        before,
        "Queue and comparison reads do not write",
      );
    }
  } finally {
    repository.close();
  }
});
