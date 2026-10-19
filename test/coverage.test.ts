import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import type { Repository } from "../src/application/ports/repository.ts";
import type { Operation } from "../src/application/commands.ts";
import type { CoverageExpectation, CoverageExpectations } from "../src/core/coverage.ts";
import type { Schema } from "../src/core/model.ts";

const actor = { actor: "coverage-domain-qa" };
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const schema: Schema = {
  entityTypes: {
    requirement: {
      fields: {
        title: { type: "string" },
        phase: { type: "string" },
        priority: { type: "number" },
        enabled: { type: "boolean" },
        metadata: { type: "json" },
      },
    },
    test: { fields: { title: { type: "string" }, eligible: { type: "boolean" } } },
  },
  relationshipTypes: {
    tested_by: { fields: {}, source: ["requirement"], target: ["test"] },
    relates: { fields: {}, source: ["requirement"], target: ["requirement"] },
  },
};
const rule: CoverageExpectation = {
  name: "Released requirements need qualified test identities",
  subject: { type: "requirement", filter: { field: "phase", equals: "release" } },
  relationshipType: "tested_by",
  direction: "outgoing",
  related: { type: "test", filter: { field: "eligible", equals: true } },
  minimumDistinctTargets: 2,
};
const set = (tracer: Tracer, expectations: CoverageExpectations, expectedSchemaVersion: number) =>
  tracer.coverage.set({ expectations, expectedSchemaVersion }, actor);

async function denseFixture() {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository);
  await tracer.setSchema(schema, 0, actor);
  const subjects: Operation[] = Array.from({ length: 30 }, (_, index) => ({
    op: "entity.create",
    id: id(index + 1),
    input: {
      type: "requirement",
      fields: {
        title: `Requirement ${index + 1}`,
        ...(index === 29 ? {} : { phase: index === 28 ? "Release" : "release" }),
        priority: index === 0 ? 1 : 2,
        enabled: index === 0 ? false : true,
      },
    },
  }));
  const targets: Operation[] = Array.from({ length: 650 }, (_, index) => ({
    op: "entity.create",
    id: id(1001 + index),
    input: {
      type: "test",
      fields: { title: `Test ${index + 1}`, ...(index === 0 ? {} : { eligible: index >= 633 }) },
    },
  }));
  await tracer.applyChangeset(
    { expectedSchemaVersion: 1, operations: [...subjects, ...targets] },
    actor,
  );
  const links: Operation[] = Array.from({ length: 650 }, (_, index) => ({
    op: "relationship.create",
    id: id(2001 + index),
    input: { type: "tested_by", source: id(1), target: id(1001 + index), fields: {} },
  }));
  await tracer.applyChangeset(
    {
      expectedSchemaVersion: 1,
      operations: [
        ...links,
        {
          op: "relationship.create",
          id: id(3001),
          input: { type: "tested_by", source: id(1), target: id(1650), fields: {} },
        },
        {
          op: "relationship.create",
          id: id(3002),
          input: { type: "tested_by", source: id(2), target: id(1650), fields: {} },
        },
      ],
    },
    actor,
  );
  return { repository, tracer };
}

test("structural coverage counts all off-page qualified identities, not samples or parallel/shared links", async () => {
  const { repository, tracer } = await denseFixture();
  try {
    await set(tracer, { qualified: { ...rule, minimumDistinctTargets: 17 } }, 1);
    const before = await tracer.history(),
      head = (await tracer.timeline()).head;
    const result = await tracer.coverage.evaluate({ expectationId: "qualified", limit: 3 });
    assert.equal(result.context.projectRevision, head);
    assert.equal(result.context.schemaVersion, 2);
    assert.deepEqual(
      result.rows.items.map((row) => [
        row.subject.id,
        row.distinctTargets,
        row.matchingRelationships,
        row.state,
      ]),
      [
        [id(1), 17, 18, "covered"],
        [id(2), 1, 1, "missing"],
        [id(3), 0, 0, "missing"],
      ],
    );
    const first = result.rows.items[0];
    assert.equal(first.samples.length, 3);
    assert.equal(first.samplesComplete, false);
    assert.equal(new Set(first.samples.map((sample) => sample.related.id)).size, 3);
    for (const sample of first.samples) {
      assert.equal(sample.related.fields.eligible, true);
      assert.equal(sample.relationship.source, id(1));
      assert.equal(sample.relationship.target, sample.related.id);
    }
    assert.deepEqual(result.summary, {
      scope: "page",
      evaluated: 3,
      covered: 1,
      missing: 2,
      unknown: 0,
    });
    const next = await tracer.coverage.evaluate({
      expectationId: "qualified",
      after: result.rows.nextAfter,
      limit: 100,
    });
    assert.equal(next.rows.items.length, 25);
    assert.equal(next.rows.nextAfter, undefined);
    assert.ok(next.rows.items.every((row) => row.state === "missing" && row.distinctTargets === 0));
    assert.equal(next.rows.items.at(-1)?.subject.id, id(28));
    assert.deepEqual(await tracer.history(), before);
    assert.equal((await tracer.timeline()).head, head);
    assert.deepEqual((await tracer.evidence.list("receipt")).items, []);
  } finally {
    repository.close();
  }
});

