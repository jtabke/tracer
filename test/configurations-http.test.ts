import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Configuration } from "../src/core/configuration.ts";
import type { Receipt } from "../src/core/evidence.ts";

test("configuration and historical-input HTTP boundaries enforce origin/session, exact shapes and resolved pins", async () => {
  const repo = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repo);
  const actor = { actor: "http-test" };
  await tracer.setSchema(
    { entityTypes: { item: { fields: { title: { type: "string" } } } }, relationshipTypes: {} },
    0,
    actor,
  );
  const entity = await tracer.createEntity({ type: "item", fields: { title: "Old" } }, 1, actor);
  await tracer.updateEntity(entity.id, 1, { fields: { title: "New" } }, 1, actor);
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  try {
    const { token } = (await (await fetch(server.origin + "/api/session")).json()) as {
      token: string;
    };
    const headers = {
      "Content-Type": "application/json",
      Origin: server.origin,
      "X-Tracer-Token": token,
    };
    const post = (path: string, value: unknown, extra = {}) =>
      fetch(server.origin + path, {
        method: "POST",
        headers: { ...headers, ...extra },
        body: JSON.stringify(value),
      });
    const input = {
      name: "Old build",
      subjectId: entity.id,
      expectedSubjectVersion: 2,
      members: [{ entityId: entity.id, version: 1 }],
    };
    const history = await tracer.history();
    assert.equal(
      (await post("/api/configurations", input, { Origin: "https://elsewhere.example" })).status,
      403,
    );
    assert.equal(
      (await post("/api/configurations", input, { "X-Tracer-Token": "wrong" })).status,
      403,
    );
    assert.equal((await post("/api/configurations", { ...input, unexpected: true })).status, 400);
    assert.equal(
      (await post("/api/configurations", { ...input, expectedSubjectVersion: 1 })).status,
      409,
    );
    assert.equal((await fetch(server.origin + "/api/configurations?after=bad")).status, 400);
    assert.equal((await fetch(server.origin + "/api/configurations?unexpected=1")).status, 400);
    assert.equal((await fetch(server.origin + "/api/configurations?limit=1&limit=2")).status, 400);
    const saved = (await (await post("/api/configurations", input)).json()) as Configuration;
    assert.equal(saved.members[0].entity.fields.title, "Old");
    const receipt = (await (
      await post("/api/receipts", {
        outputId: entity.id,
        expectedOutputVersion: 2,
        configurationId: saved.id,
        outcome: "Illustrative",
        inputs: [{ entityId: entity.id }],
      })
    ).json()) as Receipt;
    assert.equal(receipt.configuration?.id, saved.id);
    assert.equal(receipt.inputs[0].pin?.entity.version, 1);
    assert.equal(
      (
        await post("/api/receipts", {
          outputId: entity.id,
          configurationId: 2,
          outcome: "Bad",
          inputs: [{ entityId: entity.id }],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post("/api/receipts", {
          outputId: entity.id,
          outcome: "Bad",
          inputs: [{ entityId: entity.id, revision: 1, expectedVersion: 2 }],
        })
      ).status,
      400,
    );
    assert.deepEqual(await tracer.history(), history);
    assert.deepEqual(
      (await (await fetch(server.origin + "/api/configurations?subject=" + entity.id)).json())
        .items,
      [saved],
    );
  } finally {
    await server.close();
    repo.close();
  }
});

test("exact configuration HTTP reads preserve an off-page immutable capture after current subject removal", async () => {
  const repo = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repo),
    actor = { actor: "exact-capture-http" };
  await tracer.setSchema(
    { entityTypes: { item: { fields: { title: { type: "string" } } } }, relationshipTypes: {} },
    0,
    actor,
  );
  const subject = await tracer.createEntity(
    { type: "item", fields: { title: "Captured statement" } },
    1,
    actor,
  );
  const input = {
    name: "Repeated capture name",
    subjectId: subject.id,
    expectedSubjectVersion: 1,
    members: [{ entityId: subject.id, version: 1 }],
  };
  for (let index = 0; index < 26; index++) await tracer.configurations.capture(input, actor);
  const original = await tracer.configurations.capture(input, actor);
  await tracer.updateEntity(
    subject.id,
    1,
    { fields: { title: "Current changed statement" } },
    1,
    actor,
  );
  await tracer.removeEntity(subject.id, 2, 1, actor);
  const history = await tracer.history();
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  try {
    const page = await (await fetch(`${server.origin}/api/configurations?limit=25`)).json();
    assert.equal(
      page.items.some((value: Configuration) => value.id === original.id),
      false,
    );
    const result = await fetch(
      `${server.origin}/api/configuration?id=${encodeURIComponent(original.id)}`,
    );
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), original);
    for (const query of ["", "?id=", "?id=x&id=y", "?id=x&subject=y"])
      assert.equal((await fetch(`${server.origin}/api/configuration${query}`)).status, 400);
    assert.equal((await fetch(`${server.origin}/api/configuration?id=missing`)).status, 404);
    assert.deepEqual(await tracer.history(), history);
  } finally {
    await server.close();
    repo.close();
  }
});
