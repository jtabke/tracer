import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";
import type { Schema } from "../src/core/model.ts";
import type { Receipt, Review } from "../src/core/evidence.ts";

const origin = { actor: "engineer" };
const schema: Schema = {
  entityTypes: {
    item: { fields: { title: { type: "string", required: true }, note: { type: "string" } } },
  },
  relationshipTypes: { references: { fields: {} }, generated_from: { fields: {} } },
};
async function fixture(work: (tracer: Tracer, directory: string, path: string) => Promise<void>) {
  const directory = mkdtempSync(join(tmpdir(), "tracer-evidence-")),
    path = join(directory, "project.sqlite");
  const repo = new SQLiteRepository(path),
    tracer = new Tracer(repo, undefined, observeLocal);
  try {
    await tracer.setSchema(schema, 0, origin);
    await work(tracer, directory, path);
  } finally {
    repo.close();
    rmSync(directory, { recursive: true, force: true });
  }
}
const create = (tracer: Tracer, key: string) =>
  tracer.createEntity({ type: "item", key, fields: { title: key } }, 1, origin);
function git(directory: string, ...args: string[]) {
  return execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  }).trim();
}
function initGit(directory: string) {
  git(directory, "init", "--quiet");
  git(directory, "config", "user.email", "fixture@example.invalid");
  git(directory, "config", "user.name", "Fixture");
  git(directory, "config", "commit.gpgsign", "false");
}
function commit(directory: string) {
  git(directory, "add", ".");
  git(directory, "commit", "--quiet", "-m", "fixture");
}

