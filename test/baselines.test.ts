import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import type { Operation } from "../src/application/commands.ts";
import type { Entity, Relationship, Schema } from "../src/core/model.ts";

const actor = { actor: "baseline-qa", reason: "Exact native state, not release approval" };
const schema: Schema = {
  entityTypes: { item: { fields: { title: { type: "string" } } } },
  relationshipTypes: { references: { fields: {} } },
};
const entity = (tracer: Tracer, key: string) =>
  tracer.createEntity({ type: "item", key, fields: { title: key } }, 1, actor);
const sorted = <T extends { id: string }>(items: T[]) =>
  items.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

test("baselines retain complete committed schema and topology through later relinks, cascades and repeated same-commit edits", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  try {
    const originalSchema = await tracer.setSchema(schema, 0, actor);
    const root = await entity(tracer, "ROOT"),
      a = await entity(tracer, "A"),
      b = await entity(tracer, "B");
    const link = await tracer.createRelationship(
      { type: "references", source: root.id, target: a.id, fields: {} },
      1,
      actor,
    );
    const parallel = await tracer.createRelationship(
      { type: "references", source: root.id, target: a.id, fields: {} },
      1,
      actor,
    );
    const oldRevision = (await tracer.timeline()).head;
    const before = await tracer.baselines.capture(
      { id: "before-topology", name: "Original topology", expectedProjectRevision: oldRevision },
      actor,
    );
    const commit = await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: [
          {
            op: "entity.update",
            id: root.id,
            expectedVersion: 1,
            input: { fields: { title: "Intermediate" } },
          },
          {
            op: "entity.update",
            id: root.id,
            expectedVersion: 2,
            input: { fields: { title: "Final" } },
          },
          {
            op: "relationship.update",
            id: link.id,
            expectedVersion: 1,
            input: { type: link.type, source: link.source, target: b.id, fields: link.fields },
          },
          { op: "entity.remove", id: a.id, expectedVersion: 1, cascade: true },
        ],
      },
      actor,
    );
    const after = await tracer.baselines.capture(
      { name: "Relinked topology", expectedProjectRevision: commit.changeset.projectRevision },
      actor,
    );
    await tracer.removeEntity(b.id, 1, 1, actor, true);
    const latestSchema = await tracer.setSchema(
      {
        ...schema,
        entityTypes: { item: { fields: { title: { type: "string" }, note: { type: "string" } } } },
      },
      1,
      actor,
    );
    const unchangedHistory = await tracer.history(),
      head = (await tracer.timeline()).head;
    const oldEntities = await tracer.baselines.contents({ baselineId: before.id, kind: "entity" });
    const oldLinks = await tracer.baselines.contents({
      baselineId: before.id,
      kind: "relationship",
    });
    assert.deepEqual(oldEntities.schema, originalSchema);
    assert.deepEqual(oldEntities.baseline, before);
    assert.deepEqual(oldEntities.objects.items, sorted([root, a, b]));
    assert.deepEqual(oldLinks.objects.items, sorted([link, parallel]));
    const finalEntities = await tracer.baselines.contents({ baselineId: after.id, kind: "entity" });
    const finalLinks = await tracer.baselines.contents({
      baselineId: after.id,
      kind: "relationship",
    });
    assert.deepEqual(finalEntities.schema, originalSchema);
    assert.deepEqual(finalEntities.objects.items, sorted([commit.results[1] as Entity, b]));
    assert.deepEqual(finalLinks.objects.items, [commit.results[2] as Relationship]);
    assert.equal((finalLinks.objects.items[0] as Relationship).target, b.id);
    assert.equal(finalEntities.objects.items.find((item) => item.id === root.id)?.version, 3);
    const replay = await tracer.baselines.capture(
      { id: before.id, name: " Original topology ", expectedProjectRevision: oldRevision },
      actor,
    );
    assert.deepEqual(replay, before);
    assert.equal((await tracer.baselines.list()).items.length, 2);
    const historical = await tracer.baselines.capture(
      {
        name: "Earlier commit captured now",
        expectedProjectRevision: head,
        projectRevision: oldRevision,
      },
      actor,
    );
    assert.equal(historical.projectRevision, oldRevision);
    assert.equal(historical.capturedAtProjectRevision, head);
    assert.equal(historical.changesetId, before.changesetId);
    assert.equal(historical.schemaVersion, originalSchema.version);
    assert.deepEqual(
      (await tracer.baselines.contents({ baselineId: historical.id, kind: "entity" })).objects
        .items,
      oldEntities.objects.items,
    );
    const latest = await tracer.baselines.capture(
      { name: "Schema only", expectedProjectRevision: head },
      actor,
    );
    assert.deepEqual(
      (await tracer.baselines.contents({ baselineId: latest.id, kind: "entity" })).schema,
      latestSchema,
    );
    assert.deepEqual(await tracer.history(), unchangedHistory);
    assert.equal((await tracer.timeline()).head, head);
    assert.deepEqual((await tracer.evidence.list("receipt")).items, []);
  } finally {
    repository.close();
  }
});

