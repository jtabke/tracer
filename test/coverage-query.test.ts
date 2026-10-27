import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { Entity, Relationship } from "../src/core/model.ts";
import type { CoverageExpectation, CoverageNativeQuery } from "../src/core/coverage.ts";
import { migrate } from "../src/persistence/migrations.ts";
import { coverageTransaction } from "../src/persistence/coverage.ts";

const expectation: CoverageExpectation = {
  name: "Approved requirements have implemented designs",
  subject: { type: "requirement", filter: { field: "approved", equals: true } },
  relationshipType: "realized_by",
  direction: "outgoing",
  related: { type: "design", filter: { field: "implemented", equals: true } },
  minimumDistinctTargets: 1,
};
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  migrate(db);
  const identity = db.prepare("INSERT OR IGNORE INTO identities VALUES (?,?,?,1)");
  const entity = (id: string, type: string, fields: Entity["fields"] = {}): Entity => {
    identity.run(id, "entity", 1);
    db.prepare(
      "INSERT INTO entities (id,type,human_key,version,attributes_json) VALUES (?,?,NULL,1,?)",
    ).run(id, type, JSON.stringify(fields));
    return { id, type, version: 1, fields };
  };
  const relationship = (
    id: string,
    source: string,
    target: string,
    type = "realized_by",
  ): Relationship => {
    identity.run(id, "relationship", 1);
    db.prepare(
      "INSERT INTO relationships (id,source_entity_id,target_entity_id,type,version,attributes_json) VALUES (?,?,?,?,1,?)",
    ).run(id, source, target, type, "{}");
    return { id, source, target, type, version: 1, fields: {} };
  };
  const revision = (
    value: Entity | Relationship,
    projectRevision: number,
    snapshot: Entity | Relationship | null = value,
  ) => {
    const kind = "source" in value ? "relationship" : "entity";
    identity.run(value.id, kind, value.version);
    db.prepare("INSERT OR IGNORE INTO changesets VALUES (?,?,1,?,?,NULL)").run(
      `commit-${projectRevision}`,
      projectRevision,
      "2026-10-13T00:00:00Z",
      "coverage-query-fixture",
    );
    const ordinal =
      Number(
        db
          .prepare("SELECT COUNT(*) AS n FROM object_revisions WHERE changeset_id=?")
          .get(`commit-${projectRevision}`)!.n,
      ) + 1;
    db.prepare("INSERT INTO object_revisions VALUES (?,?,?,?,?,?,?)").run(
      `${value.id}-${value.version}`,
      `commit-${projectRevision}`,
      ordinal,
      kind,
      value.id,
      value.version,
      snapshot === null ? null : JSON.stringify(snapshot),
    );
  };
  const tx = coverageTransaction(db, () => {});
  const evaluate = (changes: Partial<CoverageNativeQuery> = {}) =>
    tx.coveragePage({ expectation, limit: 25, ...changes });
  return { db, entity, relationship, revision, evaluate };
}
function observeQueries(db: DatabaseSync) {
  const statements: string[] = [],
    prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    statements.push(sql);
    return prepare(sql);
  };
  return {
    statements,
    plan: (index: number) =>
      prepare("EXPLAIN QUERY PLAN " + statements[index]).all(
        ...new Array((statements[index].match(/\?/g) ?? []).length).fill(null),
      ),
  };
}