test("offline requirement: stable identities, scoped commits, paths, unknowns, reviews and supersession", () =>
  fixture(async (tracer, directory, path) => {
    const requirement = await create(tracer, "REQ-001"),
      implementation = await create(tracer, "FW-03"),
      report = await create(tracer, "REPORT-01");
    // Only this disposable fixture is committed. Never stage the Tracer checkout.
    const source = join(directory, "source");
    mkdirSync(source);
    initGit(source);
    writeFileSync(join(source, "motor.ts"), "speed=100\n");
    writeFileSync(join(source, "unrelated.txt"), "a");
    commit(source);
    const identity = await tracer.evidence.bindExternal(
      {
        entityId: implementation.id,
        system: "git",
        externalId: "firmware-module-03",
        ownership: "external",
      },
      origin,
    );
    const reference = await tracer.createRelationship(
      { type: "references", source: requirement.id, target: implementation.id, fields: {} },
      1,
      origin,
    );
    const dependency = await tracer.createRelationship(
      { type: "generated_from", source: report.id, target: requirement.id, fields: {} },
      1,
      origin,
    );
    const observed = await tracer.evidence.observe(
      {
        entityId: implementation.id,
        locator: { system: "git", repository: source, path: "motor.ts", ref: "HEAD" },
      },
      origin,
    );
    assert.equal(observed.availability, "available");
    assert.equal(observed.commit, git(source, "rev-parse", "HEAD"));
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: report.id,
        outcome: "PASS",
        inputs: [
          { entityId: requirement.id, path: [dependency.id] },
          {
            entityId: implementation.id,
            observationId: observed.id,
            path: [dependency.id, reference.id],
          },
        ],
      },
      origin,
    );
    await assert.rejects(
      tracer.evidence.recordReceipt(
        {
          outputId: report.id,
          expectedOutputVersion: 0,
          outcome: "Stale",
          inputs: [{ entityId: requirement.id }],
        },
        origin,
      ),
      { code: "conflict" },
    );
    await assert.rejects(
      tracer.evidence.recordReceipt(
        {
          outputId: report.id,
          outcome: "Stale",
          inputs: [{ entityId: requirement.id, expectedVersion: 0 }],
        },
        origin,
      ),
      { code: "conflict" },
    );
    const baseline = JSON.stringify(receipt);
    const nativeHistory = (await tracer.history({ id: implementation.id })).items;
    assert.equal((await tracer.evidence.compareReceipt(receipt.id)).state, "current");
    writeFileSync(join(source, "unrelated.txt"), "b");
    commit(source);
    const unrelated = await tracer.evidence.observe(
      { entityId: implementation.id, locator: observed.locator },
      origin,
    );
    assert.notEqual(unrelated.commit, observed.commit);
    assert.equal(unrelated.hash, observed.hash);
    assert.deepEqual((await tracer.history({ id: implementation.id })).items, nativeHistory);
    let compared = await tracer.evidence.compareReceipt(receipt.id);
    assert.equal(compared.state, "current");
    await tracer.evidence.review(
      {
        receiptId: receipt.id,
        decision: "accepted",
        rationale: "Scoped input matches",
        expectedComparison: compared.token,
      },
      origin,
    );
    writeFileSync(join(source, "unrelated.txt"), "c");
    commit(source);
    await tracer.evidence.observe(
      { entityId: implementation.id, locator: observed.locator },
      origin,
    );
    assert.equal((await tracer.evidence.compareReceipt(receipt.id)).review.state, "accepted");
    writeFileSync(join(source, "motor.ts"), "speed=120\n");
    commit(source);
    // Compares recorded observations only, never pretends to know unobserved live state.
    assert.equal((await tracer.evidence.compareReceipt(receipt.id)).state, "current");
    const relevant = await tracer.evidence.observe(
      { entityId: implementation.id, locator: observed.locator },
      origin,
    );
    compared = await tracer.evidence.compareReceipt(receipt.id);
    assert.equal(compared.state, "changed");
    assert.equal(compared.review.state, "unreviewed");
    assert.deepEqual(compared.inputs[1].dependencyPath, [
      report.id,
      dependency.id,
      reference.id,
      implementation.id,
    ]);
    assert.equal(compared.inputs[1].recorded.observation?.commit, observed.commit);
    assert.equal(compared.inputs[1].current.observation?.commit, relevant.commit);
    const review = await tracer.evidence.review(
      {
        receiptId: receipt.id,
        decision: "accepted",
        rationale: "Speed range remains covered",
        expectedComparison: compared.token,
      },
      origin,
    );
    compared = await tracer.evidence.compareReceipt(receipt.id);
    assert.equal(compared.state, "changed");
    assert.equal(compared.review.state, "accepted");
    await tracer.updateEntity(
      requirement.id,
      1,
      { fields: { title: "Motor speed revised" } },
      1,
      origin,
    );
    await assert.rejects(
      tracer.evidence.review(
        {
          receiptId: receipt.id,
          decision: "accepted",
          rationale: "Stale comparison",
          expectedComparison: compared.token,
        },
        origin,
      ),
      { code: "conflict" },
    );
    assert.equal((await tracer.evidence.compareReceipt(receipt.id)).review.state, "unreviewed");
    renameSync(join(source, "motor.ts"), join(source, "renamed.ts"));
    commit(source);
    const missing = await tracer.evidence.observe(
      { entityId: implementation.id, locator: observed.locator },
      origin,
    );
    assert.equal(missing.availability, "unknown");
    compared = await tracer.evidence.compareReceipt(receipt.id);
    assert.equal(compared.state, "unknown");
    assert.equal(compared.hasChanged, true);
    await assert.rejects(
      tracer.evidence.review(
        {
          receiptId: receipt.id,
          decision: "accepted",
          rationale: "Cannot know",
          expectedComparison: compared.token,
        },
        origin,
      ),
      { code: "validation" },
    );
    await tracer.evidence.review(
      {
        receiptId: receipt.id,
        decision: "needs_reevaluation",
        rationale: "Resolve missing path",
        expectedComparison: compared.token,
      },
      origin,
    );
    const moved = await tracer.evidence.observe(
      {
        entityId: implementation.id,
        locator: {
          ...observed.locator,
          system: "git",
          repository: source,
          ref: "HEAD",
          path: "renamed.ts",
        },
      },
      origin,
    );
    assert.equal(moved.hash, relevant.hash);
    assert.deepEqual((await tracer.evidence.list("external")).items, [identity]);
    const replacement = await tracer.evidence.recordReceipt(
      {
        outputId: report.id,
        outcome: "Reevaluated",
        inputs: [{ entityId: implementation.id, observationId: moved.id }],
        supersedes: receipt.id,
      },
      origin,
    );
    assert.deepEqual((await tracer.evidence.compareReceipt(receipt.id)).supersededBy, [
      replacement.id,
    ]);
    assert.equal(JSON.stringify((await tracer.evidence.list("receipt")).items[0]), baseline);
    assert.deepEqual(
      (await tracer.evidence.list("review", { subject: receipt.id })).items[1],
      review,
    );
    const reopened = new SQLiteRepository(path);
    try {
      assert.equal(
        (await new Tracer(reopened).evidence.compareReceipt(receipt.id)).hasChanged,
        true,
      );
    } finally {
      reopened.close();
    }
    const db = new DatabaseSync(path);
    try {
      assert.equal(db.prepare("SELECT version FROM storage_version").get()?.version, 11);
      assert.throws(
        () => db.prepare("UPDATE evidence SET payload_json='{}'").run(),
        /Immutable evidence/,
      );
      assert.throws(() => db.prepare("DELETE FROM evidence").run(), /Immutable evidence/);
    } finally {
      db.close();
    }
  }));

