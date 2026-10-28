import test from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/application/service.ts";
import { prepareReceipt, captureReceipt } from "../src/application/receipt-capture.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import type { Entity } from "../src/core/model.ts";

const actor = { actor: "application-composition-qa", reason: "Synthetic kernel proof" };
async function fixture(
  work: (tracer: Tracer, repository: SQLiteRepository, criterion: Entity) => Promise<void>,
) {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    await tracer.setSchema(
      { entityTypes: { item: { fields: { title: { type: "string" } } } }, relationshipTypes: {} },
      0,
      actor,
    );
    const criterion = await tracer.createEntity(
      { type: "item", fields: { title: "Acceptance criterion" } },
      1,
      actor,
    );
    await work(tracer, repository, criterion);
  } finally {
    repository.close();
  }
}

test("transaction-local assessment capture records post-proposal native state in the same commit", () =>
  fixture(async (tracer, repository, criterion) => {
    const output: Entity = {
      id: crypto.randomUUID(),
      type: "item",
      version: 1,
      fields: { title: "Simulated assessment" },
    };
    const intent = {
      outputId: output.id,
      expectedOutputVersion: 1,
      outcome: "SIMULATED result under declared criterion",
      inputs: [{ entityId: criterion.id, fields: ["title"], role: "criterion" }],
    };
    const prepared = prepareReceipt(intent);
    intent.inputs[0].fields[0] = "unselected";
    const before = (await tracer.timeline()).head;
    const receipt = await repository.transaction(async (tx) => {
      await tx.beginChangeset(crypto.randomUUID(), 1, actor);
      await tx.save("entity", output, 0);
      return captureReceipt(tx, prepared, actor, () => crypto.randomUUID());
    });
    assert.equal((await tracer.timeline()).head, before + 1);
    assert.deepEqual(receipt.output, output);
    assert.deepEqual(receipt.inputs[0].fields, ["title"]);
    assert.equal(receipt.inputs[0].role, "criterion");
    assert.deepEqual(await tracer.evidence.getReceipt(receipt.id), receipt);
    assert.equal((await tracer.evidence.compareReceipt(receipt.id)).state, "current");
  }));

test("transaction-local capture failure rolls back staged native identity and permits corrected reuse", () =>
  fixture(async (tracer, repository, criterion) => {
    const output: Entity = {
      id: crypto.randomUUID(),
      type: "item",
      version: 1,
      fields: { title: "Candidate assessment" },
    };
    const before = await tracer.exportProject();
    const stage = async (inputId: string) =>
      repository.transaction(async (tx) => {
        await tx.beginChangeset(crypto.randomUUID(), 1, actor);
        await tx.save("entity", output, 0);
        return captureReceipt(
          tx,
          prepareReceipt({
            outputId: output.id,
            outcome: "SIMULATED result",
            inputs: [{ entityId: inputId }],
          }),
          actor,
          () => crypto.randomUUID(),
        );
      });
    await assert.rejects(stage(crypto.randomUUID()), { code: "not_found" });
    assert.deepEqual(await tracer.exportProject(), before);
    const corrected = await stage(criterion.id);
    assert.equal(corrected.output.id, output.id);
    assert.equal((await tracer.timeline()).head, before.projectRevision + 1);
    assert.equal((await tracer.evidence.list("receipt")).items.length, 1);
  }));
