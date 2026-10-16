import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { request as httpRequest } from "node:http";

test("an exact captured receipt remains readable after its output changes or is removed", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-receipt-http-"));
  const repo = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repo);
  const origin = { actor: "fixture" };
  await tracer.setSchema(
    { entityTypes: { item: { fields: { title: { type: "string" } } } }, relationshipTypes: {} },
    0,
    origin,
  );
  const input = await tracer.createEntity(
    { type: "item", fields: { title: "Original design" } },
    1,
    origin,
  );
  const output = await tracer.createEntity(
    { type: "item", fields: { title: "Original result" } },
    1,
    origin,
  );
  const receipt = await tracer.evidence.recordReceipt(
    { outputId: output.id, outcome: "SIMULATED fail", inputs: [{ entityId: input.id }] },
    origin,
  );
  await tracer.updateEntity(
    output.id,
    1,
    { fields: { title: "Changed result record" } },
    1,
    origin,
  );
  const server = await startLocalServer(tracer, directory, 0);
  try {
    const url = `${server.origin}/api/receipt?receiptId=${receipt.id}`;
    const before = await tracer.history({ kind: "entity", id: output.id });
    assert.deepEqual(await (await fetch(url)).json(), receipt);
    assert.deepEqual(await tracer.history({ kind: "entity", id: output.id }), before);
    await tracer.removeEntity(output.id, 2, 1, origin);
    assert.deepEqual(await (await fetch(url)).json(), receipt);
    assert.equal((await fetch(`${server.origin}/api/receipt?receiptId=missing`)).status, 404);
    assert.equal(
      (await fetch(`${server.origin}/api/receipt?receiptId=${receipt.id}&subject=${input.id}`))
        .status,
      400,
    );
    assert.equal((await fetch(`${server.origin}/api/receipt`)).status, 400);
    assert.equal((await fetch(`${server.origin}/api/receipt?receiptId=`)).status, 400);
  } finally {
    await server.close();
    repo.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("local HTTP mutations share services, preserve conflicts/history, and enforce origin/token/Host", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-http-"));
  const repo = new SQLiteRepository(":memory:");
  writeFileSync(join(directory, "index.html"), "<!doctype html><title>Tracer test</title>");
  const tracer = new Tracer(repo),
    server = await startLocalServer(tracer, directory, 0);
  try {
    const request = (path: string, init?: RequestInit) => fetch(server.origin + path, init);
    const session = (await (await request("/api/session")).json()) as { token: string };
    const headers = {
      "Content-Type": "application/json",
      Origin: server.origin,
      "X-Tracer-Token": session.token,
    };
    const schema = {
      entityTypes: { item: { fields: { title: { type: "string", required: true } } } },
      relationshipTypes: {},
    };
    const schemaRequest = JSON.stringify({ schema, expectedVersion: 0 });
    for (const forbidden of [
      { "Content-Type": "application/json", Origin: server.origin },
      { ...headers, Origin: "https://attacker.example" },
      { ...headers, "Sec-Fetch-Site": "cross-site" },
    ])
      assert.equal(
        (await request("/api/schema", { method: "POST", headers: forbidden, body: schemaRequest }))
          .status,
        403,
      );
    assert.equal(await tracer.getSchema(), undefined);
    assert.equal(
      (await request("/api/schema", { method: "POST", headers, body: schemaRequest })).status,
      200,
    );
    const input = {
      expectedSchemaVersion: 1,
      operations: [
        { op: "entity.create", input: { type: "item", fields: { title: "Created in browser" } } },
      ],
      actor: "spoofed",
    };
    const create = await request("/api/changesets", {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
    const created = (await create.json()) as {
      changeset: { actor: string };
      results: { id: string }[];
    };
    assert.equal(create.status, 200);
    assert.equal(created.changeset.actor, "local-ui");
    const entity = (await tracer.queryEntities()).items[0];
    assert.equal(entity.id, created.results[0].id);
    assert.equal(
      (await (await request("/api/table?type=item")).json()).entities.items[0].fields.title,
      "Created in browser",
    );
    const conflict = await request("/api/changesets", {
      method: "POST",
      headers,
      body: JSON.stringify({
        expectedSchemaVersion: 1,
        operations: [
          {
            op: "entity.update",
            id: entity.id,
            expectedVersion: 0,
            input: { fields: { title: "stale" } },
          },
        ],
      }),
    });
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error, "conflict");
    assert.equal((await tracer.history()).items.length, 2);
    const hostileHostStatus = await new Promise<number>((resolve, reject) => {
      const probe = httpRequest(
        server.origin + "/api/schema",
        { headers: { Host: "attacker.example" } },
        (response) => {
          response.resume();
          resolve(response.statusCode!);
        },
      );
      probe.on("error", reject);
      probe.end();
    });
    assert.equal(hostileHostStatus, 403);
    assert.equal(
      (await request("/api/schema", { headers: { Origin: "https://attacker.example" } })).status,
      403,
    );
    assert.equal(
      (await request("/api/schema", { headers: { "Sec-Fetch-Site": "cross-site" } })).status,
      403,
    );
    const html = await request("/");
    assert.equal(html.status, 200);
    assert.match(html.headers.get("content-security-policy")!, /frame-ancestors 'none'/);
    assert.equal(html.headers.get("access-control-allow-origin"), null);
    assert.equal((await request("/api/table?type=item&limit=1&limit=2")).status, 400);
    assert.equal(
      (await request("/api/changesets", { method: "POST", headers, body: "not-json" })).status,
      400,
    );
    assert.equal((await request("/api/schema", { method: "PUT" })).status, 405);
    assert.equal((await request("/%2e%2e%2fpackage.json")).status, 404);
    assert.equal((await request("/api/unknown")).status, 404);
  } finally {
    await server.close();
    repo.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("bounded projection routes retain exact service queries and errors", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-http-projections-"));
  const repo = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repo);
  const actor = { actor: "projection-route-test" };
  await tracer.setSchema(
    { entityTypes: { note: { fields: {} } }, relationshipTypes: { ref: { fields: {} } } },
    0,
    actor,
  );
  const source = await tracer.createEntity({ type: "note", key: "N-01", fields: {} }, 1, actor);
  const target = await tracer.createEntity({ type: "note", fields: {} }, 1, actor);
  await tracer.createRelationship(
    { type: "ref", source: source.id, target: target.id, fields: {} },
    1,
    actor,
  );
  const server = await startLocalServer(tracer, directory, 0);
  try {
    const cases: [string, unknown][] = [
      ["/api/work?type=note&limit=1", await tracer.getWorkingSet({ type: "note", limit: 1 })],
      [
        `/api/family?rootId=${source.id}&limit=1`,
        await tracer.getFamily({ rootId: source.id, limit: 1 }),
      ],
      [
        "/api/model-connections?type=ref&limit=1",
        await tracer.getRecordedConnections({ type: "ref", limit: 1 }),
      ],
      [
        `/api/connections?id=${source.id}&limit=1`,
        await tracer.getConnections({ id: source.id, limit: 1 }),
      ],
    ];
    cases.push(
      [
        `/api/graph?rootId=${source.id}&expanded=`,
        await tracer.getGraph({ rootId: source.id, expanded: [] }),
      ],
      [
        `/api/graph?rootId=${source.id}&expanded=${target.id}`,
        await tracer.getGraph({ rootId: source.id, expanded: [target.id] }),
      ],
    );
    for (const [path, expected] of cases) {
      const response = await fetch(server.origin + path);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), JSON.parse(JSON.stringify(expected)));
    }
    assert.equal(
      (await fetch(server.origin + "/api/model-connections?type=ref&limit=26")).status,
      400,
    );
    assert.equal((await fetch(server.origin + "/api/work?limit=1&limit=2")).status, 400);
    assert.equal((await fetch(server.origin + "/api/unknown")).status, 404);
  } finally {
    await server.close();
    repo.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