test("research conclusion: dataset and script snapshots, scoped native fields, missing files and immutable unknowns", () =>
  fixture(async (tracer, directory) => {
    const conclusion = await create(tracer, "CONCLUSION-1"),
      dataset = await create(tracer, "DATASET-1"),
      script = await create(tracer, "SCRIPT-1"),
      method = await create(tracer, "METHOD-1"),
      mentioned = await create(tracer, "MENTION-1");
    const dataPath = join(directory, "data.csv"),
      scriptPath = join(directory, "analysis.py");
    writeFileSync(dataPath, "x,y\n1,2\n");
    writeFileSync(scriptPath, "print('analysis')\n");
    for (const item of [dataset, script])
      await tracer.evidence.bindExternal(
        { entityId: item.id, system: "file", externalId: item.key!, ownership: "external" },
        origin,
      );
    const data = await tracer.evidence.observe(
        { entityId: dataset.id, locator: { system: "file", path: dataPath } },
        origin,
      ),
      code = await tracer.evidence.observe(
        { entityId: script.id, locator: { system: "file", path: scriptPath } },
        origin,
      );
    await tracer.createRelationship(
      { type: "references", source: conclusion.id, target: mentioned.id, fields: {} },
      1,
      origin,
    );
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: conclusion.id,
        outcome: "Positive association under method M",
        inputs: [
          { entityId: dataset.id, observationId: data.id },
          { entityId: script.id, observationId: code.id },
          { entityId: method.id, fields: ["title"] },
        ],
      },
      origin,
    );
    let compared = await tracer.evidence.compareReceipt(receipt.id);
    await tracer.evidence.review(
      {
        receiptId: receipt.id,
        decision: "accepted",
        rationale: "Inputs verified",
        expectedComparison: compared.token,
      },
      origin,
    );
    await tracer.updateEntity(
      mentioned.id,
      1,
      { fields: { title: "Unrelated mention changed" } },
      1,
      origin,
    );
    await tracer.updateEntity(
      method.id,
      1,
      { fields: { title: method.fields.title!, note: "Annotation only" } },
      1,
      origin,
    );
    await tracer.updateEntity(dataset.id, 1, { fields: { title: "Tracer annotation" } }, 1, origin);
    compared = await tracer.evidence.compareReceipt(receipt.id);
    assert.equal(compared.state, "current");
    assert.equal(compared.review.state, "accepted");
    writeFileSync(dataPath, "x,y\n1,9\n");
    await tracer.evidence.observe({ entityId: dataset.id, locator: data.locator }, origin);
    compared = await tracer.evidence.compareReceipt(receipt.id);
    assert.equal(compared.state, "changed");
    assert.equal(compared.inputs[0].state, "changed");
    assert.equal(compared.inputs[1].state, "current");
    rmSync(scriptPath);
    const missing = await tracer.evidence.observe(
      { entityId: script.id, locator: code.locator },
      origin,
    );
    const unknown = await tracer.evidence.recordReceipt(
      {
        outputId: conclusion.id,
        outcome: "Incomplete evaluation",
        inputs: [{ entityId: script.id, observationId: missing.id }],
      },
      origin,
    );
    assert.equal((await tracer.evidence.compareReceipt(receipt.id)).hasUnknown, true);
    writeFileSync(scriptPath, "print('analysis')\n");
    await tracer.evidence.observe({ entityId: script.id, locator: code.locator }, origin);
    assert.equal((await tracer.evidence.compareReceipt(unknown.id)).state, "unknown"); // Never backfill unknown historical evidence.
    assert.equal((await tracer.evidence.compareReceipt(receipt.id)).state, "changed");
  }));

