import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import type { ChangeImpact, ChangeImpactQuery } from "../src/core/impact.ts";

function subprocess(database: string) {
  const invoke = (tokens: string[]) =>
    spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        resolve("src/interfaces/cli.ts"),
        "--db",
        database,
        ...tokens,
      ],
      { encoding: "utf8" },
    );
  return {
    read(query: ChangeImpactQuery): ChangeImpact {
      const result = invoke(["impact", "get", JSON.stringify(query)]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      return JSON.parse(result.stdout) as ChangeImpact;
    },
    error(code: string, tokens: string[]) {
      const result = invoke(tokens);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr.trim().split("\n").length, 1);
      assert.equal(JSON.parse(result.stderr).error, code);
    },
  };
}
const scenarios = {
  medical: { root: "PRS-02", types: ["decomposes_into", "realized_by", "verified_by"] },
  technology: { root: "STORY-03", types: ["implemented_by", "checked_by"] },
  integrated: { root: "DES-01", types: ["depends_on", "evaluated_by"] },
};
for (const domain of ["medical", "technology", "integrated"] as const) {
  test(`headless ${domain} change investigation preserves baseline context and exact scoped evidence parity`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-impact-cli-"));
    let repository: SQLiteRepository | undefined;
    try {
      const fixture = await seedRealisticProject(join(directory, "project"), domain);
      repository = new SQLiteRepository(fixture.database);
      const tracer = new Tracer(repository),
        actor = { actor: "impact engineer" };
      const root = fixture.entities[scenarios[domain].root];
      const baseline = await tracer.baselines.capture(
        {
          id: "impact-review",
          name: "Before proposed revision",
          expectedProjectRevision: (await tracer.timeline()).head,
        },
        actor,
      );
      const originalQuery: ChangeImpactQuery = {
        baselineId: baseline.id,
        rootId: root.id,
        direction: "outgoing",
        relationshipTypes: [],
        limit: 1,
      };
      const original = await tracer.getChangeImpact(originalQuery);
      assert.equal(original.native.entities[0].state, "unchanged");
      assert.equal(original.evaluations.items.length, 1);
      // Seeds deliberately contain capture drift before this baseline; it is not caused by a later native edit.
      assert.equal(original.evaluations.items[0].scope.state, "changed");
      const revised = await tracer.updateEntity(
        root.id,
        root.version,
        {
          fields: {
            ...root.fields,
            statement: "Later explicitly recorded headless engineering revision",
          },
        },
        1,
        actor,
      );
      const head = (await tracer.timeline()).head;
      const query: ChangeImpactQuery = {
        ...originalQuery,
        relationshipTypes: scenarios[domain].types,
        depth: 2,
        expectedProjectRevision: head,
      };
      const expectedPages: ChangeImpact[] = [];
      let after: string | undefined;
      do {
        const result: ChangeImpact = await tracer.getChangeImpact({ ...query, after });
        expectedPages.push(result);
        after = result.evaluations.nextAfter;
      } while (after);
      const beforeHistory = await tracer.history({ limit: 1000 });
      const beforeEvidence = await tracer.evidence.list("receipt", { limit: 1000 });
      const expectedNative = expectedPages[0].native;
      const rootDelta = expectedNative.entities.find((item) => item.id === root.id)!;
      assert.equal(rootDelta.state, "modified");
      assert.deepEqual(rootDelta.before, root);
      assert.deepEqual(rootDelta.after, revised);
      assert.deepEqual(expectedPages[0].context.baseline, baseline);
      assert.ok(
        expectedPages
          .flatMap((page) => page.evaluations.items)
          .some((item) => item.scope.hasChanged),
      );
      repository.close();
      repository = undefined;
      const cli = subprocess(fixture.database);
      let cursor: string | undefined;
      for (const expected of expectedPages) {
        const actual = cli.read({ ...query, after: cursor });
        assert.deepEqual(actual, expected);
        assert.equal(actual.summary.scope, "page");
        assert.equal(actual.summary.evaluated, actual.evaluations.items.length);
        cursor = actual.evaluations.nextAfter;
      }
      assert.equal(cursor, undefined);
      cli.error("conflict", [
        "impact",
        "get",
        JSON.stringify({ ...query, expectedProjectRevision: head - 1 }),
      ]);
      cli.error("validation", [
        "impact",
        "get",
        JSON.stringify({ ...query, relationshipTypes: ["not-declared"] }),
      ]);
      cli.error("validation", ["impact", "get", JSON.stringify({ ...query, limit: 0 })]);
      cli.error("not_found", [
        "impact",
        "get",
        JSON.stringify({ ...query, baselineId: "missing" }),
      ]);
      cli.error("usage", ["impact", "get", "[]"]);
      cli.error("usage", ["impact", "get"]);
      repository = new SQLiteRepository(fixture.database);
      const reopened = new Tracer(repository);
      assert.deepEqual(await reopened.history({ limit: 1000 }), beforeHistory);
      assert.deepEqual(await reopened.evidence.list("receipt", { limit: 1000 }), beforeEvidence);
      assert.deepEqual(await reopened.baselines.get(baseline.id), baseline);
    } finally {
      repository?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
