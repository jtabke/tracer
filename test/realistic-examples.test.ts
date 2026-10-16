import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";

const scenarios = {
  medical: {
    changed: "PRS-02",
    changedOutput: "RUN-01",
    failedOutput: "RUN-06",
    shared: "CMP-05",
    relationship: "decomposes_into",
    configuration: "BUILD-MED-A",
  },
  technology: {
    changed: "STORY-03",
    changedOutput: "RUN-TECH-02",
    failedOutput: "RUN-TECH-03",
    shared: "WORK-03",
    relationship: "implemented_by",
    configuration: "BUILD-TECH-A",
  },
  integrated: {
    changed: "DES-01",
    changedOutput: "EVAL-R02",
    failedOutput: "EVAL-R04",
    shared: "DES-01",
    relationship: "realized_by",
    configuration: "BUILD-R01",
  },
};

async function verifyCapturedEvidence(
  tracer: Tracer,
  fixture: Awaited<ReturnType<typeof seedRealisticProject>>,
) {
  const scenario = scenarios[fixture.domain];
  const changedKey = scenario.changed;
  const history = await tracer.history({ kind: "entity", id: fixture.entities[changedKey].id });
  assert.deepEqual(
    history.items.map((revision) => revision.version),
    [1, 2],
  );
  const changedOutput = scenario.changedOutput;
  const changedReceipt = fixture.receipts.find((receipt) => receipt.output === changedOutput)!;
  const comparison = await tracer.evidence.compareReceipt(changedReceipt.id);
  assert.equal(comparison.state, "changed");
  const changedInput = comparison.inputs.find(
    (input) => input.entityId === fixture.entities[changedKey].id,
  )!;
  assert.equal(changedInput.recorded.entity.version, 1);
  assert.equal(changedInput.current.entity?.version, 2);
  const failedOutput = scenario.failedOutput;
  const failedReceipt = fixture.receipts.find((receipt) => receipt.output === failedOutput)!;
  const failedComparison = await tracer.evidence.compareReceipt(failedReceipt.id);
  assert.equal(failedComparison.state, "current", "freshness is independent of failure outcome");
  assert.equal(failedComparison.review.state, "unreviewed");
  assert.match(String(fixture.entities[failedOutput].fields.outcome), /SIMULATED fail/i);
  const configuration = fixture.entities[scenario.configuration];
  const manifest = configuration.fields.manifest as {
    entityId: string;
    key: string;
    version: number;
  }[];
  assert.equal(
    manifest.find((entry) => entry.key === changedKey)?.version,
    1,
    "manifest retains the recorded revision",
  );
  assert.equal(fixture.entities[changedKey].version, 2, "current identity has advanced");
  assert.ok(comparison.inputs.some((input) => input.entityId === configuration.id));
  const pinned = fixture.configurations[scenario.configuration];
  assert.equal(
    pinned.members.find((pin) => pin.entity.id === fixture.entities[changedKey].id)?.entity.version,
    1,
  );
  assert.equal(changedInput.recorded.pin?.entity.version, 1);
  const receipt = (
    await tracer.evidence.list("receipt", { subject: fixture.entities[changedOutput].id })
  ).items[0] as import("../src/core/evidence.ts").Receipt;
  assert.equal(receipt.configuration?.id, pinned.id);
  assert.deepEqual(await tracer.configurations.get(pinned.id), pinned);
  return changedReceipt;
}

