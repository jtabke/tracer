import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import type { Schema } from "../src/core/model.ts";

const schema: Schema = {
  entityTypes: {
    requirement: {
      fields: { title: { type: "string", required: true }, approved: { type: "boolean" } },
    },
    test: { fields: { title: { type: "string", required: true } } },
  },
  relationshipTypes: {
    verifies: { source: ["test"], target: ["requirement"], fields: { evidence: { type: "json" } } },
    depends: { fields: {} },
  },
};
const provenance = { actor: "engineer", reason: "test" };
async function fixture(work: (tracer: Tracer, repo: SQLiteRepository) => Promise<void>) {
  const repo = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repo);
    await tracer.setSchema(schema, 0, provenance);
    await work(tracer, repo);
  } finally {
    repo.close();
  }
}
const entity = (tracer: Tracer, type = "requirement", key?: string) =>
  tracer.createEntity({ type, key, fields: { title: "Hello" } }, 1, provenance);
const link = (tracer: Tracer, source: string, target: string) =>
  tracer.createRelationship({ type: "depends", source, target, fields: {} }, 1, provenance);

test("immutable snapshots, independent versions, changeset provenance and UTC timestamps", () =>
  fixture(async (tracer) => {
    const a = await entity(tracer, "requirement", "REQ-1");
    const b = await tracer.updateEntity(
      a.id,
      1,
      { fields: { title: "Changed", approved: true } },
      1,
      { actor: "agent", reason: "reviewed" },
    );
    assert.equal(b.version, 2);
    const history = (await tracer.history({ kind: "entity", id: a.id })).items;
    assert.deepEqual(
      history.map((row) => row.version),
      [1, 2],
    );
    assert.deepEqual((history[0].snapshot as typeof a).fields, { title: "Hello" });
    assert.deepEqual(
      history.map((row) => row.schemaVersion),
      [1, 1],
    );
    const changesets = await tracer.changesets();
    assert.equal(changesets[2].actor, "agent");
    assert.equal(changesets[2].reason, "reviewed");
    assert.match(changesets[2].at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.deepEqual(
      changesets.map((row) => row.projectRevision),
      [1, 2, 3],
    );
  }));

test("validation failures and duplicate keys leave state, revisions and counter unchanged", () =>
  fixture(async (tracer) => {
    const a = await entity(tracer, "requirement", "REQ-1");
    const invalidInputs: Parameters<Tracer["createEntity"]>[0][] = [
      { type: "missing", fields: {} },
      { type: "requirement", fields: {} },
      { type: "requirement", fields: { title: 12 } },
      { type: "requirement", fields: { title: "ok", surprise: true } },
      { type: "toString", fields: {} },
      { type: "requirement", fields: { title: "ok", approved: null } },
    ];
    for (const input of invalidInputs)
      await assert.rejects(tracer.createEntity(input, 1, provenance), { code: "validation" });
    await assert.rejects(entity(tracer, "test", "REQ-1"), { code: "conflict" });
    await assert.rejects(
      tracer.updateEntity(a.id, 0, { fields: { title: "stale" } }, 1, provenance),
      { code: "conflict" },
    );
    assert.equal((await tracer.history()).items.length, 2);
    assert.equal((await tracer.queryEntities()).items.length, 1);
    await entity(tracer, "test", "req-1"); // Keys are project-wide and case-sensitive.
    assert.deepEqual(
      (await tracer.changesets()).map((row) => row.projectRevision),
      [1, 2, 3],
    );
  }));

test("relationship validation, update conflicts, endpoint edits and tombstones", () =>
  fixture(async (tracer) => {
    const a = await entity(tracer),
      b = await entity(tracer, "test"),
      c = await entity(tracer);
    await assert.rejects(
      tracer.createRelationship(
        { type: "verifies", source: a.id, target: b.id, fields: {} },
        1,
        provenance,
      ),
      { code: "validation" },
    );
    await assert.rejects(
      tracer.createRelationship(
        { type: "verifies", source: b.id, target: "absent", fields: {} },
        1,
        provenance,
      ),
      { code: "referential_integrity" },
    );
    const item = await tracer.createRelationship(
      { type: "verifies", source: b.id, target: a.id, fields: {} },
      1,
      provenance,
    );
    const updated = await tracer.updateRelationship(
      item.id,
      1,
      { type: "verifies", source: b.id, target: c.id, fields: { evidence: true } },
      1,
      provenance,
    );
    assert.equal(updated.version, 2);
    await assert.rejects(
      tracer.updateRelationship(
        item.id,
        1,
        { type: "depends", source: b.id, target: a.id, fields: {} },
        1,
        provenance,
      ),
      { code: "conflict" },
    );
    await assert.rejects(tracer.removeRelationship(item.id, 1, 1, provenance), {
      code: "conflict",
    });
    await tracer.removeRelationship(item.id, 2, 1, provenance);
    assert.equal((await tracer.queryRelationships()).items.length, 0);
    const history = (await tracer.history({ kind: "relationship", id: item.id })).items;
    assert.equal(history.length, 3);
    assert.equal(history[2].snapshot, null);
    assert.equal(history[2].version, 3);
  }));

test("schema changes reject incompatible state, race safely, and preserve interpretation", () =>
  fixture(async (tracer) => {
    const a = await entity(tracer),
      b = await entity(tracer, "test");
    await tracer.createRelationship(
      { type: "verifies", source: b.id, target: a.id, fields: {} },
      1,
      provenance,
    );
    await assert.rejects(
      tracer.setSchema({ entityTypes: {}, relationshipTypes: {} }, 1, provenance),
      { code: "validation" },
    );
    await assert.rejects(
      tracer.setSchema(
        { ...schema, relationshipTypes: { bad: { source: ["missing"], fields: {} } } },
        1,
        provenance,
      ),
      { code: "validation" },
    );
    await assert.rejects(
      tracer.setSchema(
        { ...schema, relationshipTypes: { verifies: { fields: {}, source: ["requirement"] } } },
        1,
        provenance,
      ),
      { code: "validation" },
    );
    const results = await Promise.allSettled([
      tracer.setSchema(schema, 1, provenance),
      tracer.updateEntity(a.id, 1, { fields: { title: "stale schema" } }, 1, provenance),
    ]);
    assert.equal(results[0].status, "fulfilled");
    assert.equal((results[1] as PromiseRejectedResult).reason.code, "schema_conflict");
    await assert.rejects(tracer.setSchema(schema, 1, provenance), { code: "schema_conflict" });
    await assert.rejects(
      tracer.removeRelationship((await tracer.queryRelationships()).items[0].id, 1, 1, provenance),
      { code: "schema_conflict" },
    );
    const result = await tracer.updateEntity(
      a.id,
      1,
      { fields: { title: "current schema" } },
      2,
      provenance,
    );
    assert.equal(result.version, 2);
    assert.equal((await tracer.getSchema())?.version, 2);
    assert.deepEqual(
      (await tracer.history({ id: a.id })).items.map((row) => row.schemaVersion),
      [1, 2],
    );
    assert.deepEqual(
      (await tracer.history({ kind: "schema" })).items.map((row) => row.version),
      [1, 2],
    );
  }));

test("data mutation before a schema change is revalidated by the replacement", () =>
  fixture(async (tracer) => {
    const a = await entity(tracer);
    const withoutApproved: Schema = {
      ...schema,
      entityTypes: {
        ...schema.entityTypes,
        requirement: { fields: { title: { type: "string", required: true } } },
      },
    };
    const results = await Promise.allSettled([
      tracer.updateEntity(
        a.id,
        1,
        { fields: { title: "approved", approved: true } },
        1,
        provenance,
      ),
      tracer.setSchema(withoutApproved, 1, provenance),
    ]);
    assert.equal(results[0].status, "fulfilled");
    assert.equal((results[1] as PromiseRejectedResult).reason.code, "validation");
    assert.equal((await tracer.getSchema())?.version, 1);
  }));

test("multi-object changeset groups revisions in deterministic order and rolls back completely", () =>
  fixture(async (tracer) => {
    const a = await entity(tracer),
      b = await entity(tracer, "test"),
      old = await link(tracer, a.id, b.id);
    const before = (await tracer.changesets()).length;
    const committed = await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: [
          {
            op: "entity.update",
            id: a.id,
            expectedVersion: 1,
            input: { fields: { title: "changed" } },
          },
          { op: "relationship.remove", id: old.id, expectedVersion: 1 },
          {
            op: "relationship.create",
            input: { type: "verifies", source: b.id, target: a.id, fields: {} },
          },
        ],
      },
      provenance,
    );
    const revisions = (await tracer.history()).items.filter(
      (row) => row.changesetId === committed.changeset.id,
    );
    assert.deepEqual(
      revisions.map((row) => row.ordinal),
      [1, 2, 3],
    );
    assert.deepEqual(
      revisions.map((row) => row.projectRevision),
      [before + 1, before + 1, before + 1],
    );
    assert.equal((await tracer.changesets()).length, before + 1);
    await assert.rejects(
      tracer.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: [
            {
              op: "entity.update",
              id: a.id,
              expectedVersion: 2,
              input: { fields: { title: "rolled back" } },
            },
            {
              op: "relationship.create",
              input: { type: "depends", source: a.id, target: "missing", fields: {} },
            },
          ],
        },
        provenance,
      ),
      { code: "referential_integrity" },
    );
    assert.equal((await tracer.history({ id: a.id })).items.length, 2);
    assert.equal((await tracer.changesets()).length, before + 1);
    await assert.rejects(
      tracer.applyChangeset({ expectedSchemaVersion: 1, operations: [] }, provenance),
      { code: "validation" },
    );
  }));

