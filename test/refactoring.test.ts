import test from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { validateProvenance } from "../src/core/model.ts";

test("native and evidence boundaries share JSON-safe provenance validation without writes on failure", async () => {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository);
  try {
    await tracer.setSchema({ entityTypes: { item: { fields: {} } }, relationshipTypes: {} }, 0, {
      actor: "test",
    });
    const entity = await tracer.createEntity({ type: "item", fields: {} }, 1, { actor: "test" });
    const update = {
      expectedSchemaVersion: 1,
      operations: [
        { op: "entity.update" as const, id: entity.id, expectedVersion: 1, input: { fields: {} } },
      ],
    };
    const binding = {
      entityId: entity.id,
      system: "file" as const,
      externalId: "stable-file",
      ownership: "external" as const,
    };
    for (const invalid of [
      null,
      {},
      { actor: 1 },
      { actor: " " },
      { actor: "\ud800" },
      { actor: "test", reason: 1 },
      { actor: "test", reason: "\ud800" },
    ]) {
      await assert.rejects(async () => tracer.applyChangeset(update, invalid as never), {
        code: "validation",
      });
      await assert.rejects(async () => tracer.evidence.bindExternal(binding, invalid as never), {
        code: "validation",
      });
    }
    assert.equal((await tracer.timeline()).head, 2);
    assert.deepEqual((await tracer.evidence.list("external")).items, []);
    assert.deepEqual(validateProvenance({ actor: " actor " }), { actor: " actor " });
    const origin = { actor: " actor ", reason: "" };
    assert.deepEqual(validateProvenance(origin), origin);
    const native = await tracer.applyChangeset(update, origin);
    assert.equal(native.changeset.reason, "");
    const receipt = await tracer.evidence.recordReceipt(
      { outputId: entity.id, outcome: "valid", inputs: [{ entityId: entity.id }] },
      origin,
    );
    assert.equal(receipt.reason, "");
    const external = await tracer.evidence.bindExternal(binding, origin);
    assert.equal(external.actor, origin.actor);
    assert.equal(Object.hasOwn(external, "reason"), false);
    assert.equal((await tracer.timeline()).head, 3);
  } finally {
    repository.close();
  }
});