test("baseline pages exclude tombstones before limits and stay exact across later writes; cursors cannot cross capture or kind", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  try {
    await tracer.setSchema(schema, 0, actor);
    const creates: Operation[] = Array.from({ length: 9 }, (_, index) => ({
      op: "entity.create",
      id: uuid(index + 1),
      input: { type: "item", fields: { title: `Item ${index + 1}` } },
    }));
    await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: [
          ...creates,
          { op: "entity.remove", id: uuid(9), expectedVersion: 1 },
          ...Array.from({ length: 4 }, (_, index): Operation => ({
            op: "relationship.create",
            id: uuid(101 + index),
            input: {
              type: "references",
              source: uuid(2),
              target: uuid(index < 2 ? 3 : index === 2 ? 2 : 4),
              fields: {},
            },
          })),
        ],
      },
      actor,
    );
    await tracer.removeEntity(uuid(1), 1, 1, actor);
    const head = (await tracer.timeline()).head;
    const baseline = await tracer.baselines.capture(
      { name: "Paged", expectedProjectRevision: head },
      actor,
    );
    const alternate = await tracer.baselines.capture(
      { name: "Paged", expectedProjectRevision: head },
      actor,
    );
    const first = await tracer.baselines.contents({
      baselineId: baseline.id,
      kind: "entity",
      limit: 3,
    });
    assert.deepEqual(
      first.objects.items.map((item) => item.id),
      [uuid(2), uuid(3), uuid(4)],
    );
    assert.ok(first.objects.nextAfter);
    assert.deepEqual(JSON.parse(first.objects.nextAfter), ["v1", baseline.id, "entity", uuid(4)]);
    await tracer.updateEntity(uuid(5), 1, { fields: { title: "Later edit" } }, 1, actor);
    await tracer.removeEntity(uuid(6), 1, 1, actor);
    const second = await tracer.baselines.contents({
      baselineId: baseline.id,
      kind: "entity",
      after: first.objects.nextAfter,
      limit: 3,
    });
    const last = await tracer.baselines.contents({
      baselineId: baseline.id,
      kind: "entity",
      after: second.objects.nextAfter,
      limit: 3,
    });
    assert.deepEqual(
      second.objects.items.map((item) => [item.id, item.version]),
      [
        [uuid(5), 1],
        [uuid(6), 1],
        [uuid(7), 1],
      ],
    );
    assert.deepEqual(
      last.objects.items.map((item) => item.id),
      [uuid(8)],
    );
    assert.equal(last.objects.nextAfter, undefined);
    const links = await tracer.baselines.contents({
      baselineId: baseline.id,
      kind: "relationship",
      limit: 3,
    });
    const remaining = await tracer.baselines.contents({
      baselineId: baseline.id,
      kind: "relationship",
      after: links.objects.nextAfter,
      limit: 3,
    });
    assert.deepEqual(
      [...links.objects.items, ...remaining.objects.items].map((item) => item.id),
      [101, 102, 103, 104].map(uuid),
    );
    for (const query of [
      { baselineId: alternate.id, kind: "entity" as const, after: first.objects.nextAfter },
      { baselineId: baseline.id, kind: "relationship" as const, after: first.objects.nextAfter },
      { baselineId: baseline.id, kind: "entity" as const, after: "not-json" },
      {
        baselineId: baseline.id,
        kind: "entity" as const,
        after: JSON.stringify(["v2", baseline.id, "entity", uuid(4)]),
      },
      { baselineId: baseline.id, kind: "entity" as const, limit: 1001 },
    ])
      await assert.rejects(tracer.baselines.contents(query), { code: "validation" });
    assert.deepEqual((await tracer.baselines.list({ limit: 1 })).items, [baseline]);
    const catalogue = await tracer.baselines.list({ limit: 1 });
    assert.ok(catalogue.nextAfter);
    assert.deepEqual(
      (await tracer.baselines.list({ after: catalogue.nextAfter, limit: 1 })).items,
      [alternate],
    );
  } finally {
    repository.close();
  }
});