for (const domain of ["medical", "technology", "integrated"] as const)
  test(`${domain}: deep trace, shared siblings, truthful gaps and persisted captured evidence`, async () => {
    const parent = mkdtempSync(join(tmpdir(), "tracer-realistic-test-"));
    let repository: SQLiteRepository | undefined;
    try {
      const fixture = await seedRealisticProject(join(parent, "project"), domain);
      repository = new SQLiteRepository(fixture.database);
      const tracer = new Tracer(repository);
      if (domain === "integrated") {
        const proposal = fixture.configurations.followUp;
        assert.equal(
          proposal.members.find((pin) => pin.entity.id === fixture.entities["DES-01"].id)?.entity
            .version,
          2,
        );
        assert.equal(
          proposal.members.find((pin) => pin.entity.id === fixture.entities["DES-02"].id)?.entity
            .version,
          1,
        );
        assert.match(proposal.reason!, /No evaluation receipt/);
        const receipts = (await tracer.evidence.list("receipt"))
          .items as import("../src/core/evidence.ts").Receipt[];
        assert.ok(receipts.every((receipt) => receipt.configuration?.id !== proposal.id));
      }
      const manifest = JSON.parse(readFileSync(join(fixture.directory, "tasks.json"), "utf8"));
      assert.equal(manifest.counts.entities, (await tracer.getWorkingSet()).total);
      assert.equal(
        new Set(fixture.relationships.map((link) => `${link.type}:${link.source}:${link.target}`))
          .size,
        fixture.relationships.length,
      );
      for (const task of fixture.tasks) {
        const result = await tracer.getFamily({
          rootId: task.rootId,
          relationshipType: task.relationship,
          direction: task.direction ?? "outgoing",
        });
        assert.ok(result.members.length, task.title);
        assert.equal(new URL(task.url, "http://localhost").searchParams.get("item"), task.rootId);
      }
      const chain = await tracer.getChain(fixture.chains[0].query);
      assert.ok(
        chain.rows.some((row) => row.cells.length === 8 && row.cells.every(Boolean)),
        "full eight-level path is stored",
      );
      assert.ok(
        chain.rows.some((row) => row.cells.some((cell) => cell === null)),
        "unresolved downstream work remains visible",
      );
      const sharedKey = scenarios[domain].shared;
      const shared = await tracer.getFamily({
        rootId: fixture.entities[sharedKey].id,
        relationshipType: scenarios[domain].relationship,
        direction: "incoming",
      });
      assert.ok(shared.members.length >= 3, "same canonical object has multiple parents");
      assert.equal(
        shared.nodes.filter((node) => node.id === fixture.entities[sharedKey].id).length,
        1,
      );
      const changedReceipt = await verifyCapturedEvidence(tracer, fixture);
      if (domain === "medical") {
        const validation = await tracer.getFamily({
          rootId: fixture.entities["VAL-01"].id,
          relationshipType: "executed_as",
          direction: "outgoing",
        });
        assert.equal(validation.members.length, 0, "no fabricated validation execution");
        const clinical = await tracer.getFamily({
          rootId: fixture.entities["PRS-14"].id,
          relationshipType: "decomposes_into",
          direction: "outgoing",
        });
        assert.equal(clinical.members.length, 0);
      } else if (domain === "technology") {
        const privacy = await tracer.getFamily({
          rootId: fixture.entities["STORY-12"].id,
          relationshipType: "checked_by",
          direction: "outgoing",
        });
        assert.equal(privacy.members.length, 0, "missing privacy test is intentional");
        const decision = await tracer.getFamily({
          rootId: fixture.entities["ADR-04"].id,
          relationshipType: "supersedes",
          direction: "outgoing",
        });
        assert.equal(decision.members[0].key, "ADR-03");
      } else {
        const proposed = await tracer.getFamily({
          rootId: fixture.entities["BUILD-R02"].id,
          relationshipType: "evaluated_configuration",
          direction: "incoming",
        });
        assert.equal(
          proposed.members.length,
          0,
          "proposed configuration has no invented evaluation",
        );
        assert.ok(
          !fixture.receipts.some((receipt) => receipt.output === "EVAL-R05"),
          "unexecuted acoustic definition has no receipt",
        );
      }
      const sentinel = join(fixture.directory, "owner.txt");
      writeFileSync(sentinel, "preserve existing example edits");
      await assert.rejects(seedRealisticProject(fixture.directory, domain), { code: "EEXIST" });
      assert.equal(readFileSync(sentinel, "utf8"), "preserve existing example edits");
      repository.close();
      repository = new SQLiteRepository(fixture.database);
      assert.equal(
        (await new Tracer(repository).evidence.compareReceipt(changedReceipt.id)).state,
        "changed",
      );
    } finally {
      repository?.close();
      rmSync(parent, { recursive: true, force: true });
    }
  });
