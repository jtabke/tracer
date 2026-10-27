import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";

const actor = { actor: "configuration-test" };
const schema = {
  entityTypes: {
    item: { fields: { title: { type: "string" as const }, obsolete: { type: "string" as const } } },
  },
  relationshipTypes: {},
};
async function fixture(
  work: (tracer: Tracer, closeRepository: () => void, path: string) => Promise<void>,
) {
  const directory = mkdtempSync(join(tmpdir(), "tracer-config-"));
  const path = join(directory, "project.sqlite");
  const repo = new SQLiteRepository(path);
  let closed = false;
  const closeRepository = () => {
    repo.close();
    closed = true;
  };
  try {
    const tracer = new Tracer(repo);
    await tracer.setSchema(schema, 0, actor);
    await work(tracer, closeRepository, path);
  } finally {
    if (!closed) repo.close();
    rmSync(directory, { recursive: true, force: true });
  }
}
const create = (tracer: Tracer, title: string) =>
  tracer.createEntity({ type: "item", fields: { title } }, 1, actor);

test("mixed-version configurations resolve actual immutable history and receipts preserve current drift", () =>
  fixture(async (tracer, closeRepository, path) => {
    const hardware = await create(tracer, "Hardware A");
    const software = await create(tracer, "Software A");
    const build = await create(tracer, "Build A");
    const output = await create(tracer, "Integrated report");
    const software2 = await tracer.updateEntity(
      software.id,
      1,
      { fields: { title: "Software B" } },
      1,
      actor,
    );
    await tracer.updateEntity(hardware.id, 1, { fields: { title: "Hardware B" } }, 1, actor);
    const before = await tracer.history();
    const configuration = await tracer.configurations.capture(
      {
        name: "A hardware + B software",
        subjectId: build.id,
        expectedSubjectVersion: 1,
        members: [
          { entityId: hardware.id, version: 1 },
          { entityId: software.id, version: software2.version },
        ],
      },
      actor,
    );
    assert.deepEqual(
      configuration.members.map((pin) => [pin.entity.fields.title, pin.entity.version]),
      [
        ["Hardware A", 1],
        ["Software B", 2],
      ],
    );
    for (const pin of configuration.members) {
      const revision = before.items.find((value) => value.revisionId === pin.revisionId)!;
      assert.deepEqual(revision.snapshot, pin.entity);
      assert.equal(pin.projectRevision, revision.projectRevision);
      assert.equal(pin.schema.version, revision.schemaVersion);
    }
    assert.deepEqual(await tracer.history(), before);
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        configurationId: configuration.id,
        outcome: "SIMULATED pass for selected build",
        inputs: configuration.members.map((pin) => ({ entityId: pin.entity.id })),
      },
      actor,
    );
    assert.equal(receipt.configuration?.id, configuration.id);
    assert.deepEqual(
      receipt.inputs.map((input) => input.entity.version),
      [1, 2],
    );
    const comparison = await tracer.evidence.compareReceipt(receipt.id);
    assert.equal(comparison.state, "changed");
    assert.equal(comparison.inputs[1].state, "current");
    assert.equal(receipt.outcome, "SIMULATED pass for selected build");
    const review = await tracer.evidence.review(
      {
        receiptId: receipt.id,
        expectedComparison: comparison.token,
        decision: "acknowledged",
        rationale: "Applies to selected build; current hardware differs",
      },
      actor,
    );
    assert.equal(review.comparison.state, "changed");
    await tracer.removeEntity(hardware.id, 2, 1, actor);
    assert.equal((await tracer.evidence.compareReceipt(receipt.id)).state, "unknown");
    assert.deepEqual(await tracer.configurations.get(configuration.id), configuration);
    const historical = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        inputs: [{ entityId: hardware.id, revision: 1 }],
        outcome: "Old hardware only",
      },
      actor,
    );
    assert.equal(historical.inputs[0].entity.fields.title, "Hardware A");
    closeRepository();
    const reopened = new SQLiteRepository(path);
    try {
      const next = new Tracer(reopened);
      assert.deepEqual(await next.configurations.get(configuration.id), configuration);
      assert.equal((await next.evidence.compareReceipt(receipt.id)).state, "unknown");
      assert.deepEqual(
        (await next.evidence.list("receipt", { subject: output.id })).items[0],
        receipt,
      );
      const db = new DatabaseSync(path);
      try {
        assert.throws(
          () =>
            db
              .prepare("UPDATE configurations SET payload_json='{}' WHERE id=?")
              .run(configuration.id),
          /Immutable configuration/,
        );
        assert.throws(
          () => db.prepare("DELETE FROM configurations WHERE id=?").run(configuration.id),
          /Immutable configuration/,
        );
        assert.throws(
          () => db.prepare("UPDATE evidence SET payload_json='{}' WHERE kind='receipt'").run(),
          /Immutable evidence/,
        );
      } finally {
        db.close();
      }
    } finally {
      reopened.close();
    }
  }));