test("entity deletion restricts links by default; explicit cascade records every tombstone", () =>
  fixture(async (tracer) => {
    const a = await entity(tracer),
      b = await entity(tracer),
      c = await entity(tracer);
    const outgoing = await link(tracer, a.id, b.id),
      incoming = await link(tracer, c.id, a.id),
      self = await link(tracer, a.id, a.id);
    await assert.rejects(tracer.removeEntity(a.id, 1, 1, provenance), {
      code: "referential_integrity",
    });
    await tracer.removeEntity(a.id, 1, 1, provenance, true);
    assert.equal((await tracer.queryEntities()).items.length, 2);
    assert.equal((await tracer.queryRelationships()).items.length, 0);
    const last = (await tracer.changesets()).at(-1)!;
    const tombstones = (await tracer.history()).items.filter((row) => row.changesetId === last.id);
    assert.equal(tombstones.length, 4);
    assert.ok(tombstones.every((row) => row.snapshot === null));
    assert.equal(tombstones.at(-1)?.id, a.id);
    for (const id of [a.id, outgoing.id, incoming.id, self.id])
      assert.equal((await tracer.history({ id })).items.length, 2);
    await assert.rejects(link(tracer, a.id, b.id), { code: "referential_integrity" });
    await assert.rejects(
      tracer.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: [
            {
              op: "entity.create",
              id: a.id,
              input: { type: "requirement", fields: { title: "reuse" } },
            },
          ],
        },
        provenance,
      ),
      { code: "conflict" },
    );
  }));

