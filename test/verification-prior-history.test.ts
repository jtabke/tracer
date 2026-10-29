import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer, serializeProjectExport } from "../src/index.ts";

test("genuine pre-correction unsafe conclusion loses current applicability while every historical record/outcome and command remain intact", async () => {
  const metadata = JSON.parse(
    readFileSync(new URL("./fixtures/verification-unsafe-prior.json", import.meta.url), "utf8"),
  );
  const bytes = gunzipSync(
    readFileSync(new URL("./fixtures/verification-unsafe-prior.sqlite.gz", import.meta.url)),
    { maxOutputLength: 1048576 },
  );
  assert.equal(createHash("sha256").update(bytes).digest("hex"), metadata.databaseSha256);
  const directory = mkdtempSync(join(tmpdir(), "tracer-legacy-prior-")),
    database = join(directory, "project.sqlite");
  writeFileSync(database, bytes);
  const repository = new SQLiteRepository(database);
  try {
    const tracer = new Tracer(repository),
      before = await tracer.exportProject();
    assert.equal(
      createHash("sha256").update(serializeProjectExport(before)).digest("hex"),
      metadata.exportSha256,
    );
    const analysis = await tracer.verification.analyze(metadata.selection);
    assert.equal(metadata.originalCompletion.state, "verified");
    assert.equal(analysis.completion.state, "needs_reassessment");
    assert.equal(analysis.view.case.version, metadata.originalCaseVersion);
    assert.deepEqual(analysis.recordedConclusion, metadata.originalConclusion);
    assert.deepEqual(
      analysis.executions.map((x) => ({ id: x.id, results: x.results })),
      metadata.originalOutcomes,
    );
    assert.equal(analysis.executions[1].priorSourceSupported, false);
    assert.deepEqual(analysis.executions[1].eligibleCriterionIds, []);
    assert.ok(
      analysis.obligations.every(
        (x) =>
          x.applicability === "wrong_basis" &&
          x.reasons.some((reason) => reason.includes("passing coverage")),
      ),
    );
    const outcome = await tracer.evaluations.getOutcome(metadata.originalConclusion.commandId);
    assert.ok(outcome);
    assert.equal(outcome.receipt.id, metadata.originalCompletion.receiptId);
    assert.deepEqual(await tracer.exportProject(), before);
  } finally {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
