import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { Tracer } from "../src/index.ts";
import type { ChangesetInput } from "../src/index.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { createClient } from "../src/client.ts";

const schema = { entityTypes: { item: { fields: {} } }, relationshipTypes: {} };
const provenance = { actor: "outcome-test", reason: "Recover changeset" };
function command(commandId = "job-1"): ChangesetInput {
  return {
    commandId,
    expectedSchemaVersion: 1,
    expectedProjectRevision: 1,
    operations: [{ op: "entity.create", input: { type: "item", fields: {} } }],
  };
}

test("headless commit survives a lost response and restart, then lookup and repeat recover the original result", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-outcome-"));
  const path = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(path);
  let tracer = new Tracer(repository);
  await tracer.setSchema(schema, 0, provenance);
  let server = await startHeadlessServer(tracer, { port: 0, provenance });
  t.after(async () => {
    await server.close();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  });
  let writes = 0;
  const interrupted = createClient({
    baseUrl: server.origin,
    fetch: async (...args) => {
      const response = await fetch(...args);
      if (args[1]?.method === "POST") {
        writes++;
        await response.arrayBuffer();
        throw new Error("Connection lost after commit");
      }
      return response;
    },
  });
  await interrupted.connect();
  await assert.rejects(interrupted.write("/api/changesets", command()), {
    code: "outcome_unknown",
  });
  assert.equal(writes, 1);
  await server.close();
  repository.close();
  repository = new SQLiteRepository(path);
  tracer = new Tracer(repository);
  server = await startHeadlessServer(tracer, { port: 0, provenance });
  const client = createClient({ baseUrl: server.origin });
  const recovered = await client.read("/api/changeset-outcome", { commandId: "job-1" });
  assert.ok(recovered);
  assert.equal(recovered.changeset.projectRevision, 2);
  assert.deepEqual(await tracer.getEntity(recovered.results[0].id), recovered.results[0]);
  await client.connect();
  assert.deepEqual(await client.write("/api/changesets", command()), recovered);
  await assert.rejects(
    client.write("/api/changesets", { ...command(), expectedSchemaVersion: 2 }),
    {
      code: "conflict",
      details: { path: ["commandId"] },
    },
  );
  assert.equal(await client.read("/api/changeset-outcome", { commandId: "missing" }), null);
  await assert.rejects(client.read("/api/changeset-outcome", { commandId: " " }), {
    code: "validation",
  });
  await assert.rejects(client.read("/api/changeset-outcome", {} as never), { code: "validation" });
  assert.equal((await tracer.history({ kind: "entity" })).items.length, 1);
  assert.equal((await tracer.changesets()).length, 2);
});

test("command capture, invalid identities, optional fields and unidentified writes retain their contracts", async (t) => {
  const repository = new SQLiteRepository(":memory:");
  t.after(() => repository.close());
  const tracer = new Tracer(repository);
  await tracer.setSchema(schema, 0, provenance);
  for (const commandId of ["", " padded", "padded ", "x".repeat(201), 123, null]) {
    await assert.rejects(
      tracer.applyChangeset({ ...command(), commandId } as ChangesetInput, provenance),
      { code: "validation" },
    );
    await assert.rejects(tracer.getChangesetOutcome(commandId as string), { code: "validation" });
  }
  const input = command();
  const origin = { ...provenance };
  const pending = tracer.applyChangeset({ ...input, provenance: origin });
  input.operations.length = 0;
  origin.actor = "mutated";
  const result = await pending;
  assert.equal(result.results.length, 1);
  assert.equal(result.changeset.actor, provenance.actor);
  assert.deepEqual(await tracer.applyChangeset(command(), provenance), result);
  const { commandId: _id, expectedProjectRevision: _head, ...unidentified } = command();
  const [first, second] = await Promise.all([
    tracer.applyChangeset(unidentified, provenance),
    tracer.applyChangeset(unidentified, provenance),
  ]);
  assert.notEqual(first.results[0].id, second.results[0].id);
  const normalized = {
    ...unidentified,
    commandId: "undefined-fields",
    expectedProjectRevision: undefined,
  };
  const saved = await tracer.applyChangeset(normalized, provenance);
  assert.deepEqual(
    await tracer.applyChangeset({ ...unidentified, commandId: "undefined-fields" }, provenance),
    saved,
  );
});

