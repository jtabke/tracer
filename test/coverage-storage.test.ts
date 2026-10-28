import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";

test("format6 upgrades preserve native history and format8 retains versioned coverage on reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-coverage-storage-"));
  const database = join(directory, "project.sqlite");
  const origin = { actor: "migration engineer" };
  let repository: SQLiteRepository | undefined;
  try {
    repository = new SQLiteRepository(database);
    let tracer = new Tracer(repository);
    await tracer.setSchema(
      { entityTypes: { item: { fields: {} } }, relationshipTypes: { linked: { fields: {} } } },
      0,
      origin,
    );
    const item = await tracer.createEntity({ type: "item", fields: {} }, 1, origin);
    const baseline = await tracer.baselines.capture(
      { name: "Before coverage", expectedProjectRevision: 2 },
      origin,
    );
    const history = await tracer.history();
    repository.close();
    repository = undefined;
    const old = new DatabaseSync(database);
    old.exec(
      "DROP TABLE evaluation_commands; DROP TABLE changeset_commands; DROP TABLE receipt_dependencies; DROP INDEX receipt_supersedes; DROP INDEX coverage_source_target; DROP INDEX coverage_target_source; DROP TABLE resource_identities; DROP INDEX resource_source_identity; ALTER TABLE entities DROP COLUMN resource_json; ALTER TABLE relationships DROP COLUMN reference_json; UPDATE storage_version SET version=6",
    );
    old.close();
    repository = new SQLiteRepository(database);
    tracer = new Tracer(repository);
    assert.deepEqual(await tracer.history(), history);
    assert.deepEqual(await tracer.baselines.get(baseline.id), baseline);
    assert.deepEqual((await tracer.coverage.list()).expectations, {});
    const expectations = {
      linked: {
        name: "At least one related item",
        subject: { type: "item" },
        related: { type: "item" },
        relationshipType: "linked",
        direction: "outgoing" as const,
        minimumDistinctTargets: 1,
      },
    };
    await tracer.coverage.set({ expectations, expectedSchemaVersion: 1 }, origin);
    const committedHistory = await tracer.history();
    repository.close();
    repository = new SQLiteRepository(database);
    tracer = new Tracer(repository);
    assert.deepEqual((await tracer.getSchema())!.coverageExpectations, expectations);
    assert.deepEqual((await tracer.coverage.list()).expectations, expectations);
    assert.deepEqual(await tracer.history(), committedHistory);
    assert.deepEqual((await tracer.coverage.list({ baselineId: baseline.id })).expectations, {});
    const evaluation = await tracer.coverage.evaluate({ expectationId: "linked" });
    assert.equal(evaluation.rows.items[0].subject.id, item.id);
    assert.equal(evaluation.rows.items[0].state, "missing");
    repository.close();
    repository = undefined;
    const inspect = new DatabaseSync(database);
    assert.equal(inspect.prepare("SELECT version FROM storage_version").get()!.version, 11);
    assert.equal(
      inspect
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='index' AND name IN ('coverage_source_target','coverage_target_source')",
        )
        .get()!.count,
      2,
    );
    inspect.exec("UPDATE storage_version SET version=12");
    inspect.close();
    assert.throws(() => new SQLiteRepository(database), { code: "unsupported_storage" });
    const retained = new DatabaseSync(database);
    assert.equal(retained.prepare("SELECT version FROM storage_version").get()!.version, 12);
    assert.deepEqual(
      JSON.parse(
        String(
          retained.prepare("SELECT definition_json FROM schemas WHERE id='project'").get()!
            .definition_json,
        ),
      ).coverageExpectations,
      expectations,
    );
    retained.close();
  } finally {
    repository?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
