import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";

// Entirely offline, disposable example: no test runner or requirement-specific types.
const directory = mkdtempSync(join(tmpdir(), "tracer-research-"));
const repository = new SQLiteRepository(":memory:");
const tracer = new Tracer(repository, undefined, observeLocal);
const actor = { actor: "researcher" };
try {
  await tracer.setSchema(
    {
      entityTypes: {
        conclusion: { fields: { text: { type: "string", required: true } } },
        artifact: { fields: { description: { type: "string", required: true } } },
      },
      relationshipTypes: {
        generated_from: { source: ["conclusion"], target: ["artifact"], fields: {} },
      },
    },
    0,
    actor,
  );
  const conclusion = await tracer.createEntity(
    {
      type: "conclusion",
      key: "CONCLUSION-1",
      fields: { text: "Positive association under analysis A" },
    },
    1,
    actor,
  );
  const inputs = [];
  for (const [key, file, content] of [
    ["DATASET-1", "data.csv", "x,y\n1,2\n2,4\n"],
    ["SCRIPT-1", "analysis.py", "print('analysis A')\n"],
  ]) {
    const artifact = await tracer.createEntity(
      { type: "artifact", key, fields: { description: file } },
      1,
      actor,
    );
    await tracer.evidence.bindExternal(
      { entityId: artifact.id, system: "file", externalId: key, ownership: "external" },
      actor,
    );
    writeFileSync(join(directory, file), content);
    const observed = await tracer.evidence.observe(
      { entityId: artifact.id, locator: { system: "file", path: join(directory, file) } },
      actor,
    );
    const link = await tracer.createRelationship(
      { type: "generated_from", source: conclusion.id, target: artifact.id, fields: {} },
      1,
      actor,
    );
    inputs.push({ entityId: artifact.id, observationId: observed.id, path: [link.id] });
  }
  const receipt = await tracer.evidence.recordReceipt(
    { outputId: conclusion.id, outcome: "Positive association", inputs },
    actor,
  );
  console.log("Recorded immutable receipt:", receipt.id);
  console.log("Initial freshness:", (await tracer.evidence.compareReceipt(receipt.id)).state);
  writeFileSync(join(directory, "data.csv"), "x,y\n1,2\n2,5\n");
  await tracer.evidence.observe(
    {
      entityId: inputs[0].entityId,
      locator: { system: "file", path: join(directory, "data.csv") },
    },
    actor,
  );
  const comparison = await tracer.evidence.compareReceipt(receipt.id);
  console.log(
    "Affected receipt and scoped dependency:",
    JSON.stringify(
      { receiptId: comparison.receiptId, state: comparison.state, input: comparison.inputs[0] },
      null,
      2,
    ),
  );
  await tracer.evidence.review(
    {
      receiptId: receipt.id,
      decision: "needs_reevaluation",
      rationale: "Dataset values changed; rerun analysis A",
      expectedComparison: comparison.token,
    },
    actor,
  );
  const reviewed = await tracer.evidence.compareReceipt(receipt.id);
  console.log("Freshness:", reviewed.state, "Review:", reviewed.review.state);
} finally {
  repository.close();
  rmSync(directory, { recursive: true, force: true });
}
