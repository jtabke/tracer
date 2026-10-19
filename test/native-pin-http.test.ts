import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { decodeRead } from "../src/interfaces/api-endpoints.ts";

test("exact native revision reads preserve historical fields/schema after removal without recording evidence", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository),
    actor = { actor: "native-pin-http" };
  await tracer.setSchema(
    { entityTypes: { item: { fields: { title: { type: "string" } } } }, relationshipTypes: {} },
    0,
    actor,
  );
  const entity = await tracer.createEntity(
    { type: "item", key: "ITEM-1", fields: { title: "Original statement" } },
    1,
    actor,
  );
  const original = await tracer.getNativePin(entity.id, 1);
  await tracer.setSchema(
    {
      entityTypes: { item: { fields: { title: { type: "string" }, notes: { type: "string" } } } },
      relationshipTypes: {},
    },
    1,
    actor,
  );
  await tracer.updateEntity(
    entity.id,
    1,
    { fields: { title: "Changed statement", notes: "Later schema only" } },
    2,
    actor,
  );
  await tracer.removeEntity(entity.id, 2, 2, actor);
  const history = await tracer.history(),
    captures = await tracer.configurations.list(),
    receipts = await tracer.evidence.list("receipt");
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  try {
    const response = await fetch(server.origin + "/api/native-pin?id=" + entity.id + "&version=1");
    assert.equal(response.status, 200);
    const pin = decodeRead("/api/native-pin", { id: entity.id, version: 1 }, await response.json());
    assert.deepEqual(pin, original);
    assert.equal(pin.entity.fields.title, "Original statement");
    assert.equal(pin.schema.version, 1);
    assert.deepEqual(Object.keys(pin.schema.entityTypes.item.fields), ["title"]);
    for (const query of [
      "id=&version=1",
      "id=" + entity.id,
      "id=" + entity.id + "&version=0",
      "id=" + entity.id + "&version=1.5",
      "id=" + entity.id + "&version=01",
      "id=" + entity.id + "&version=1&version=2",
      "id=" + entity.id + "&id=" + entity.id + "&version=1",
      "id=" + entity.id + "&version=1&extra=1",
      "id=" + entity.id + "&version=9007199254740992",
    ])
      assert.equal((await fetch(server.origin + "/api/native-pin?" + query)).status, 400, query);
    assert.equal(
      (await fetch(server.origin + "/api/native-pin?id=" + entity.id + "&version=3")).status,
      404,
    );
    assert.equal((await fetch(server.origin + "/api/native-pin?id=missing&version=1")).status, 404);
    assert.deepEqual(await tracer.history(), history);
    assert.deepEqual(await tracer.configurations.list(), captures);
    assert.deepEqual(await tracer.evidence.list("receipt"), receipts);
  } finally {
    await server.close();
    repository.close();
  }
});
