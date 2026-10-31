import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";

const script = resolve("scripts/backup-project.mjs");
const run = (...args: string[]) =>
  spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

test("project backup preserves an open WAL project, history and command recovery without changing the source", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-backup-"));
  const repository = new SQLiteRepository(join(directory, "source project.sqlite"));
  t.after(() => {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const tracer = new Tracer(repository);
  const actor = { actor: "backup-regression", reason: "Fictional persisted backup proof" };
  await tracer.setSchema(
    { entityTypes: { item: { fields: { title: { type: "string" } } } }, relationshipTypes: {} },
    0,
    actor,
  );
  const commandId = crypto.randomUUID();
  await tracer.applyChangeset({
    commandId,
    expectedSchemaVersion: 1,
    operations: [
      {
        op: "entity.create",
        input: { type: "item", key: "BACKUP-1", fields: { title: "Retained native history" } },
      },
    ],
    provenance: actor,
  });
  const before = await tracer.exportProject();
  const destination = join(directory, "new backup.sqlite");
  const result = run(join(directory, "source project.sqlite"), destination);
  assert.equal(result.status, 0, result.stderr);
  const restoredRepository = new SQLiteRepository(destination);
  try {
    const restored = new Tracer(restoredRepository);
    assert.deepEqual(await restored.exportProject(), before);
    assert.deepEqual(
      await restored.getChangesetOutcome(commandId),
      await tracer.getChangesetOutcome(commandId),
    );
    assert.deepEqual(await tracer.exportProject(), before);
  } finally {
    restoredRepository.close();
  }
});

test("backup refuses missing sources, existing destinations and symlinks without overwriting files", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-backup-errors-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = join(directory, "source.sqlite");
  const repository = new SQLiteRepository(source);
  repository.close();
  const existing = join(directory, "existing.sqlite");
  writeFileSync(existing, "retained backup");
  const link = join(directory, "link.sqlite");
  symlinkSync(existing, link);
  assert.notEqual(run(source, existing).status, 0);
  assert.notEqual(run(source, link).status, 0);
  assert.equal(readFileSync(existing, "utf8"), "retained backup");
  const missing = join(directory, "missing.sqlite"),
    destination = join(directory, "must-not-exist.sqlite");
  assert.notEqual(run(missing, destination).status, 0);
  assert.equal(existsSync(missing), false);
  assert.equal(existsSync(destination), false);
  assert.equal(run("--help").status, 0);
  assert.notEqual(run().status, 0);
});
