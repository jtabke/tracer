import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import type { CoverageCatalogue, CoverageEvaluation } from "../src/core/coverage.ts";
import type { SchemaObject } from "../src/core/model.ts";
import type { Baseline } from "../src/core/baseline.ts";

function commands(database: string) {
  const invoke = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        resolve("src/interfaces/cli.ts"),
        "--db",
        database,
        "--actor",
        "coverage engineer",
        "--reason",
        "Review structural gaps",
        ...args,
      ],
      { encoding: "utf8" },
    );
  return {
    read<T>(...args: string[]): T {
      const result = invoke(...args);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      return JSON.parse(result.stdout) as T;
    },
    error(code: string, ...args: string[]) {
      const result = invoke(...args);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr.trim().split("\n").length, 1);
      assert.equal(JSON.parse(result.stderr).error, code);
    },
  };
}

for (const domain of ["medical", "technology", "integrated"] as const) {
  test(`CLI ${domain} project coverage matches complete native topology and preserves captured policy`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-coverage-cli-"));
    try {
      const fixture = await seedRealisticProject(join(directory, "project"), domain);
      const repository = new SQLiteRepository(fixture.database);
      const tracer = new Tracer(repository);
      const head = (await tracer.timeline()).head;
      const originalHistory = await tracer.history({ limit: 1000 });
      repository.close();
      const cli = commands(fixture.database);
      const catalogue = cli.read<CoverageCatalogue>("coverage", "list");
      assert.deepEqual(catalogue.context, { projectRevision: head, schemaVersion: 1 });
      assert.equal(Object.keys(catalogue.expectations).length, 3);
      let missing = 0,
        covered = 0;
      for (const [expectationId, expectation] of Object.entries(catalogue.expectations)) {
        const subjects = Object.values(fixture.entities).filter(
          (item) => item.type === expectation.subject.type,
        );
        const seen: string[] = [];
        let after: string | undefined;
        do {
          const result = cli.read<CoverageEvaluation>(
            "coverage",
            "evaluate",
            JSON.stringify({ expectationId, limit: 4, after }),
          );
          assert.equal(result.summary.scope, "page");
          assert.equal(result.summary.evaluated, result.rows.items.length);
          for (const row of result.rows.items) {
            const matching = fixture.relationships.filter(
              (link) =>
                link.type === expectation.relationshipType &&
                link.source === row.subject.id &&
                Object.values(fixture.entities).some(
                  (item) => item.id === link.target && item.type === expectation.related.type,
                ),
            );
            const targets = new Set(matching.map((link) => link.target));
            assert.equal(row.distinctTargets, targets.size);
            assert.equal(row.matchingRelationships, matching.length);
            assert.equal(
              row.state,
              targets.size >= expectation.minimumDistinctTargets ? "covered" : "missing",
            );
            assert.ok(row.samples.length <= 3);
            assert.equal(row.samplesComplete, targets.size <= 3);
            assert.equal(
              new Set(row.samples.map((sample) => sample.related.id)).size,
              row.samples.length,
            );
            seen.push(row.subject.id);
          }
          missing += result.summary.missing;
          covered += result.summary.covered;
          assert.equal(result.summary.unknown, 0);
          after = result.rows.nextAfter;
        } while (after);
        assert.deepEqual(new Set(seen), new Set(subjects.map((subject) => subject.id)));
        assert.equal(seen.length, subjects.length);
      }
      assert.ok(missing > 0, "Example demonstrates structural gaps");
      assert.ok(covered > 0, "Example demonstrates linked subjects");
      assert.deepEqual(cli.read("history", JSON.stringify({ limit: 1000 })), originalHistory);
      const baseline = cli.read<Baseline>(
        "baseline",
        "capture",
        JSON.stringify({
          id: "coverage-review",
          name: "Captured authored policy",
          expectedProjectRevision: head,
        }),
      );
      const expectationId = Object.keys(catalogue.expectations)[0];
      const first = cli.read<CoverageEvaluation>(
        "coverage",
        "evaluate",
        JSON.stringify({ expectationId, limit: 1 }),
      );
      assert.ok(first.rows.nextAfter);
      const captured = cli.read<CoverageEvaluation>(
        "coverage",
        "evaluate",
        JSON.stringify({ expectationId, baselineId: baseline.id }),
      );
      const schema = cli.read<SchemaObject>(
        "coverage",
        "set",
        JSON.stringify({ expectedSchemaVersion: 1, expectations: {} }),
      );
      assert.equal(schema.version, 2);
      assert.deepEqual(cli.read<CoverageCatalogue>("coverage", "list").expectations, {});
      assert.deepEqual(
        cli.read<CoverageEvaluation>(
          "coverage",
          "evaluate",
          JSON.stringify({ expectationId, baselineId: baseline.id }),
        ),
        captured,
      );
      assert.deepEqual(
        cli.read<CoverageCatalogue>("coverage", "list", JSON.stringify({ baselineId: baseline.id }))
          .expectations,
        catalogue.expectations,
      );
      const settled = cli.read("history", JSON.stringify({ limit: 1000 }));
      cli.error(
        "schema_conflict",
        "coverage",
        "set",
        JSON.stringify({ expectedSchemaVersion: 1, expectations: catalogue.expectations }),
      );
      cli.error(
        "conflict",
        "coverage",
        "evaluate",
        JSON.stringify({ expectationId, after: first.rows.nextAfter }),
      );
      cli.error("not_found", "coverage", "evaluate", JSON.stringify({ expectationId }));
      cli.error(
        "validation",
        "coverage",
        "evaluate",
        JSON.stringify({ expectationId, baselineId: baseline.id, expectedProjectRevision: head }),
      );
      cli.error("usage", "coverage", "list", "[]");
      cli.error("usage", "coverage", "set");
      assert.deepEqual(cli.read("history", JSON.stringify({ limit: 1000 })), settled);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
