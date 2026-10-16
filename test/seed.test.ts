import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { seedProject } from "../examples/seed-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";
import type { Observation, Receipt } from "../src/core/evidence.ts";

test("persistent seed exposes named scenarios, native views and editable offline fixtures without overwriting", async () => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-seed-test-")),
    destination = join(parent, "example");
  let repository: SQLiteRepository | undefined;
  try {
    const seeded = await seedProject(destination);
    repository = new SQLiteRepository(seeded.database);
    const tracer = new Tracer(repository, undefined, observeLocal);
    for (const [scenario, state, review] of [
      ["current", "current", "unreviewed"],
      ["changed", "changed", "unreviewed"],
      ["accepted", "changed", "accepted"],
      ["unknown", "unknown", "unreviewed"],
      ["research", "changed", "needs_reevaluation"],
      ["replacement", "current", "unreviewed"],
    ] as const) {
      const comparison = await tracer.evidence.compareReceipt(seeded.scenarios[scenario]);
      assert.equal(comparison.state, state, scenario);
      assert.equal(comparison.review.state, review, scenario);
    }
    assert.deepEqual(
      (await tracer.evidence.compareReceipt(seeded.scenarios.superseded)).supersededBy,
      [seeded.scenarios.replacement],
    );
    const current = await tracer.evidence.compareReceipt(seeded.scenarios.current);
    const gitInput = current.inputs.find(
      (value) => value.recorded.observation?.locator.system === "git",
    )!;
    assert.notEqual(gitInput.recorded.observation?.commit, gitInput.current.observation?.commit);
    assert.equal(gitInput.recorded.observation?.hash, gitInput.current.observation?.hash);
    const matrix = await tracer.getMatrix({
      sourceType: "requirement",
      targetType: "artifact",
      relationshipType: "implemented_by",
    });
    assert.equal(matrix.links.length, 1);
    assert.equal(matrix.missingSourceIds.length, 1);
    assert.equal((await tracer.getTable({ type: "conclusion" })).entities.items.length, 1);
    const dataset = (await tracer.queryEntities({ key: "DATASET-01" })).items[0];
    const previous = (await tracer.evidence.list("observation", { subject: dataset.id })).items.at(
      -1,
    ) as Observation;
    writeFileSync(join(destination, "dataset.csv"), "x,y\n1,8\n2,9\n");
    await tracer.evidence.observe(
      { entityId: dataset.id, locator: previous.locator },
      { actor: "demo-user" },
    );
    const research = await tracer.evidence.compareReceipt(seeded.scenarios.research);
    assert.equal(research.state, "changed");
    assert.equal(research.review.state, "unreviewed");
    const immutable = (await tracer.evidence.list("receipt")).items.find(
      (value) => value.id === seeded.scenarios.research,
    ) as Receipt;
    assert.equal(
      immutable.inputs[0].observation?.hash,
      research.inputs[0].recorded.observation?.hash,
    );
    assert.deepEqual(
      JSON.parse(readFileSync(join(destination, "scenarios.json"), "utf8")),
      seeded.scenarios,
    );
    writeFileSync(join(destination, "keep.txt"), "user data");
    await assert.rejects(seedProject(destination), { code: "EEXIST" });
    assert.equal(readFileSync(join(destination, "keep.txt"), "utf8"), "user data");
    assert.equal(
      (await tracer.evidence.compareReceipt(seeded.scenarios.accepted)).review.state,
      "accepted",
    );
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [resolve("src/interfaces/serve.ts"), "--seed-demo", "--db", seeded.database],
          { stdio: "pipe" },
        ),
      /cannot be combined/,
    );
  } finally {
    repository?.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("seed CLI creates a persistent project and refuses to reseed it", () => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-seed-cli-")),
    destination = join(parent, "demo");
  try {
    const output = execFileSync(process.execPath, [resolve("examples/seed.ts"), destination], {
      encoding: "utf8",
    });
    assert.match(output, /Seeded project:/);
    assert.match(output, /npm start -- --db/);
    assert.throws(
      () =>
        execFileSync(process.execPath, [resolve("examples/seed.ts"), destination], {
          stdio: "pipe",
        }),
      /EEXIST/,
    );
    assert.ok(readFileSync(join(destination, "project.sqlite")).length > 0);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