test("coverage counts every relevant connection while returning bounded deterministic distinct-target samples in two batch queries", async () => {
  const { db, entity, relationship, evaluate } = fixture();
  try {
    db.exec("BEGIN");
    const subject = entity("subject-000", "requirement", { approved: true });
    for (let index = 1; index < 101; index++)
      entity(`subject-${String(index).padStart(3, "0")}`, "requirement", { approved: true });
    for (let index = 0; index < 1005; index++) {
      const id = `target-${String(index).padStart(4, "0")}`;
      entity(id, "design", { implemented: true });
      relationship(`link-${String(index).padStart(4, "0")}`, subject.id, id);
    }
    for (let index = 0; index < 7; index++)
      relationship(`duplicate-${index}`, subject.id, "target-0000");
    entity("planned", "design", { implemented: false });
    relationship("planned-link", subject.id, "planned");
    entity("wrong-type", "test", { implemented: true });
    relationship("wrong-target-link", subject.id, "wrong-type");
    relationship("wrong-meaning", subject.id, "target-0000", "related_to");
    db.exec("COMMIT");
    const observed = observeQueries(db);
    const first = await evaluate({ limit: 25 });
    assert.equal(observed.statements.length, 2);
    assert.equal(first.items.length, 25);
    assert.equal(first.nextAfter, "subject-024");
    const row = first.items[0];
    assert.equal(row.distinctTargets, 1005);
    assert.equal(row.matchingRelationships, 1012);
    assert.equal(row.unresolvedRelationships, 0);
    assert.equal(row.samplesComplete, false);
    assert.deepEqual(
      row.samples.map((sample) => sample.related.id),
      ["target-0000", "target-0001", "target-0002"],
    );
    assert.equal(row.samples[0].relationship.id, "duplicate-0");
    assert.equal(first.items[1].distinctTargets, 0);
    assert.equal(first.items[1].samplesComplete, true);
    const plan = observed.plan(1);
    assert.ok(
      plan.some((step) => String(step.detail).includes("COVERING INDEX coverage_source_target")),
      JSON.stringify(plan),
    );
    assert.ok(
      !plan.some((step) => /SCAN (?:relationships|link)(?: |$)/.test(String(step.detail))),
      JSON.stringify(plan),
    );
    observed.statements.length = 0;
    const second = await evaluate({ limit: 25, after: first.nextAfter });
    assert.equal(observed.statements.length, 2);
    assert.equal(second.items[0].subject.id, "subject-025");
    await assert.rejects(evaluate({ limit: 101 }), { code: "validation" });
  } finally {
    db.close();
  }
});

test("incoming coverage retains native arrow direction and exact scalar filters including literal awkward field names", async () => {
  const { db, entity, relationship, evaluate } = fixture();
  try {
    const key = 'status.with[brackets]"and quote';
    entity("subject", "requirement", { approved: true, [key]: "1" });
    entity("number-subject", "requirement", { approved: 1, [key]: 1 });
    entity("target-bool", "design", { implemented: true });
    entity("target-number", "design", { implemented: 1 });
    entity("target-text", "design", { implemented: "true" });
    entity("target-null", "design", { implemented: null });
    entity("target-missing", "design", {});
    for (const id of [
      "target-bool",
      "target-number",
      "target-text",
      "target-null",
      "target-missing",
    ])
      relationship(`incoming-${id}`, id, "subject");
    const query = {
      ...expectation,
      direction: "incoming" as const,
      subject: { type: "requirement", filter: { field: key, equals: "1" } },
    };
    const bool = await evaluate({ expectation: query });
    assert.equal(bool.items.length, 1);
    assert.equal(bool.items[0].matchingRelationships, 1);
    assert.equal(bool.items[0].samples[0].relationship.source, "target-bool");
    assert.equal(bool.items[0].samples[0].relationship.target, "subject");
    assert.equal(bool.items[0].samplesComplete, true);
    const numeric = await evaluate({
      expectation: {
        ...query,
        related: { type: "design", filter: { field: "implemented", equals: 1 } },
      },
    });
    assert.equal(numeric.items[0].distinctTargets, 1);
    assert.equal(numeric.items[0].samples[0].related.id, "target-number");
    const string = await evaluate({
      expectation: {
        ...query,
        related: { type: "design", filter: { field: "implemented", equals: "true" } },
      },
    });
    assert.equal(string.items[0].samples[0].related.id, "target-text");
    const observed = observeQueries(db);
    const all = await evaluate({ expectation: { ...query, related: { type: "design" } } });
    assert.equal(all.items[0].distinctTargets, 5);
    assert.equal(all.items[0].samples.length, 3);
    assert.ok(
      observed
        .plan(1)
        .some((step) => String(step.detail).includes("COVERING INDEX coverage_target_source")),
    );
  } finally {
    db.close();
  }
});

