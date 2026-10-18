import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Tracer, serializeProjectExport } from "../src/index.ts";
import type { ProjectExport, Schema, Entity, Repository, Transaction } from "../src/index.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { decodeRead } from "../src/interfaces/api-decoders.ts";

const origin = { actor: "export engineer", reason: "CO₂ monitor simulation" };
const schema: Schema = {
  entityTypes: { item: { fields: { title: { type: "string" }, data: { type: "json" } } } },
  relationshipTypes: { depends_on: { fields: { purpose: { type: "string" } } } },
};
async function seed(tracer: Tracer) {
  await tracer.setSchema(schema, 0, origin);
  const input = await tracer.createEntity(
    {
      type: "item",
      key: "REQ-1",
      fields: {
        title: "CO₂ ≤ 1000 ppm",
        data: JSON.parse('{"z":0,"__proto__":{"safe":true},"a":false}'),
      },
    },
    1,
    origin,
  );
  const output = await tracer.createEntity(
    { type: "item", key: "TEST-1", fields: { title: "Simulated result" } },
    1,
    origin,
  );
  const file = await tracer.createEntity(
    { type: "item", key: "FILE-1", fields: { title: "External input" } },
    1,
    origin,
  );
  const link = await tracer.createRelationship(
    {
      type: "depends_on",
      source: output.id,
      target: input.id,
      fields: { purpose: "Input to simulation" },
    },
    1,
    origin,
  );
  const configuration = await tracer.configurations.capture(
    {
      name: "Pinned simulation",
      subjectId: output.id,
      expectedSubjectVersion: 1,
      members: [
        { entityId: input.id, version: 1 },
        { entityId: output.id, version: 1 },
      ],
      relationships: [{ relationshipId: link.id, version: 1 }],
    },
    origin,
  );
  const external = await tracer.evidence.bindExternal(
    { entityId: file.id, system: "git", externalId: "monitor/test.csv", ownership: "external" },
    origin,
  );
  const observation = await tracer.evidence.observe(
    {
      entityId: file.id,
      locator: { system: "git", repository: "/original/monitor", path: "test.csv", ref: "main" },
    },
    origin,
  );
  const receipt = await tracer.evidence.recordReceipt(
    {
      outputId: output.id,
      outcome: "SIMULATED pass",
      inputs: [
        { entityId: input.id, path: [link.id] },
        { entityId: file.id, observationId: observation.id },
      ],
    },
    origin,
  );
  const pinnedReceipt = await tracer.evidence.recordReceipt(
    {
      outputId: output.id,
      outcome: "SIMULATED pinned pass",
      configurationId: configuration.id,
      inputs: [{ entityId: input.id }],
    },
    origin,
  );
  const comparison = await tracer.evidence.compareReceipt(receipt.id);
  const review = await tracer.evidence.review(
    {
      receiptId: receipt.id,
      decision: "acknowledged",
      rationale: "Simulation inspected",
      expectedComparison: comparison.token,
    },
    origin,
  );
  const baseline = await tracer.baselines.capture(
    { name: "Simulation baseline", expectedProjectRevision: (await tracer.timeline()).head },
    origin,
  );
  const view = await tracer.savedViews.save({
    name: "Dependencies",
    expectedVersion: 0,
    expectedSchemaVersion: 1,
    definition: {
      kind: "chain",
      type: "item",
      steps: [{ type: "item", relationshipType: "depends_on", direction: "outgoing" }],
    },
  });
  return {
    input,
    output,
    file,
    link,
    configuration,
    external,
    observation,
    receipt,
    pinnedReceipt,
    review,
    baseline,
    view,
  };
}

test("empty export is deterministic and canonical serialization sorts all object keys without reordering arrays", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    const value = await tracer.exportProject();
    assert.equal(value.projectRevision, 0);
    assert.equal(value.evidenceRevision, 0);
    assert.equal(value.current.schema, null);
    assert.deepEqual(value.current.entities, []);
    assert.deepEqual(value.provenance.revisions, []);
    assert.equal(
      serializeProjectExport(value),
      serializeProjectExport(await tracer.exportProject()),
    );
    const reversed = Object.fromEntries(Object.entries(value).reverse()) as ProjectExport;
    assert.equal(serializeProjectExport(value), serializeProjectExport(reversed));
    for (const invalid of [
      undefined,
      NaN,
      Infinity,
      new Date(),
      [,],
      { cycle: value, unsupported: undefined },
    ])
      assert.throws(
        () => serializeProjectExport(invalid as unknown as ProjectExport),
        /only JSON data/,
      );
    assert.ok(serializeProjectExport(value).endsWith("\n"));
    assert.ok(!serializeProjectExport(value).endsWith("\n\n"));
    assert.equal((await tracer.timeline()).head, 0);
  } finally {
    repository.close();
  }
});