test("dependency topology, deletion, validation, pagination and rollback", () =>
  fixture(async (tracer, directory) => {
    const output = await create(tracer, "OUT"),
      input = await create(tracer, "INPUT"),
      other = await create(tracer, "OTHER");
    const dependency = await tracer.createRelationship(
      { type: "generated_from", source: output.id, target: input.id, fields: {} },
      1,
      origin,
    );
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        outcome: "Done",
        inputs: [{ entityId: input.id, path: [dependency.id] }],
      },
      origin,
    );
    await tracer.updateRelationship(
      dependency.id,
      1,
      { type: "references", source: output.id, target: other.id, fields: {} },
      1,
      origin,
    );
    assert.equal((await tracer.evidence.compareReceipt(receipt.id)).hasChanged, true);
    await tracer.removeEntity(input.id, 1, 1, origin);
    const compared = await tracer.evidence.compareReceipt(receipt.id);
    assert.equal(compared.hasUnknown, true);
    assert.equal(compared.hasChanged, true);
    for (const declaration of [
      { entityId: other.id, path: ["missing"] },
      { entityId: other.id, fields: ["absent"] },
      { entityId: other.id, observationId: "missing" },
    ])
      await assert.rejects(
        tracer.evidence.recordReceipt(
          { outputId: output.id, outcome: "Bad", inputs: [declaration] },
          origin,
        ),
        { code: "validation" },
      );
    await assert.rejects(
      tracer.evidence.recordReceipt(
        {
          outputId: output.id,
          outcome: "Bad",
          inputs: [{ entityId: other.id }, { entityId: other.id }],
        },
        origin,
      ),
      { code: "validation" },
    );
    await tracer.evidence.bindExternal(
      { entityId: other.id, system: "file", externalId: "unique-source", ownership: "external" },
      origin,
    );
    await assert.rejects(
      tracer.evidence.bindExternal(
        { entityId: output.id, system: "file", externalId: "unique-source", ownership: "external" },
        origin,
      ),
      { code: "conflict" },
    );
    await assert.rejects(
      tracer.evidence.bindExternal(
        { entityId: other.id, system: "file", externalId: "another-source", ownership: "external" },
        origin,
      ),
      { code: "conflict" },
    );
    await assert.rejects(
      tracer.evidence.observe(
        {
          entityId: other.id,
          locator: { system: "git", repository: directory, path: "../unsafe", ref: "HEAD" },
        },
        origin,
      ),
      { code: "validation" },
    );
    assert.throws(() => tracer.evidence.list("receipt", { limit: 0 }), { code: "validation" });
    await tracer.evidence.review(
      {
        receiptId: receipt.id,
        decision: "acknowledged",
        rationale: "Deleted dependency noted",
        expectedComparison: compared.token,
      },
      origin,
    );
    await tracer.evidence.review(
      {
        receiptId: receipt.id,
        decision: "needs_reevaluation",
        rationale: "Run again",
        expectedComparison: compared.token,
      },
      origin,
    );
    const page = await tracer.evidence.list("review", { subject: receipt.id, limit: 1 }),
      next = await tracer.evidence.list("review", {
        subject: receipt.id,
        limit: 1,
        after: page.nextAfter,
      });
    assert.equal(page.items.length, 1);
    assert.equal(next.items.length, 1);
    assert.equal((next.items[0] as Review).decision, "needs_reevaluation");
    assert.match(page.nextAfter!, /^\d+$/);
    assert.equal(next.nextAfter, undefined);
    const exact = await tracer.evidence.list("review", { subject: receipt.id, limit: 2 });
    assert.equal(exact.items.length, 2);
    assert.equal(exact.nextAfter, undefined);
    assert.deepEqual(await tracer.evidence.list("review", { subject: "missing", limit: 1 }), {
      items: [],
    });
    assert.equal((await tracer.evidence.list("receipt")).items.length, 1);
  }));