test("historical coverage resolves final native revisions before filters, tombstones, types and moved connections without current joins", async () => {
  const { db, entity, relationship, revision, evaluate } = fixture();
  try {
    const subject = entity("subject", "requirement", {
        approved: true,
        statement: "Original criterion",
      }),
      related = entity("target", "design", { implemented: true, statement: "Original design" }),
      other = entity("other", "requirement", { approved: true });
    const link = relationship("link", subject.id, related.id),
      stableLink = relationship("stable-link", other.id, related.id);
    for (const value of [subject, related, other, link, stableLink]) revision(value, 1);
    const changedSubject = {
        ...subject,
        version: 2,
        fields: { approved: false, statement: "Current criterion" },
      },
      changedRelated = {
        ...related,
        version: 2,
        fields: { implemented: false, statement: "Current planned design" },
      },
      changedLink = { ...link, version: 2, source: other.id, type: "related_to" };
    for (const value of [changedSubject, changedRelated, changedLink]) revision(value, 2);
    db.prepare("UPDATE entities SET version=2,attributes_json=? WHERE id=?").run(
      JSON.stringify(changedSubject.fields),
      subject.id,
    );
    db.prepare("UPDATE entities SET version=2,attributes_json=? WHERE id=?").run(
      JSON.stringify(changedRelated.fields),
      related.id,
    );
    db.prepare("UPDATE relationships SET version=2,source_entity_id=?,type=? WHERE id=?").run(
      other.id,
      changedLink.type,
      link.id,
    );
    const observed = observeQueries(db);
    const before = await evaluate({ atRevision: 1 });
    const plan = observed.plan(1);
    assert.ok(
      plan.some((step) => String(step.detail).includes("USING INDEX revision_source")),
      JSON.stringify(plan),
    );
    assert.ok(
      !plan.some((step) => /MATERIALIZE native_(?:entities|links)/.test(String(step.detail))),
      JSON.stringify(plan),
    );
    assert.ok(
      !plan.some((step) =>
        /(?:SCAN|SEARCH) (?:entities|relationships)(?: |$)/.test(String(step.detail)),
      ),
      JSON.stringify(plan),
    );
    const original = before.items.find((row) => row.subject.id === subject.id)!;
    assert.equal(original.distinctTargets, 1);
    assert.deepEqual(original.subject, subject);
    assert.deepEqual(original.samples, [{ related, relationship: link }]);
    const after = await evaluate({ atRevision: 2 });
    assert.deepEqual(
      after.items.map((row) => row.subject.id),
      [other.id],
    );
    assert.equal(after.items[0].distinctTargets, 0);
    const unfiltered = await evaluate({
      atRevision: 2,
      expectation: {
        ...expectation,
        subject: { type: "requirement" },
        related: { type: "design" },
      },
    });
    assert.equal(unfiltered.items.find((row) => row.subject.id === subject.id)!.distinctTargets, 0);
    assert.deepEqual(unfiltered.items.find((row) => row.subject.id === other.id)!.samples, [
      { related: changedRelated, relationship: stableLink },
    ]);
    revision({ ...other, version: 2 }, 3, null);
    assert.equal((await evaluate({ atRevision: 3 })).items.length, 0);
    assert.equal((await evaluate()).items.length, 1);
  } finally {
    db.close();
  }
});

test("historical missing related endpoints make counts unknown while preserving known samples and never adopting current endpoints", async () => {
  const { db, entity, relationship, revision, evaluate } = fixture();
  try {
    const subject = entity("subject", "requirement", { approved: true }),
      known = entity("known", "design", { implemented: true }),
      late = entity("late", "design", { implemented: true });
    const knownLink = relationship("known-link", subject.id, known.id),
      lateLink = relationship("late-link", subject.id, late.id);
    for (const value of [subject, known, knownLink, lateLink]) revision(value, 1);
    revision(late, 2);
    const missing = (await evaluate({ atRevision: 1 })).items[0];
    assert.equal(missing.distinctTargets, null);
    assert.equal(missing.matchingRelationships, null);
    assert.equal(missing.unresolvedRelationships, 1);
    assert.equal(missing.samplesComplete, false);
    assert.deepEqual(missing.samples, [{ related: known, relationship: knownLink }]);
    const resolved = (await evaluate({ atRevision: 2 })).items[0];
    assert.equal(resolved.distinctTargets, 2);
    assert.equal(resolved.matchingRelationships, 2);
    assert.equal(resolved.unresolvedRelationships, 0);
    assert.equal(resolved.samplesComplete, true);
  } finally {
    db.close();
  }
});
