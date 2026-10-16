import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

const actor = { actor: "baseline-http-qa" };

test("baseline HTTP capture enforces origin/session and exact shapes; stable-ID retry is exact without native history writes", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  await tracer.setSchema(
    { entityTypes: { item: { fields: { title: { type: "string" } } } }, relationshipTypes: {} },
    0,
    actor,
  );
  const entity = await tracer.createEntity(
    { type: "item", fields: { title: "Captured native statement" } },
    1,
    actor,
  );
  const head = (await tracer.timeline()).head;
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  try {
    const { token } = await (await fetch(server.origin + "/api/session")).json();
    const headers = {
      "Content-Type": "application/json",
      Origin: server.origin,
      "X-Tracer-Token": token,
    };
    const post = (value: unknown, extra = {}) =>
      fetch(server.origin + "/api/baselines", {
        method: "POST",
        headers: { ...headers, ...extra },
        body: JSON.stringify(value),
      });
    const proposal = {
      id: "http-retry-identity",
      name: "Native project baseline",
      expectedProjectRevision: head,
    };
    const before = await tracer.history();
    assert.equal((await post(proposal, { Origin: "https://elsewhere.example" })).status, 403);
    assert.equal((await post(proposal, { "X-Tracer-Token": "wrong" })).status, 403);
    assert.equal((await post({ ...proposal, unexpected: true })).status, 400);
    assert.equal((await post({ ...proposal, expectedProjectRevision: head - 1 })).status, 409);
    const captured = await post(proposal);
    assert.equal(captured.status, 200);
    const baseline = await captured.json();
    assert.equal(baseline.projectRevision, head);
    assert.equal(baseline.capturedAtProjectRevision, head);
    assert.deepEqual(await tracer.history(), before);
    await tracer.updateEntity(
      entity.id,
      1,
      { fields: { title: "Current later statement" } },
      1,
      actor,
    );
    const laterHistory = await tracer.history(),
      laterHead = (await tracer.timeline()).head;
    const retry = await post(proposal);
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), baseline);
    assert.equal((await post({ ...proposal, name: "Different intent" })).status, 409);
    assert.deepEqual((await tracer.baselines.list()).items, [baseline]);
    const contents = await (
      await fetch(
        `${server.origin}/api/baseline-contents?baselineId=${baseline.id}&kind=entity&limit=1`,
      )
    ).json();
    assert.deepEqual(contents.baseline, baseline);
    assert.equal(contents.schema.version, 1);
    assert.deepEqual(contents.objects.items, [entity]);
    assert.equal(contents.objects.nextAfter, undefined);
    assert.deepEqual(await tracer.history(), laterHistory);
    assert.equal((await tracer.timeline()).head, laterHead);
    assert.deepEqual((await tracer.evidence.list("receipt")).items, []);
  } finally {
    await server.close();
    repository.close();
  }
});

test("baseline exact reads and scoped contents cursors reject ambiguous query shapes and preserve immutable historical deletions", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  await tracer.setSchema(
    { entityTypes: { item: { fields: {} } }, relationshipTypes: { references: { fields: {} } } },
    0,
    actor,
  );
  const a = await tracer.createEntity({ type: "item", fields: {} }, 1, actor),
    b = await tracer.createEntity({ type: "item", fields: {} }, 1, actor);
  const relationship = await tracer.createRelationship(
    { type: "references", source: a.id, target: b.id, fields: {} },
    1,
    actor,
  );
  const baseline = await tracer.baselines.capture(
    { name: "Historical endpoints", expectedProjectRevision: (await tracer.timeline()).head },
    actor,
  );
  await tracer.removeEntity(b.id, 1, 1, actor, true);
  const before = await tracer.history();
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  try {
    const get = (path: string) => fetch(server.origin + path);
    const exact = await get(`/api/baseline?id=${baseline.id}`);
    assert.equal(exact.status, 200);
    assert.deepEqual(await exact.json(), baseline);
    const page = await (
      await get(`/api/baseline-contents?baselineId=${baseline.id}&kind=entity&limit=1`)
    ).json();
    assert.equal(page.objects.items.length, 1);
    assert.ok(page.objects.nextAfter);
    const remaining = await (
      await get(
        `/api/baseline-contents?baselineId=${baseline.id}&kind=entity&limit=1&after=${encodeURIComponent(page.objects.nextAfter)}`,
      )
    ).json();
    assert.deepEqual(
      [...page.objects.items, ...remaining.objects.items]
        .map((entity: { id: string }) => entity.id)
        .sort(),
      [a.id, b.id].sort(),
    );
    const links = await (
      await get(`/api/baseline-contents?baselineId=${baseline.id}&kind=relationship`)
    ).json();
    assert.deepEqual(links.objects.items, [relationship]);
    for (const query of ["", "?id=", "?id=x&id=y", `?id=${baseline.id}&unexpected=1`])
      assert.equal((await get(`/api/baseline${query}`)).status, 400);
    assert.equal((await get("/api/baseline?id=missing")).status, 404);
    for (const query of [
      "?after=-1",
      "?after=01",
      "?after=1.0",
      "?limit=0",
      "?limit=101",
      "?limit=1&limit=2",
      "?subject=x",
    ])
      assert.equal((await get(`/api/baselines${query}`)).status, 400);
    for (const suffix of [
      "&kind=schema",
      "&kind=entity&kind=relationship",
      "&kind=entity&limit=1001",
      "&kind=entity&source=x",
      "&kind=entity&after=bad",
      `&kind=relationship&after=${encodeURIComponent(page.objects.nextAfter)}`,
    ])
      assert.equal(
        (await get(`/api/baseline-contents?baselineId=${baseline.id}${suffix}`)).status,
        400,
      );
    assert.equal((await get("/api/baseline-contents?baselineId=missing&kind=entity")).status, 404);
    assert.deepEqual(await tracer.history(), before);
    assert.deepEqual((await tracer.baselines.list()).items, [baseline]);
  } finally {
    await server.close();
    repository.close();
  }
});