test("export preserves historical versions, tombstones, original provenance and external references across restart and every interface", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-export-"));
  const path = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(path);
  let tracer = new Tracer(repository, undefined, async () => ({
    availability: "available",
    hash: "sha256:" + "a".repeat(64),
    commit: "b".repeat(40),
  }));
  let server: Awaited<ReturnType<typeof startLocalServer>> | undefined;
  try {
    const captured = await seed(tracer);
    await tracer.updateEntity(
      captured.input.id,
      1,
      { fields: { title: "Tightened to 800 ppm" } },
      1,
      origin,
    );
    await tracer.removeEntity(captured.output.id, 1, 1, origin, true);
    await tracer.setSchema(
      {
        ...schema,
        entityTypes: {
          item: { fields: { ...schema.entityTypes.item.fields, notes: { type: "string" } } },
        },
      },
      1,
      origin,
    );
    const before = await tracer.exportProject();
    const content = serializeProjectExport(before);
    assert.equal(before.current.schema?.version, 2);
    assert.ok(!before.current.entities.some((value) => value.id === captured.output.id));
    assert.deepEqual(before.current.relationships, []);
    assert.deepEqual(before.evidence.receipts, [captured.receipt, captured.pinnedReceipt]);
    assert.deepEqual(before.evidence.reviews, [captured.review]);
    assert.deepEqual(before.evidence.observations, [captured.observation]);
    assert.deepEqual(before.evidence.external, [captured.external]);
    assert.deepEqual(before.configurations, [captured.configuration]);
    assert.deepEqual(before.baselines, [captured.baseline]);
    assert.deepEqual(before.savedViews, [captured.view]);
    assert.equal(before.evidence.receipts[0].inputs[0].entity.version, 1);
    assert.equal(before.evidence.receipts[0].schema.version, 1);
    assert.equal(
      before.current.entities.find((value) => value.id === captured.input.id)?.version,
      2,
    );
    assert.equal(before.provenance.revisions.filter((value) => value.snapshot === null).length, 2);
    for (const revision of before.provenance.revisions) {
      const changeset = before.provenance.changesets.find(
        (value) => value.id === revision.changesetId,
      )!;
      assert.equal(changeset.actor, origin.actor);
      assert.equal(changeset.reason, origin.reason);
      assert.equal(changeset.projectRevision, revision.projectRevision);
      assert.ok(
        before.provenance.revisions.some(
          (value) => value.kind === "schema" && value.version === revision.schemaVersion,
        ),
      );
    }
    assert.deepEqual(decodeRead("/api/project-export", {}, JSON.parse(content)), before);
    assert.throws(
      () => decodeRead("/api/project-export", {}, { ...before, provenance: {} }),
      /Invalid API response/,
    );
    repository.close();
    repository = new SQLiteRepository(path);
    tracer = new Tracer(repository, undefined, async () => {
      throw new Error("Export must never observe external content");
    });
    assert.equal(serializeProjectExport(await tracer.exportProject()), content);
    server = await startLocalServer(tracer, directory, 0);
    const response = await fetch(server.origin + "/api/project-export");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), content);
    assert.equal((await fetch(server.origin + "/api/project-export?atRevision=1")).status, 400);
    const cli = spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        resolve("src/interfaces/cli.ts"),
        "--db",
        path,
        "project",
        "export",
      ],
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(cli.stdout, content);
    assert.equal(serializeProjectExport(await tracer.exportProject()), content);
    const changedReview = await tracer.evidence.review(
      {
        receiptId: captured.receipt.id,
        decision: "needs_reevaluation",
        rationale: "Requirement tightened",
        expectedComparison: (await tracer.evidence.compareReceipt(captured.receipt.id)).token,
      },
      origin,
    );
    const after = await tracer.exportProject();
    assert.equal(after.projectRevision, before.projectRevision);
    assert.equal(after.evidenceRevision, before.evidenceRevision + 1);
    assert.deepEqual(after.evidence.reviews, [captured.review, changedReview]);
    assert.notEqual(serializeProjectExport(after), content);
  } finally {
    await server?.close();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("export exhausts every paged collection and retains append order for evidence and captures", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    const fixture = await seed(tracer);
    const entities: Entity[] = [];
    for (let index = 0; index < 201; index++)
      entities.push(
        await tracer.createEntity(
          { type: "item", key: `EXTRA-${index}`, fields: { title: String(index) } },
          1,
          origin,
        ),
      );
    await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: entities.map((entity) => ({
          op: "relationship.create",
          input: { type: "depends_on", source: fixture.output.id, target: entity.id, fields: {} },
        })),
      },
      origin,
    );
    await repository.transaction(async (tx) => {
      for (let index = 0; index < 201; index++) {
        const id = `extra-${String(201 - index).padStart(3, "0")}`;
        await tx.appendEvidence("external", entities[index].id, {
          ...fixture.external,
          id: entities[index].id,
          externalId: id,
        });
        await tx.appendEvidence("observation", fixture.file.id, {
          ...fixture.observation,
          id: `o-${id}`,
        });
        await tx.appendEvidence("receipt", fixture.output.id, {
          ...fixture.receipt,
          id: `r-${id}`,
        });
        await tx.appendEvidence("review", fixture.receipt.id, { ...fixture.review, id: `j-${id}` });
        await tx.appendConfiguration({ ...fixture.configuration, id: `c-${id}` });
        await tx.appendBaseline({ ...fixture.baseline, id: `b-${id}` });
      }
    });
    const value = await tracer.exportProject();
    assert.equal(value.current.entities.length, 204);
    assert.equal(value.current.relationships.length, 202);
    assert.equal(value.provenance.changesets.length, 207);
    assert.equal(value.provenance.revisions.length, 407);
    assert.equal(value.evidence.external.length, 202);
    assert.equal(value.evidence.observations.length, 202);
    assert.equal(value.evidence.observations[0].availability, "unknown");
    assert.equal(value.evidence.receipts.length, 203);
    assert.equal(value.evidence.reviews.length, 202);
    assert.equal(value.configurations.length, 202);
    assert.equal(value.baselines.length, 202);
    assert.equal(value.evidence.reviews.at(-1)?.id, "j-extra-001");
    assert.equal(value.configurations.at(-1)?.id, "c-extra-001");
    assert.deepEqual(
      value.current.entities.map((value) => value.id),
      value.current.entities.map((value) => value.id).sort(),
    );
    assert.deepEqual(
      value.provenance.revisions.map((value) => [value.projectRevision, value.ordinal]),
      value.provenance.revisions
        .map((value) => [value.projectRevision, value.ordinal])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    );
  } finally {
    repository.close();
  }
});