test("incoming roles and scalar filters preserve native directions, exact types, absent values and self-loop identity", async () => {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository);
  try {
    await tracer.setSchema(schema, 0, actor);
    const source = await tracer.createEntity(
      {
        type: "requirement",
        fields: { title: "Source", phase: "release", priority: 1, enabled: false },
      },
      1,
      actor,
    );
    const absent = await tracer.createEntity(
      { type: "requirement", fields: { title: "Optional fields absent" } },
      1,
      actor,
    );
    const target = await tracer.createEntity(
      { type: "test", fields: { title: "Target", eligible: true } },
      1,
      actor,
    );
    const link = await tracer.createRelationship(
      { type: "tested_by", source: source.id, target: target.id, fields: {} },
      1,
      actor,
    );
    await tracer.createRelationship(
      { type: "tested_by", source: source.id, target: target.id, fields: {} },
      1,
      actor,
    );
    const loop = await tracer.createRelationship(
      { type: "relates", source: source.id, target: source.id, fields: {} },
      1,
      actor,
    );
    await set(
      tracer,
      {
        incoming: {
          ...rule,
          subject: { type: "test", filter: { field: "eligible", equals: true } },
          related: { type: "requirement", filter: { field: "priority", equals: 1 } },
          direction: "incoming",
          minimumDistinctTargets: 1,
        },
        falseFlag: {
          ...rule,
          subject: { type: "requirement", filter: { field: "enabled", equals: false } },
          minimumDistinctTargets: 1,
        },
        self: {
          ...rule,
          subject: { type: "requirement" },
          related: { type: "requirement" },
          relationshipType: "relates",
          minimumDistinctTargets: 1,
        },
        empty: {
          ...rule,
          subject: { type: "requirement", filter: { field: "phase", equals: "RELEASE" } },
        },
      },
      1,
    );
    const incoming = (await tracer.coverage.evaluate({ expectationId: "incoming" })).rows.items;
    assert.equal(incoming.length, 1);
    assert.equal(incoming[0].subject.id, target.id);
    assert.equal(incoming[0].distinctTargets, 1);
    assert.equal(incoming[0].matchingRelationships, 2);
    assert.equal(incoming[0].samples[0].related.id, source.id);
    assert.equal(incoming[0].samples[0].relationship.source, link.source);
    assert.equal(incoming[0].samples[0].relationship.target, link.target);
    assert.deepEqual(
      (await tracer.coverage.evaluate({ expectationId: "falseFlag" })).rows.items.map(
        (row) => row.subject.id,
      ),
      [source.id],
    );
    const self = (await tracer.coverage.evaluate({ expectationId: "self" })).rows.items;
    const row = self.find((row) => row.subject.id === source.id)!;
    assert.equal(row.distinctTargets, 1);
    assert.deepEqual(row.samples[0], { related: source, relationship: loop });
    assert.equal(self.find((row) => row.subject.id === absent.id)?.state, "missing");
    const empty = await tracer.coverage.evaluate({ expectationId: "empty" });
    assert.deepEqual(empty.rows.items, []);
    assert.deepEqual(empty.summary, {
      scope: "page",
      evaluated: 0,
      covered: 0,
      missing: 0,
      unknown: 0,
    });
  } finally {
    repository.close();
  }
});