test("pins validate historical schemas, missing/tombstone versions, membership and exclusive selectors atomically", () =>
  fixture(async (tracer) => {
    const member = await tracer.createEntity(
      { type: "item", fields: { title: "Original", obsolete: "old schema field" } },
      1,
      actor,
    );
    const subject = await create(tracer, "Build");
    const output = await create(tracer, "Report");
    await tracer.updateEntity(member.id, 1, { fields: { title: "Updated" } }, 1, actor);
    await tracer.setSchema(
      { entityTypes: { item: { fields: { title: { type: "string" } } } }, relationshipTypes: {} },
      1,
      actor,
    );

    const historical = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        outcome: "Historical field",
        inputs: [{ entityId: member.id, revision: 1, fields: ["obsolete"] }],
      },
      actor,
    );
    assert.equal(historical.inputs[0].pin?.schema.version, 1);
    assert.equal(historical.schema.version, 2);
    const capture = {
      name: "Build",
      subjectId: subject.id,
      expectedSubjectVersion: 1,
      members: [{ entityId: member.id, version: 1 }],
    };
    const configuration = await tracer.configurations.capture(capture, actor);
    const invalid = [
      { ...capture, expectedSubjectVersion: 2 },
      { ...capture, members: [{ entityId: member.id, version: 99 }] },
      { ...capture, members: [...capture.members, ...capture.members] },
      { ...capture, members: [{ entityId: member.id, version: 0 }] },
      {
        ...capture,
        members: [
          { entityId: subject.id, version: 1 },
          { entityId: "missing", version: 1 },
        ],
      },
      { ...capture, name: " " },
      { ...capture, unknown: true },
      { ...capture, members: Array.from({ length: 101 }, () => capture.members[0]) },
    ];
    for (const input of invalid) await assert.rejects(tracer.configurations.capture(input, actor));
    assert.equal((await tracer.configurations.list()).items.length, 1);
    const base = {
      outputId: output.id,
      outcome: "Invalid",
      inputs: [{ entityId: member.id }],
      configurationId: configuration.id,
    };
    for (const input of [
      { ...base, inputs: [{ entityId: output.id }] },
      { ...base, inputs: [{ entityId: member.id, revision: 1 }] },
      { ...base, inputs: [{ entityId: member.id, expectedVersion: 2 }] },
      { ...base, inputs: [{ entityId: member.id, observationId: "missing" }] },
      { ...base, inputs: [{ entityId: member.id, path: ["live-link"] }] },
      { ...base, configurationId: "missing" },
      {
        ...base,
        configurationId: undefined,
        inputs: [{ entityId: member.id, revision: 1, expectedVersion: 2 }],
      },
      { ...base, configurationId: undefined, inputs: [{ entityId: member.id, revision: 99 }] },
    ]) {
      // Omit undefined properties at the JSON boundary, just as an HTTP client does.
      await assert.rejects(tracer.evidence.recordReceipt(JSON.parse(JSON.stringify(input)), actor));
    }
    assert.equal((await tracer.evidence.list("receipt")).items.length, 1);
    await tracer.removeEntity(member.id, 2, 2, actor);
    await assert.rejects(
      tracer.configurations.capture(
        { ...capture, members: [{ entityId: member.id, version: 3 }] },
        actor,
      ),
      { code: "not_found" },
    );
    await tracer.evidence.bindExternal(
      { entityId: subject.id, system: "file", externalId: "file-build", ownership: "external" },
      actor,
    );
    await assert.rejects(
      tracer.configurations.capture(
        { ...capture, members: [{ entityId: subject.id, version: 1 }] },
        actor,
      ),
      { code: "validation" },
    );
  }));

test("format 4 migration preserves saved views, native history and existing receipts; configuration paging is bounded", () =>
  fixture(async (tracer, closeRepository, path) => {
    const member = await create(tracer, "Native");
    const receipt = await tracer.evidence.recordReceipt(
      { outputId: member.id, inputs: [{ entityId: member.id }], outcome: "Before migration" },
      actor,
    );
    const view = await tracer.savedViews.save({
      name: "Items",
      expectedVersion: 0,
      expectedSchemaVersion: 1,
      definition: { kind: "chain", type: "item", steps: [] },
    });
    const history = await tracer.history();
    closeRepository();
    const old = new DatabaseSync(path);
    old.exec(
      "DROP TABLE changeset_commands; DROP TABLE receipt_dependencies; DROP INDEX receipt_supersedes; DROP INDEX coverage_source_target; DROP INDEX coverage_target_source; DROP TABLE baselines; DROP TABLE configurations; DROP TABLE resource_identities; DROP INDEX resource_source_identity; ALTER TABLE entities DROP COLUMN resource_json; ALTER TABLE relationships DROP COLUMN reference_json; UPDATE storage_version SET version=4",
    );
    old.close();
    const upgraded = new SQLiteRepository(path);
    try {
      const next = new Tracer(upgraded);
      assert.deepEqual(await next.history(), history);
      assert.deepEqual(await next.savedViews.list(), [view]);
      assert.deepEqual((await next.evidence.list("receipt")).items, [receipt]);
      for (let i = 0; i < 3; i++)
        await next.configurations.capture(
          {
            name: "Same display name",
            subjectId: member.id,
            expectedSubjectVersion: 1,
            members: [{ entityId: member.id, version: 1 }],
          },
          actor,
        );
      const page = await next.configurations.list({ subject: member.id, limit: 2 });
      assert.equal(page.items.length, 2);
      assert.ok(page.nextAfter);
      assert.equal(
        (await next.configurations.list({ after: page.nextAfter, limit: 2 })).items.length,
        1,
      );
      await assert.rejects(next.configurations.list({ limit: 101 }));
      await assert.rejects(next.configurations.list({ after: "-1" }));
      assert.deepEqual(await next.history(), history);
    } finally {
      upgraded.close();
    }
  }));