function decorated(
  repository: SQLiteRepository,
  wrap: (tx: Transaction) => Transaction,
): Repository {
  return { close() {}, transaction: (work) => repository.transaction((tx) => work(wrap(tx))) };
}

test("a queued write cannot mix newer native or evidence state into a prepared export", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const writer = new Tracer(repository);
    const fixture = await seed(writer);
    const before = await writer.exportProject();
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reader = new Tracer(
      decorated(repository, (tx) => ({
        ...tx,
        query: async (kind, query) => {
          enter();
          await released;
          return tx.query(kind, query);
        },
      })),
    );
    const pending = reader.exportProject();
    await entered;
    const writing = writer.updateEntity(
      fixture.input.id,
      1,
      { fields: { title: "Later input" } },
      1,
      origin,
    );
    release();
    assert.deepEqual(await pending, before);
    await writing;
    assert.equal((await writer.exportProject()).projectRevision, before.projectRevision + 1);
  } finally {
    repository.close();
  }
});

test("export fails as a whole on capacity or repository errors and remains usable afterwards", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    await seed(tracer);
    const before = await tracer.exportProject();
    const oversized = new Tracer(
      decorated(repository, (tx) => ({
        ...tx,
        query: async () => ({ items: Array(250_001).fill(before.current.entities[0]) }),
      })),
    );
    await assert.rejects(oversized.exportProject(), /no partial export/);
    const repeated = { ...before.current.entities[0], fields: { title: "x".repeat(128 * 1024) } };
    const oversizedBytes = new Tracer(
      decorated(repository, (tx) => ({
        ...tx,
        query: async () => ({ items: Array(200).fill(repeated), nextAfter: "continue" }),
      })),
    );
    await assert.rejects(oversizedBytes.exportProject(), /64 MiB/);
    const tooManyViews = new Tracer(
      decorated(repository, (tx) => ({
        ...tx,
        listViews: async () => Array(51).fill(before.savedViews[0]),
      })),
    );
    await assert.rejects(tooManyViews.exportProject(), /50 saved views/);
    const broken = new Tracer(
      decorated(repository, (tx) => ({
        ...tx,
        history: async () => {
          throw new Error("Read failed");
        },
      })),
    );
    await assert.rejects(broken.exportProject(), { code: "storage" });
    assert.deepEqual(await tracer.exportProject(), before);
  } finally {
    repository.close();
  }
});