test("indexed, cycle-safe traversal handles both directions, self-links, filters and bounds", () =>
  fixture(async (tracer) => {
    const a = await entity(tracer),
      b = await entity(tracer),
      c = await entity(tracer);
    for (const [source, target] of [
      [a.id, b.id],
      [b.id, c.id],
      [c.id, a.id],
      [a.id, a.id],
    ])
      await link(tracer, source, target);
    assert.deepEqual(await tracer.traverse(a.id), [
      { id: b.id, depth: 1 },
      { id: c.id, depth: 2 },
    ]);
    assert.deepEqual(await tracer.traverse(a.id, { direction: "reverse", maxDepth: 1 }), [
      { id: c.id, depth: 1 },
    ]);
    assert.equal((await tracer.traverse(a.id, { direction: "both" })).length, 2);
    assert.deepEqual(await tracer.traverse(a.id, { type: "verifies" }), []);
    assert.deepEqual(await tracer.traverse(a.id, { maxDepth: 0 }), []);
    await assert.rejects(tracer.traverse(a.id, { maxNodes: 1 }), { code: "validation" });
    await assert.rejects(tracer.traverse("absent"), { code: "not_found" });
  }));

test("query and history pages are bounded, sorted, filterable and have resumable cursors", () =>
  fixture(async (tracer) => {
    const a = await entity(tracer, "requirement", "REQ-1"),
      b = await entity(tracer, "test"),
      c = await entity(tracer);
    const one = await link(tracer, a.id, b.id);
    await link(tracer, c.id, b.id);
    const first = await tracer.queryEntities({ limit: 2 });
    assert.equal(first.items.length, 2);
    assert.ok(first.nextAfter);
    const second = await tracer.queryEntities({ limit: 2, after: first.nextAfter });
    assert.equal(second.items.length, 1);
    assert.equal(second.nextAfter, undefined);
    assert.deepEqual(
      [...first.items, ...second.items].map((row) => row.id),
      [a.id, b.id, c.id].sort(),
    );
    assert.equal((await tracer.queryEntities({ key: "REQ-1" })).items[0].id, a.id);
    assert.equal((await tracer.queryEntities({ type: "test" })).items.length, 1);
    assert.equal(
      (await tracer.queryRelationships({ source: a.id, target: b.id, type: "depends" })).items[0]
        .id,
      one.id,
    );
    assert.equal((await tracer.queryRelationships({ incident: b.id })).items.length, 2);
    const history = await tracer.history({ limit: 2 });
    assert.ok(history.nextAfter);
    assert.equal((await tracer.history({ after: history.nextAfter })).items[0].projectRevision, 3);
    await assert.rejects(tracer.queryEntities({ limit: 0 }), { code: "validation" });
    // @ts-expect-error rejected both by resource types and runtime validation
    await assert.rejects(tracer.queryEntities({ source: a.id }), { code: "validation" });
    // @ts-expect-error entity-only filters are not relationship filters
    await assert.rejects(tracer.queryRelationships({ key: "invalid" }), { code: "validation" });
    await assert.rejects(tracer.history({ after: "invalid" }), { code: "validation" });
  }));