test("format 2 upgrades transactionally without rewriting native history", () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-format2-")),
    path = join(directory, "db.sqlite");
  try {
    const repo = new SQLiteRepository(path);
    repo.close();
    const db = new DatabaseSync(path);
    db.exec(
      "DROP TABLE evaluation_commands; DROP TABLE changeset_commands; DROP TABLE receipt_dependencies; DROP INDEX receipt_supersedes; DROP INDEX coverage_source_target; DROP INDEX coverage_target_source; DROP TABLE baselines; DROP TABLE evidence; DROP TABLE workspace_views; DROP TABLE configurations; DROP TABLE resource_identities; DROP INDEX resource_source_identity; ALTER TABLE entities DROP COLUMN resource_json; ALTER TABLE relationships DROP COLUMN reference_json; UPDATE storage_version SET version=2",
    );
    db.close();
    const upgraded = new SQLiteRepository(path);
    upgraded.close();
    const verify = new DatabaseSync(path);
    assert.equal(verify.prepare("SELECT version FROM storage_version").get()?.version, 11);
    assert.equal(verify.prepare("SELECT COUNT(*) AS n FROM evidence").get()?.n, 0);
    verify.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CLI exposes the same offline receipt, comparison and review workflow", () =>
  fixture(async (tracer, directory, path) => {
    const output = await create(tracer, "CLI-OUT"),
      input = await create(tracer, "CLI-IN");
    writeFileSync(join(directory, "input.txt"), "original");
    function cli(...args: string[]) {
      return JSON.parse(
        execFileSync(
          process.execPath,
          [resolve("src/interfaces/cli.ts"), "--db", path, "--actor", "cli-engineer", ...args],
          { encoding: "utf8" },
        ),
      );
    }
    cli(
      "external",
      "bind",
      JSON.stringify({
        entityId: input.id,
        system: "file",
        externalId: "cli-input",
        ownership: "external",
      }),
    );
    const observation = cli(
      "observation",
      "record",
      JSON.stringify({
        entityId: input.id,
        locator: { system: "file", path: join(directory, "input.txt") },
      }),
    );
    const receipt: Receipt = cli(
      "receipt",
      "record",
      JSON.stringify({
        outputId: output.id,
        outcome: "Conclusion",
        inputs: [{ entityId: input.id, observationId: observation.id }],
      }),
    );
    writeFileSync(join(directory, "input.txt"), "changed");
    cli(
      "observation",
      "record",
      JSON.stringify({ entityId: input.id, locator: observation.locator }),
    );
    const comparison = cli("receipt", "compare", receipt.id);
    assert.equal(comparison.state, "changed");
    cli(
      "review",
      "record",
      JSON.stringify({
        receiptId: receipt.id,
        decision: "accepted",
        rationale: "Reviewed and applicable",
        expectedComparison: comparison.token,
      }),
    );
    assert.equal((await tracer.evidence.compareReceipt(receipt.id)).review.state, "accepted");
    assert.equal(cli("evidence", "list", "receipt").items[0].actor, "cli-engineer");
    assert.deepEqual(cli("evidence", "list", "receipt").items[0], receipt);
  }));

test("comparison retains both unknown entity and changed path facts without altering captured receipt or review token", () =>
  fixture(async (tracer) => {
    const output = await create(tracer, "OUTPUT"),
      input = await create(tracer, "INPUT");
    const dependency = await tracer.createRelationship(
      { type: "references", source: output.id, target: input.id, fields: {} },
      1,
      origin,
    );
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        outcome: "Recorded",
        inputs: [{ entityId: input.id, path: [dependency.id] }],
      },
      origin,
    );
    const captured = JSON.stringify(receipt);
    const current = await tracer.evidence.compareReceipt(receipt.id);
    await tracer.removeRelationship(dependency.id, dependency.version, 1, origin);
    await tracer.removeEntity(input.id, input.version, 1, origin);
    const compared = await tracer.evidence.compareReceipt(receipt.id);
    assert.equal(compared.state, "unknown");
    assert.equal(compared.hasUnknown, true);
    assert.equal(compared.hasChanged, true);
    assert.equal(compared.inputs[0].hasUnknown, true);
    assert.equal(compared.inputs[0].hasChanged, true);
    assert.match(compared.inputs[0].reasons.join("; "), /deleted or unavailable/);
    assert.match(compared.inputs[0].reasons.join("; "), /removed/);
    assert.notEqual(compared.token, current.token);
    assert.equal(JSON.stringify((await tracer.evidence.list("receipt")).items[0]), captured);
    await assert.rejects(
      tracer.evidence.review(
        {
          receiptId: receipt.id,
          decision: "accepted",
          rationale: "Captured before removal",
          expectedComparison: current.token,
        },
        origin,
      ),
      { code: "conflict" },
    );
    await assert.rejects(
      tracer.evidence.review(
        {
          receiptId: receipt.id,
          decision: "accepted",
          rationale: "Unresolved input",
          expectedComparison: compared.token,
        },
        origin,
      ),
      { code: "validation" },
    );
  }));
