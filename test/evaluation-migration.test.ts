import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync, backup } from "node:sqlite";
import { join } from "node:path";
import { Tracer } from "../src/index.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { evaluationFixture, evaluationActor as actor } from "./evaluation-fixture.ts";

test("format 10 migration preserves every old payload/history/command and adds immutable evaluation recovery", async () => {
  const f = await evaluationFixture(),
    path = join(f.directory, "legacy.sqlite");
  let repository: SQLiteRepository | undefined;
  try {
    const native = await f.tracer.applyChangeset(
      {
        commandId: "legacy-command",
        expectedSchemaVersion: 1,
        operations: [
          {
            op: "entity.create",
            input: { type: f.model.conclusion, fields: { title: "Legacy output" } },
          },
        ],
      },
      actor,
    );
    const original = await f.tracer.exportProject(),
      source = new DatabaseSync(f.database, { readOnly: true });
    try {
      await backup(source, path);
    } finally {
      source.close();
    }
    const legacy = new DatabaseSync(path);
    legacy.exec("DROP TABLE evaluation_commands; UPDATE storage_version SET version=10");
    const tables = legacy
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('storage_version','sqlite_sequence')",
      )
      .all()
      .map((r) => String(r.name));
    const rows = (db: DatabaseSync, table: string) =>
      db
        .prepare(`SELECT * FROM ${table}`)
        .all()
        .map((r) => JSON.stringify(r))
        .sort();
    const before = new Map(tables.map((table) => [table, rows(legacy, table)]));
    legacy.close();
    repository = new SQLiteRepository(path);
    const tracer = new Tracer(repository);
    assert.deepEqual(await tracer.exportProject(), original);
    assert.deepEqual(await tracer.getChangesetOutcome("legacy-command"), native);
    const check = new DatabaseSync(path);
    try {
      assert.equal(check.prepare("SELECT version FROM storage_version").get()!.version, 11);
      for (const table of tables) assert.deepEqual(rows(check, table), before.get(table), table);
    } finally {
      check.close();
    }
    const command = { ...f.command, expectedProjectRevision: original.projectRevision };
    const result = await tracer.evaluations.commit(command, actor);
    const db = new DatabaseSync(path);
    try {
      assert.throws(
        () =>
          db
            .prepare("UPDATE evaluation_commands SET result_json='{}' WHERE command_id=?")
            .run(command.commandId),
        /Immutable evaluation outcome/,
      );
      assert.throws(
        () =>
          db.prepare("DELETE FROM evaluation_commands WHERE command_id=?").run(command.commandId),
        /Immutable evaluation outcome/,
      );
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM changeset_commands").get()!.n, 1);
    } finally {
      db.close();
    }
    repository.close();
    repository = new SQLiteRepository(path);
    assert.deepEqual(
      await new Tracer(repository).evaluations.getOutcome(command.commandId),
      result,
    );
  } finally {
    repository?.close();
    f.close();
  }
});