test("baseline guards reject stale heads, unknown revisions and changed replay intent without append or native history writes", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  try {
    await assert.rejects(
      tracer.baselines.capture({ name: "Empty", expectedProjectRevision: 0 }, actor),
      { code: "validation" },
    );
    await tracer.setSchema(schema, 0, actor);
    await entity(tracer, "ITEM");
    const head = (await tracer.timeline()).head;
    const saved = await tracer.baselines.capture(
      { id: "repeatable-operation", name: "Native state", expectedProjectRevision: head },
      actor,
    );
    const history = await tracer.history(),
      catalogue = await tracer.baselines.list();
    await assert.rejects(
      tracer.baselines.capture({ name: "Stale", expectedProjectRevision: head - 1 }, actor),
      { code: "conflict" },
    );
    for (const projectRevision of [0, -1, 1.5, head + 1])
      await assert.rejects(
        tracer.baselines.capture(
          { name: "Invalid target", expectedProjectRevision: head, projectRevision },
          actor,
        ),
        { code: "validation" },
      );
    for (const proposal of [
      { id: saved.id, name: "Different name", expectedProjectRevision: head },
      { id: saved.id, name: saved.name, expectedProjectRevision: head, projectRevision: 1 },
      { id: saved.id, name: saved.name, expectedProjectRevision: head - 1 },
      {
        id: saved.id,
        name: saved.name,
        expectedProjectRevision: head + 1,
        projectRevision: head,
      },
    ])
      await assert.rejects(tracer.baselines.capture(proposal, actor), { code: "conflict" });
    await assert.rejects(
      tracer.baselines.capture(
        { id: saved.id, name: saved.name, expectedProjectRevision: head },
        { actor: "different actor" },
      ),
      { code: "conflict" },
    );
    await assert.rejects(
      tracer.baselines.capture(
        { id: saved.id, name: saved.name, expectedProjectRevision: head },
        { ...actor, reason: "Different capture intention" },
      ),
      { code: "conflict" },
    );
    for (const after of ["-1", "01", "1.0", "9007199254740992"])
      await assert.rejects(tracer.baselines.list({ after }), { code: "validation" });
    await assert.rejects(tracer.baselines.get("missing"), { code: "not_found" });
    await assert.rejects(tracer.baselines.contents({ baselineId: "missing", kind: "entity" }), {
      code: "not_found",
    });
    assert.deepEqual(await tracer.baselines.list(), catalogue);
    assert.deepEqual(await tracer.history(), history);
    assert.equal((await tracer.timeline()).head, head);
  } finally {
    repository.close();
  }
});

