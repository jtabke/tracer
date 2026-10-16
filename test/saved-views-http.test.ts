import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

test("saved-view HTTP commands enforce session/origin, exact fields and version guards without native changes", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  await tracer.setSchema({ entityTypes: { item: { fields: {} } }, relationshipTypes: {} }, 0, {
    actor: "test",
  });
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  try {
    const { token } = (await (await fetch(server.origin + "/api/session")).json()) as {
      token: string;
    };
    const input = {
      name: "Item scope",
      definition: { kind: "chain", type: "item", steps: [] },
      expectedVersion: 0,
      expectedSchemaVersion: 1,
    };
    const history = await tracer.changesets();
    const headers = {
      "Content-Type": "application/json",
      Origin: server.origin,
      "X-Tracer-Token": token,
    };
    const post = (path: string, body: unknown, extra = {}) =>
      fetch(server.origin + path, {
        method: "POST",
        headers: { ...headers, ...extra },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await post("/api/saved-views", input, { "X-Tracer-Token": "wrong" })).status,
      403,
    );
    assert.equal(
      (await post("/api/saved-views", input, { Origin: "https://elsewhere.example" })).status,
      403,
    );
    assert.equal((await fetch(server.origin + "/api/saved-views?limit=5")).status, 400);
    assert.deepEqual(await tracer.savedViews.list(), []);
    const saved = (await (await post("/api/saved-views", input)).json()) as {
      id: string;
      version: number;
    };
    assert.equal(saved.version, 1);
    const update = { ...input, id: saved.id, name: "Updated", expectedVersion: 1 };
    assert.equal((await post("/api/saved-views", update)).status, 200);
    assert.equal((await post("/api/saved-views", update)).status, 409);
    assert.equal(
      (await post("/api/saved-views/remove", { id: saved.id, expectedVersion: 1 })).status,
      409,
    );
    assert.equal(
      (
        await post("/api/saved-views/remove", {
          id: saved.id,
          expectedVersion: 2,
          unexpected: true,
        })
      ).status,
      400,
    );
    assert.equal(
      (await post("/api/saved-views/remove", { id: saved.id, expectedVersion: 2 })).status,
      200,
    );
    assert.deepEqual(await tracer.savedViews.list(), []);
    assert.deepEqual(await tracer.changesets(), history);
  } finally {
    await server.close();
    repository.close();
  }
});