test("simultaneous entity and relationship edits conflict rather than silently overwrite", () =>
  fixture(async (tracer) => {
    const a = await entity(tracer),
      b = await entity(tracer),
      item = await link(tracer, a.id, b.id);
    for (const requests of [
      [
        tracer.updateEntity(a.id, 1, { fields: { title: "first" } }, 1, provenance),
        tracer.updateEntity(a.id, 1, { fields: { title: "second" } }, 1, provenance),
      ],
      [
        tracer.updateRelationship(
          item.id,
          1,
          { type: "depends", source: b.id, target: a.id, fields: {} },
          1,
          provenance,
        ),
        tracer.removeRelationship(item.id, 1, 1, provenance),
      ],
    ]) {
      const results = await Promise.allSettled(requests);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(
        (results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason
          .code,
        "conflict",
      );
    }
  }));

test("storage foreign keys and uniqueness enforce invariants independently of services", () =>
  fixture(async (tracer, repo) => {
    const a = await entity(tracer),
      b = await entity(tracer);
    await link(tracer, a.id, b.id);
    await assert.rejects(
      repo.transaction(async (tx) => {
        await tx.beginChangeset(crypto.randomUUID(), 1, provenance);
        await tx.remove("entity", a.id, 1);
      }),
      { code: "referential_integrity" },
    );
    await assert.rejects(
      repo.transaction(async (tx) => {
        await tx.beginChangeset(crypto.randomUUID(), 1, provenance);
        await tx.save(
          "relationship",
          {
            id: crypto.randomUUID(),
            type: "depends",
            source: a.id,
            target: "missing",
            fields: {},
            version: 1,
          },
          0,
        );
      }),
      { code: "referential_integrity" },
    );
    assert.equal((await tracer.history()).items.length, 4);
  }));

test("file persistence, stable busy errors and stale schema checks across connections", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-")),
    path = join(directory, "project.sqlite");
  let first: SQLiteRepository | undefined, second: SQLiteRepository | undefined;
  try {
    first = new SQLiteRepository(path);
    let a = new Tracer(first);
    await a.setSchema(schema, 0, provenance);
    const item = await entity(a);
    first.close();
    first = new SQLiteRepository(path);
    a = new Tracer(first);
    second = new SQLiteRepository(path);
    const b = new Tracer(second);
    assert.equal((await a.queryEntities()).items[0].id, item.id);
    await a.updateEntity(item.id, 1, { fields: { title: "new" } }, 1, provenance);
    await assert.rejects(
      b.updateEntity(item.id, 1, { fields: { title: "stale" } }, 1, provenance),
      { code: "conflict" },
    );
    await a.setSchema(schema, 1, provenance);
    await assert.rejects(
      b.updateEntity(item.id, 2, { fields: { title: "stale schema" } }, 1, provenance),
      { code: "schema_conflict" },
    );
    await first.transaction(async () => {
      assert.equal((await b.queryEntities()).items[0].id, item.id);
      await assert.rejects(
        b.updateEntity(item.id, 2, { fields: { title: "contending writer" } }, 2, provenance),
        { code: "busy" },
      );
    });
  } finally {
    second?.close();
    first?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("physical v1 migration preserves snapshots, provenance, identities and ordered history", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-migrate-")),
    path = join(directory, "project.sqlite");
  let repository: SQLiteRepository | undefined;
  try {
    const db = new DatabaseSync(path);
    db.exec(`CREATE TABLE storage_version(version INTEGER); INSERT INTO storage_version VALUES(1);
      CREATE TABLE objects(kind TEXT, id TEXT, payload TEXT, PRIMARY KEY(kind,id));
      CREATE TABLE revisions(sequence INTEGER PRIMARY KEY, kind TEXT, id TEXT, version INTEGER, at TEXT, actor TEXT, reason TEXT, snapshot TEXT);
      CREATE INDEX revision_object ON revisions(kind,id,sequence);
      CREATE TABLE revision_counter(id INTEGER PRIMARY KEY, value INTEGER); INSERT INTO revision_counter VALUES(1,3);`);
    const id = crypto.randomUUID(),
      removedId = crypto.randomUUID();
    const objects = [
      { ...schema, id: "project", version: 1 },
      { id, type: "requirement", key: "REQ-1", version: 1, fields: { title: "legacy" } },
    ];
    for (const [index, object] of objects.entries()) {
      const kind = index === 0 ? "schema" : "entity";
      db.prepare("INSERT INTO objects VALUES(?,?,?)").run(kind, object.id, JSON.stringify(object));
      db.prepare("INSERT INTO revisions VALUES(?,?,?,?,?,?,?,?)").run(
        index + 1,
        kind,
        object.id,
        1,
        "2026-01-01T00:00:00.000Z",
        "legacy",
        "keep",
        JSON.stringify(object),
      );
    }
    // Include a reserved deleted identity in legacy history.
    db.prepare("INSERT INTO revisions VALUES(3,'relationship',?,2,?,'legacy','keep',NULL)").run(
      removedId,
      "2026-01-01T00:00:00.000Z",
    );
    db.close();
    repository = new SQLiteRepository(path);
    const tracer = new Tracer(repository);
    assert.equal((await tracer.queryEntities()).items[0].id, id);
    assert.equal((await tracer.history()).items.length, 3);
    assert.deepEqual(
      (await tracer.changesets()).map((row) => row.projectRevision),
      [1, 2, 3],
    );
    assert.equal((await tracer.changesets())[0].reason, "keep");
    await tracer.updateEntity(id, 1, { fields: { title: "after migration" } }, 1, provenance);
    assert.equal((await tracer.changesets()).at(-1)?.projectRevision, 4);
    await assert.rejects(
      tracer.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: [
            {
              op: "relationship.create",
              id: removedId,
              input: { type: "depends", source: id, target: id, fields: {} },
            },
          ],
        },
        provenance,
      ),
      { code: "conflict" },
    );
  } finally {
    repository?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("unknown physical format is rejected without changing its version", () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-version-")),
    path = join(directory, "project.sqlite");
  try {
    const db = new DatabaseSync(path);
    db.exec(
      "CREATE TABLE storage_version(version INTEGER); INSERT INTO storage_version VALUES(99)",
    );
    db.close();
    assert.throws(() => new SQLiteRepository(path), { code: "unsupported_storage" });
    const inspect = new DatabaseSync(path);
    assert.equal(inspect.prepare("SELECT version FROM storage_version").get()?.version, 99);
    inspect.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CLI runs version-checked JSON commands, bounded queries, changesets and both domains", () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-cli-"));
  try {
    const base = [
      "--disable-warning=ExperimentalWarning",
      "src/interfaces/cli.ts",
      "--db",
      join(directory, "project.sqlite"),
    ];
    const cli = (...args: string[]) =>
      JSON.parse(execFileSync(process.execPath, [...base, ...args], { encoding: "utf8" }));
    cli("schema", "set", JSON.stringify(schema), "0");
    const a = cli(
      "--schema-version",
      "1",
      "entity",
      "create",
      JSON.stringify({ type: "requirement", fields: { title: "CLI" } }),
    );
    const b = cli(
      "--schema-version",
      "1",
      "entity",
      "create",
      JSON.stringify({ type: "test", fields: { title: "Test" } }),
    );
    const item = cli(
      "--schema-version",
      "1",
      "relationship",
      "create",
      JSON.stringify({ type: "verifies", source: b.id, target: a.id, fields: {} }),
    );
    assert.equal(cli("trace", b.id)[0].id, a.id);
    cli(
      "--schema-version",
      "1",
      "entity",
      "update",
      a.id,
      "1",
      JSON.stringify({ fields: { title: "Edited" } }),
    );
    const conflict = spawnSync(
      process.execPath,
      [
        ...base,
        "--schema-version",
        "1",
        "entity",
        "update",
        a.id,
        "1",
        JSON.stringify({ fields: { title: "Stale" } }),
      ],
      { encoding: "utf8" },
    );
    assert.equal(conflict.status, 1);
    assert.equal(JSON.parse(conflict.stderr).error, "conflict");
    cli("--schema-version", "1", "relationship", "remove", item.id, "1");
    assert.equal(cli("history").items.length, 6);
    assert.ok(cli("entity", "list", '{"limit":1}').nextAfter);
    const missingSchema = spawnSync(
      process.execPath,
      [...base, "entity", "create", '{"type":"test","fields":{"title":"bad"}}'],
      { encoding: "utf8" },
    );
    assert.equal(JSON.parse(missingSchema.stderr).error, "usage");
    cli(
      "changeset",
      "apply",
      JSON.stringify({
        expectedSchemaVersion: 1,
        operations: [{ op: "entity.remove", id: b.id, expectedVersion: 1 }],
      }),
    );
    assert.equal(cli("changeset", "list").length, 7);
    const demo = JSON.parse(
      execFileSync(
        process.execPath,
        ["--disable-warning=ExperimentalWarning", "examples/demo.ts"],
        { encoding: "utf8" },
      ),
    );
    assert.equal(demo.entities.length, 7);
    assert.equal(demo.revisions, 13);
    assert.equal(demo.changesets, 9);
    assert.equal(demo.engineeringTrace.length, 2);
    assert.equal(demo.researchTrace.length, 3);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("JSON boundaries reject coercions, cycles, sparse arrays and invalid Unicode", () =>
  fixture(async (tracer) => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const values: unknown[] = [
      NaN,
      Infinity,
      undefined,
      new Date(),
      cyclic,
      new Array(2),
      String.fromCharCode(0xd800),
      { missing: undefined },
    ];
    for (const evidence of values) {
      const a = await entity(tracer),
        b = await entity(tracer, "test");
      await assert.rejects(
        tracer.createRelationship(
          { type: "verifies", source: b.id, target: a.id, fields: { evidence } } as Parameters<
            Tracer["createRelationship"]
          >[0],
          1,
          provenance,
        ),
        { code: "validation" },
      );
    }
    const a = await entity(tracer),
      b = await entity(tracer, "test");
    const value = await tracer.createRelationship(
      {
        type: "verifies",
        source: b.id,
        target: a.id,
        fields: { evidence: [null, true, "🌽", -0] },
      },
      1,
      provenance,
    );
    assert.deepEqual((await tracer.queryRelationships()).items[0].fields, {
      evidence: [null, true, "🌽", 0],
    });
    const history = await tracer.history({ id: value.id });
    assert.equal(history.items.length, 1);
  }));

test("pagination inside a changeset preserves every revision ordinal", () =>
  fixture(async (tracer) => {
    const a = await entity(tracer),
      b = await entity(tracer);
    const committed = await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: [
          {
            op: "entity.update",
            id: a.id,
            expectedVersion: 1,
            input: { fields: { title: "first" } },
          },
          {
            op: "entity.update",
            id: b.id,
            expectedVersion: 1,
            input: { fields: { title: "second" } },
          },
        ],
      },
      provenance,
    );
    const first = await tracer.history({ after: "3:1", limit: 1 });
    assert.equal(first.items[0].changesetId, committed.changeset.id);
    assert.equal(first.items[0].ordinal, 1);
    const second = await tracer.history({ after: first.nextAfter, limit: 1 });
    assert.equal(second.items[0].ordinal, 2);
    assert.equal(second.nextAfter, undefined);
  }));

test("failed legacy migration leaves the original physical format and history intact", () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-bad-migrate-")),
    path = join(directory, "project.sqlite");
  try {
    const db = new DatabaseSync(path);
    db.exec(`CREATE TABLE storage_version(version INTEGER); INSERT INTO storage_version VALUES(1);
      CREATE TABLE objects(kind TEXT, id TEXT, payload TEXT);
      CREATE TABLE revisions(sequence INTEGER PRIMARY KEY, kind TEXT, id TEXT, version INTEGER, at TEXT, actor TEXT, reason TEXT, snapshot TEXT);
      CREATE TABLE revision_counter(id INTEGER, value INTEGER); INSERT INTO revision_counter VALUES(1,1);`);
    const id = crypto.randomUUID(),
      object = {
        id,
        type: "depends",
        source: "missing",
        target: "missing",
        version: 1,
        fields: {},
      };
    db.prepare("INSERT INTO objects VALUES('relationship',?,?)").run(id, JSON.stringify(object));
    db.prepare("INSERT INTO revisions VALUES(1,'relationship',?,1,?,'legacy',NULL,?)").run(
      id,
      "2026-01-01T00:00:00.000Z",
      JSON.stringify(object),
    );
    db.close();
    assert.throws(() => new SQLiteRepository(path), { code: "referential_integrity" });
    const inspect = new DatabaseSync(path);
    assert.equal(inspect.prepare("SELECT version FROM storage_version").get()?.version, 1);
    assert.equal(inspect.prepare("SELECT COUNT(*) AS n FROM revisions").get()?.n, 1);
    assert.equal(
      inspect.prepare("SELECT name FROM sqlite_master WHERE name='entities'").get(),
      undefined,
    );
    inspect.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("required JSON fields cannot be satisfied by inherited object properties", () =>
  fixture(async (tracer) => {
    const next: Schema = {
      ...schema,
      entityTypes: {
        ...schema.entityTypes,
        special: {
          fields: JSON.parse(
            '{"toString":{"type":"json","required":true},"__proto__":{"type":"json","required":true}}',
          ),
        },
      },
    };
    await tracer.setSchema(next, 1, provenance);
    await assert.rejects(tracer.createEntity({ type: "special", fields: {} }, 2, provenance), {
      code: "validation",
    });
    const created = await tracer.createEntity(
      { type: "special", fields: JSON.parse('{"toString":null,"__proto__":42}') },
      2,
      provenance,
    );
    assert.deepEqual(
      (await tracer.queryEntities({ type: "special" })).items[0].fields,
      created.fields,
    );
  }));