test("baseline evaluation owns its historical schema policy while current cursors reject changed heads before rule lookup", async () => {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository);
  try {
    const original = await tracer.setSchema(schema, 0, actor);
    const source = await tracer.createEntity(
      { type: "requirement", fields: { title: "Source", phase: "release" } },
      1,
      actor,
    );
    const other = await tracer.createEntity(
      { type: "requirement", fields: { title: "Other", phase: "release" } },
      1,
      actor,
    );
    const target = await tracer.createEntity(
      { type: "test", fields: { title: "Target", eligible: true } },
      1,
      actor,
    );
    const alternative = await tracer.createEntity(
      { type: "test", fields: { title: "Excluded", eligible: false } },
      1,
      actor,
    );
    const link = await tracer.createRelationship(
      { type: "tested_by", source: source.id, target: target.id, fields: {} },
      1,
      actor,
    );
    const beforePolicy = await tracer.baselines.capture(
      { name: "Before explicit policy", expectedProjectRevision: (await tracer.timeline()).head },
      actor,
    );
    await set(tracer, { tests: rule }, 1);
    const baseline = await tracer.baselines.capture(
      { name: "Policy and topology", expectedProjectRevision: (await tracer.timeline()).head },
      actor,
    );
    const old = await tracer.coverage.evaluate({
      expectationId: "tests",
      baselineId: baseline.id,
      limit: 1,
    });
    const current = await tracer.coverage.evaluate({ expectationId: "tests", limit: 1 });
    assert.ok(old.rows.nextAfter);
    assert.ok(current.rows.nextAfter);
    await set(tracer, { tests: { ...rule, minimumDistinctTargets: 1 } }, 2);
    assert.equal(
      (await tracer.coverage.evaluate({ expectationId: "tests" })).rows.items.find(
        (row) => row.subject.id === source.id,
      )?.state,
      "covered",
    );
    assert.equal(
      (
        await tracer.coverage.evaluate({ expectationId: "tests", baselineId: baseline.id })
      ).rows.items.find((row) => row.subject.id === source.id)?.state,
      "missing",
    );
    await tracer.updateRelationship(
      link.id,
      1,
      { type: link.type, source: link.source, target: alternative.id, fields: {} },
      3,
      actor,
    );
    await tracer.removeEntity(target.id, 1, 3, actor);
    await set(tracer, {}, 3);
    await assert.rejects(
      tracer.coverage.evaluate({ expectationId: "tests", after: current.rows.nextAfter }),
      { code: "conflict" },
    );
    await assert.rejects(tracer.coverage.evaluate({ expectationId: "tests" }), {
      code: "not_found",
    });
    assert.deepEqual(
      (await tracer.coverage.list({ baselineId: beforePolicy.id })).expectations,
      {},
    );
    await assert.rejects(
      tracer.coverage.evaluate({ expectationId: "tests", baselineId: beforePolicy.id }),
      { code: "not_found" },
    );
    await tracer.applyChangeset(
      {
        expectedSchemaVersion: 4,
        operations: [
          {
            op: "entity.update",
            id: source.id,
            expectedVersion: 1,
            input: { fields: { title: "Source" } },
          },
          {
            op: "entity.update",
            id: other.id,
            expectedVersion: 1,
            input: { fields: { title: "Other" } },
          },
        ],
      },
      actor,
    );
    await tracer.setSchema(
      {
        ...original,
        entityTypes: {
          ...schema.entityTypes,
          requirement: { fields: { title: { type: "string" } } },
        },
      },
      4,
      actor,
    );
    const history = await tracer.history(),
      head = (await tracer.timeline()).head;
    const exact = await tracer.coverage.evaluate({
      expectationId: "tests",
      baselineId: baseline.id,
      limit: 1,
    });
    assert.deepEqual(exact, old);
    const remaining = await tracer.coverage.evaluate({
      expectationId: "tests",
      baselineId: baseline.id,
      after: old.rows.nextAfter,
    });
    assert.equal(remaining.rows.items.length, 1);
    assert.equal(
      remaining.rows.items[0].subject.id,
      old.rows.items[0].subject.id === source.id ? other.id : source.id,
    );
    assert.deepEqual((await tracer.coverage.list({ baselineId: baseline.id })).expectations, {
      tests: rule,
    });
    assert.equal(exact.expectation.minimumDistinctTargets, 2);
    assert.deepEqual(await tracer.history(), history);
    assert.equal((await tracer.timeline()).head, head);
  } finally {
    repository.close();
  }
});