test("format 8 migrates without changing native history; outcomes are immutable and transaction scoped", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-outcome-migration-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(path);
  let tracer = new Tracer(repository);
  await tracer.setSchema(schema, 0, provenance);
  const before = await tracer.exportProject();
  repository.close();
  const old = new DatabaseSync(path);
  old.exec(
    "DROP TABLE changeset_commands; DROP TABLE resource_identities; DROP INDEX resource_source_identity; ALTER TABLE entities DROP COLUMN resource_json; ALTER TABLE relationships DROP COLUMN reference_json; UPDATE storage_version SET version=8",
  );
  old.close();
  repository = new SQLiteRepository(path);
  t.after(() => repository.close());
  tracer = new Tracer(repository);
  assert.deepEqual(await tracer.exportProject(), before);
  assert.equal(await tracer.getChangesetOutcome("job-1"), null);
  const result = await tracer.applyChangeset(command(), provenance);
  const tx = await repository.transaction(async (tx) => tx);
  await assert.rejects(tx.getChangesetCommand("job-1"), { code: "storage" });
  await assert.rejects(tx.appendChangesetCommand("job-1", "different", result), {
    code: "storage",
  });
  await assert.rejects(
    repository.transaction((tx) => tx.appendChangesetCommand("other", "intent", result)),
    { code: "storage" },
  );
  const inspect = new DatabaseSync(path);
  try {
    assert.equal(inspect.prepare("SELECT version FROM storage_version").get()!.version, 10);
    assert.throws(
      () => inspect.exec("UPDATE changeset_commands SET intent_json='changed'"),
      /Immutable command outcome/,
    );
    assert.throws(
      () => inspect.exec("DELETE FROM changeset_commands"),
      /Immutable command outcome/,
    );
  } finally {
    inspect.close();
  }
  assert.deepEqual(await tracer.getChangesetOutcome("job-1"), result);
});

test("independent SQLite connections cannot commit a repeated command twice", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-outcome-concurrent-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "project.sqlite");
  const first = new SQLiteRepository(path),
    second = new SQLiteRepository(path);
  t.after(() => {
    first.close();
    second.close();
  });
  const a = new Tracer(first),
    b = new Tracer(second);
  await a.setSchema(schema, 0, provenance);
  const settled = await Promise.allSettled([
    a.applyChangeset(command(), provenance),
    b.applyChangeset(command(), provenance),
  ]);
  const committed = settled.find((result) => result.status === "fulfilled");
  assert.ok(committed?.status === "fulfilled");
  for (const result of settled) {
    if (result.status === "fulfilled") assert.deepEqual(result.value, committed.value);
    else assert.equal(result.reason.code, "busy");
  }
  assert.deepEqual(await b.applyChangeset(command(), provenance), committed.value);
  assert.equal((await a.changesets()).length, 2);
});

test("command identities are project-scoped and differing concurrent intents have one winner", async (t) => {
  const one = new SQLiteRepository(":memory:"),
    two = new SQLiteRepository(":memory:");
  t.after(() => {
    one.close();
    two.close();
  });
  const a = new Tracer(one),
    b = new Tracer(two);
  await a.setSchema(schema, 0, provenance);
  await b.setSchema(schema, 0, provenance);
  const changed = { ...command(), expectedProjectRevision: undefined };
  const outcomes = await Promise.allSettled([
    a.applyChangeset(command(), provenance),
    a.applyChangeset(changed, provenance),
  ]);
  assert.equal(outcomes.filter((value) => value.status === "fulfilled").length, 1);
  const rejected = outcomes.find((value) => value.status === "rejected");
  assert.ok(rejected?.status === "rejected");
  assert.equal(rejected.reason.code, "conflict");
  assert.equal(await b.getChangesetOutcome("job-1"), null);
  const other = await b.applyChangeset(changed, provenance);
  assert.notDeepEqual(await a.getChangesetOutcome("job-1"), other);
});

test("CLI apply and outcome use the durable application contract across processes", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-outcome-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "project.sqlite");
  const run = (...args: string[]) => {
    const output = spawnSync(
      process.execPath,
      [
        "src/interfaces/cli.ts",
        "--db",
        path,
        "--actor",
        provenance.actor,
        "--reason",
        provenance.reason,
        ...args,
      ],
      { encoding: "utf8" },
    );
    assert.equal(output.status, 0, output.stderr);
    return JSON.parse(output.stdout);
  };
  run("schema", "set", JSON.stringify(schema), "0");
  assert.equal(run("changeset", "outcome", "job-1"), null);
  const result = run("changeset", "apply", JSON.stringify(command()));
  assert.deepEqual(run("changeset", "outcome", "job-1"), result);
  assert.deepEqual(run("changeset", "apply", JSON.stringify(command())), result);
});
