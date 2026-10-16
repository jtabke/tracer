import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import {
  MAP_RECORD_LIMIT,
  MAP_CONNECTION_LIMIT,
  projectSnapshot,
} from "../src/application/project-snapshot.ts";
import type { Transaction } from "../src/persistence/contracts.ts";
import { mapData } from "../ui/map-data.ts";

test("native snapshots are complete across pages and fail explicitly at the fixed map bound", async () => {
  assert.equal(MAP_RECORD_LIMIT, 10000);
  assert.equal(MAP_CONNECTION_LIMIT, 100000);
  const parent = mkdtempSync(join(tmpdir(), "tracer-snapshot-"));
  const repo = new SQLiteRepository(join(parent, "project.sqlite"));
  try {
    const core = new Tracer(repo);
    assert.deepEqual(await core.getProjectSnapshot(), {
      schema: null,
      projectRevision: 0,
      entities: [],
      relationships: [],
    });
    await core.setSchema(
      { entityTypes: { item: { fields: { title: { type: "string" } } } }, relationshipTypes: {} },
      0,
      { actor: "test" },
    );
    for (let batch = 0; batch < 2; batch++)
      await core.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: Array.from({ length: batch ? 1 : 1000 }, (_, i) => ({
            op: "entity.create" as const,
            id: crypto.randomUUID(),
            input: { type: "item", fields: { title: `Item ${i}` } },
          })),
        },
        { actor: "test" },
      );
    const snapshot = await core.getProjectSnapshot();
    assert.equal(snapshot.entities.length, 1001);
    assert.equal(snapshot.projectRevision, 3);
    const projected = mapData(snapshot, "Custom project");
    assert.equal(projected.entities[0].key, snapshot.entities[0].id);
    assert.deepEqual(projected.entities[0].fields.title, snapshot.entities[0].fields.title);
    const tooMany = {
      query: async () => ({ items: Array.from({ length: 10001 }, () => ({})) }),
    } as unknown as Transaction;
    await assert.rejects(projectSnapshot(tooMany), /no partial map/);
  } finally {
    repo.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("project selection routes reads and guarded writes to distinct databases only", async () => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-project-routing-"));
  const a = new SQLiteRepository(join(parent, "a.sqlite")),
    b = new SQLiteRepository(join(parent, "b.sqlite"));
  const first = new Tracer(a),
    second = new Tracer(b);
  const schema: import("../src/core/model.ts").Schema = {
    entityTypes: { item: { fields: { title: { type: "string" } } } },
    relationshipTypes: {},
  };
  for (const core of [first, second]) await core.setSchema(schema, 0, { actor: "test" });
  const server = await startLocalServer(first, resolve("ui"), 0, undefined, [
    { id: "second", title: "Other project", tracer: second },
  ]);
  const request = async (path: string, project = "default", input?: unknown, token?: string) =>
    fetch(server.origin + path, {
      method: input ? "POST" : "GET",
      headers: {
        "X-Tracer-Project": project,
        ...(input
          ? {
              "Content-Type": "application/json",
              Origin: server.origin,
              "X-Tracer-Token": token ?? "",
            }
          : {}),
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
    });
  try {
    const catalogue = await (await request("/api/projects")).json();
    assert.equal(catalogue.length, 2);
    const { token } = await (await request("/api/session")).json();
    const identity = crypto.randomUUID();
    const input = {
      expectedSchemaVersion: 1,
      operations: [
        {
          op: "entity.create",
          id: identity,
          input: { type: "item", fields: { title: "Private to second" } },
        },
      ],
    };
    assert.equal((await request("/api/changesets", "second", input)).status, 403);
    assert.equal((await request("/api/changesets", "second", input, token)).status, 200);
    assert.equal((await first.getProjectSnapshot()).entities.length, 0);
    assert.equal((await second.getProjectSnapshot()).entities[0].id, identity);
    assert.equal((await request("/api/project-snapshot", "unknown")).status, 404);
    assert.equal((await request("/api/project-snapshot?limit=1")).status, 400);
    const captured = await (await request("/api/project-snapshot", "second")).json();
    assert.equal(captured.projectRevision, 2);
  } finally {
    await server.close();
    a.close();
    b.close();
    rmSync(parent, { recursive: true, force: true });
  }
});