test("targeted policy commits validate definitions without a census and reject invalid/stale policy atomically", async () => {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository);
  try {
    const original = await tracer.setSchema(schema, 0, actor);
    const noCensus: Repository = {
      transaction: (work) =>
        repository.transaction((tx) =>
          work(
            new Proxy(tx, {
              get: (target, key) =>
                key === "query"
                  ? async () => {
                      throw new Error("Coverage policy must not enumerate native objects");
                    }
                  : Reflect.get(target, key),
            }),
          ),
        ),
      close() {},
    };
    const targeted = new Tracer(noCensus);
    const saved = await set(targeted, { tests: rule }, 1);
    assert.equal(saved.version, 2);
    assert.deepEqual(saved.entityTypes, original.entityTypes);
    assert.deepEqual(saved.relationshipTypes, original.relationshipTypes);
    assert.deepEqual(saved.coverageExpectations, { tests: rule });
    const history = await tracer.history(),
      head = (await tracer.timeline()).head;
    await assert.rejects(set(targeted, {}, 1), { code: "schema_conflict" });
    const invalid: unknown[] = [
      { tests: { ...rule, minimumDistinctTargets: 0 } },
      { tests: { ...rule, minimumDistinctTargets: 1.5 } },
      { tests: { ...rule, direction: "incoming" } },
      {
        tests: {
          ...rule,
          subject: { type: "requirement", filter: { field: "priority", equals: "1" } },
        },
      },
      {
        tests: {
          ...rule,
          subject: { type: "requirement", filter: { field: "metadata", equals: "value" } },
        },
      },
      {
        tests: { ...rule, related: { type: "test", filter: { field: "eligible", equals: null } } },
      },
      { tests: { ...rule, subject: { type: "missing" } } },
      { " untrimmed": rule },
      Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`rule-${index}`, rule])),
    ];
    for (const expectations of invalid)
      await assert.rejects(set(targeted, expectations as CoverageExpectations, 2), {
        code: "validation",
      });
    assert.deepEqual(await tracer.getSchema(), saved);
    assert.deepEqual(await tracer.history(), history);
    assert.equal((await tracer.timeline()).head, head);
    const replaced = await tracer.setSchema(
      { entityTypes: saved.entityTypes, relationshipTypes: saved.relationshipTypes },
      2,
      actor,
    );
    assert.equal(Object.hasOwn(replaced, "coverageExpectations"), false);
    assert.deepEqual((await tracer.coverage.list()).expectations, {});
  } finally {
    repository.close();
  }
});

test("a genuinely unreadable historical endpoint yields unknown counts rather than a fabricated missing link", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-coverage-unresolved-")),
    database = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(database);
  try {
    let tracer = new Tracer(repository);
    await tracer.setSchema(schema, 0, actor);
    const source = await tracer.createEntity(
      { type: "requirement", fields: { phase: "release" } },
      1,
      actor,
    );
    const target = await tracer.createEntity(
      { type: "test", fields: { eligible: true } },
      1,
      actor,
    );
    await tracer.createRelationship(
      { type: "tested_by", source: source.id, target: target.id, fields: {} },
      1,
      actor,
    );
    await set(tracer, { tests: rule }, 1);
    const baseline = await tracer.baselines.capture(
      { name: "Damaged history fixture", expectedProjectRevision: (await tracer.timeline()).head },
      actor,
    );
    repository.close();
    const damaged = new DatabaseSync(database);
    damaged
      .prepare("UPDATE object_revisions SET snapshot_json=NULL WHERE kind='entity' AND object_id=?")
      .run(target.id);
    damaged.close();
    repository = new SQLiteRepository(database);
    tracer = new Tracer(repository);
    const before = await tracer.history();
    const result = await tracer.coverage.evaluate({
      expectationId: "tests",
      baselineId: baseline.id,
    });
    const row = result.rows.items[0];
    assert.equal(row.state, "unknown");
    assert.equal(row.distinctTargets, null);
    assert.equal(row.matchingRelationships, null);
    assert.equal(row.unresolvedRelationships, 1);
    assert.ok(row.reason.length);
    assert.deepEqual(result.summary, {
      scope: "page",
      evaluated: 1,
      covered: 0,
      missing: 0,
      unknown: 1,
    });
    assert.deepEqual(await tracer.history(), before);
  } finally {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