test("format-five migration preserves existing native/evidence/view captures; baselines persist and reject direct mutation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-baseline-migration-"));
  const database = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(database);
  try {
    let tracer = new Tracer(repository);
    await tracer.setSchema(schema, 0, actor);
    const root = await entity(tracer, "ROOT");
    const configuration = await tracer.configurations.capture(
      {
        name: "Existing configuration",
        subjectId: root.id,
        expectedSubjectVersion: 1,
        members: [{ entityId: root.id, version: 1 }],
      },
      actor,
    );
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: root.id,
        outcome: "Existing outcome",
        configurationId: configuration.id,
        inputs: [{ entityId: root.id }],
      },
      actor,
    );
    const view = await tracer.savedViews.save({
      name: "Existing view",
      expectedVersion: 0,
      expectedSchemaVersion: 1,
      definition: {
        kind: "family",
        rootId: root.id,
        relationshipType: "references",
        direction: "outgoing",
        layout: "reading",
        columns: [],
      },
    });
    const history = await tracer.history(),
      head = (await tracer.timeline()).head;
    repository.close();
    const downgrade = new DatabaseSync(database);
    downgrade.exec(
      "DROP TABLE changeset_commands; DROP TABLE receipt_dependencies; DROP INDEX receipt_supersedes; DROP INDEX coverage_source_target; DROP INDEX coverage_target_source; DROP TABLE baselines; DROP TABLE resource_identities; DROP INDEX resource_source_identity; ALTER TABLE entities DROP COLUMN resource_json; ALTER TABLE relationships DROP COLUMN reference_json; UPDATE storage_version SET version=5",
    );
    downgrade.close();
    repository = new SQLiteRepository(database);
    tracer = new Tracer(repository);
    assert.deepEqual(await tracer.history(), history);
    assert.deepEqual(await tracer.configurations.get(configuration.id), configuration);
    assert.deepEqual(await tracer.evidence.getReceipt(receipt.id), receipt);
    assert.deepEqual(await tracer.savedViews.list(), [view]);
    const baseline = await tracer.baselines.capture(
      { id: "persisted-baseline", name: "Persisted", expectedProjectRevision: head },
      actor,
    );
    repository.close();
    const inspect = new DatabaseSync(database);
    assert.equal(inspect.prepare("SELECT version FROM storage_version").get()!.version, 10);
    assert.throws(
      () => inspect.prepare("UPDATE baselines SET payload_json='{}' WHERE id=?").run(baseline.id),
      /Immutable baseline/i,
    );
    assert.throws(
      () => inspect.prepare("DELETE FROM baselines WHERE id=?").run(baseline.id),
      /Immutable baseline/i,
    );
    inspect.close();
    repository = new SQLiteRepository(database);
    tracer = new Tracer(repository);
    assert.deepEqual(await tracer.baselines.get(baseline.id), baseline);
    assert.deepEqual(
      (await tracer.baselines.contents({ baselineId: baseline.id, kind: "entity" })).objects.items,
      [root],
    );
    assert.deepEqual(await tracer.history(), history);
    assert.equal((await tracer.timeline()).head, head);
  } finally {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("legacy project-revision gaps are not capture boundaries and do not produce metadata", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-baseline-gap-"));
  const database = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(database);
  try {
    let tracer = new Tracer(repository);
    await tracer.setSchema(schema, 0, actor);
    const original = await entity(tracer, "LEGACY");
    repository.close();
    const imported = new DatabaseSync(database);
    imported.exec(
      "UPDATE changesets SET project_revision=3 WHERE project_revision=2; UPDATE project_counter SET value=3 WHERE id=1",
    );
    imported.close();
    repository = new SQLiteRepository(database);
    tracer = new Tracer(repository);
    const history = await tracer.history();
    await assert.rejects(
      tracer.baselines.capture(
        { name: "Uncommitted gap", expectedProjectRevision: 3, projectRevision: 2 },
        actor,
      ),
      { code: "not_found" },
    );
    assert.deepEqual((await tracer.baselines.list()).items, []);
    const baseline = await tracer.baselines.capture(
      { name: "Actual imported commit", expectedProjectRevision: 3, projectRevision: 3 },
      actor,
    );
    assert.equal(baseline.projectRevision, 3);
    assert.deepEqual(
      (await tracer.baselines.contents({ baselineId: baseline.id, kind: "entity" })).objects.items,
      [original],
    );
    assert.deepEqual(await tracer.history(), history);
    assert.equal((await tracer.timeline()).head, 3);
  } finally {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
