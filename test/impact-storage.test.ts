import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Receipt } from "../src/core/evidence.ts";
import type { Entity, Relationship } from "../src/core/model.ts";
import { migrate } from "../src/persistence/migrations.ts";
import { impactTransaction, indexReceiptDependencies } from "../src/persistence/impact.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";

const entity = (id: string): Entity => ({ id, type: "item", version: 1, fields: {} });
const link = (id: string, source = "output", target = "input", type = "uses"): Relationship => ({
  id,
  source,
  target,
  type,
  version: 1,
  fields: {},
});
function receipt(id: string, inputIds = ["input"], links: Relationship[] = []): Receipt {
  return {
    id,
    at: "2026-10-13T00:00:00Z",
    actor: "storage test",
    output: entity("output"),
    schema: {
      id: "project",
      version: 1,
      entityTypes: { item: { fields: {} } },
      relationshipTypes: { uses: { fields: {} } },
    },
    outcome: "Passed",
    inputs: inputIds.map((id) => ({ entityId: id, entity: entity(id), links })),
  };
}
function append(db: DatabaseSync, value: Receipt) {
  const result = db
    .prepare("INSERT INTO evidence(id,kind,subject_id,payload_json) VALUES (?,'receipt',?,?)")
    .run(value.id, value.output.id, JSON.stringify(value));
  indexReceiptDependencies(db, Number(result.lastInsertRowid));
}
function observe(db: DatabaseSync) {
  const statements: string[] = [],
    prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    statements.push(sql);
    return prepare(sql);
  };
  return {
    statements,
    plan: (index: number) =>
      prepare("EXPLAIN QUERY PLAN " + statements[index])
        .all(...new Array((statements[index].match(/\?/g) ?? []).length).fill(null))
        .map((row) => String(row.detail))
        .join("\n"),
  };
}

test("receipt dependency pages are indexed, deduplicated and limited to actual terminal inputs and captured link identities", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    migrate(db);
    db.exec("BEGIN");
    for (let index = 0; index < 1000; index++)
      append(db, receipt(`unrelated-${index}`, [`other-${index}`]));
    const first = receipt(
      "receipt-a",
      ["input", "input", "second"],
      [link("path-a", "output", "intermediate"), link("path-b", "intermediate", "input")],
    );
    const second = receipt("receipt-b", ["input"], [link("path-b")]);
    const third = receipt("receipt-c", ["second"]);
    append(db, first);
    append(db, second);
    append(db, third);
    db.exec("COMMIT");
    const queries = observe(db),
      tx = impactTransaction(db, () => {});
    const query = {
      entityIds: ["input", "second", "input"],
      relationshipIds: ["path-a", "path-b"],
      limit: 1,
    };
    const page = await tx.impactReceipts(query);
    assert.deepEqual(page.items, [first]);
    assert.ok(page.nextAfter);
    assert.match(queries.plan(0), /SEARCH receipt_dependencies USING PRIMARY KEY/);
    assert.match(queries.plan(0), /SEARCH e USING INTEGER PRIMARY KEY/);
    assert.doesNotMatch(queries.plan(0), /SCAN e\b/);
    const next = await tx.impactReceipts({ ...query, after: page.nextAfter, limit: 2 });
    assert.deepEqual(next.items, [second, third]);
    assert.equal(next.nextAfter, undefined);
    assert.deepEqual(
      (
        await tx.impactReceipts({
          entityIds: ["intermediate", "output"],
          relationshipIds: [],
          limit: 25,
        })
      ).items,
      [],
    );
    assert.deepEqual(
      (await tx.impactReceipts({ entityIds: [], relationshipIds: ["path-a"], limit: 25 })).items,
      [first],
    );
    assert.equal(await tx.impactEvidenceRevision(), 1003);
  } finally {
    db.close();
  }
});

test("directed incident filtering happens before limits, uses endpoint indexes, and resolves final historical links before filters", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    migrate(db);
    for (const id of ["root", "input", "other"]) {
      db.prepare("INSERT INTO identities VALUES (?,'entity',1,1)").run(id);
      db.prepare(
        "INSERT INTO entities (id,type,human_key,version,attributes_json) VALUES (?,'item',NULL,1,'{}')",
      ).run(id);
    }
    const store = (value: Relationship) => {
      db.prepare("INSERT INTO identities VALUES (?,'relationship',1,1)").run(value.id);
      db.prepare(
        "INSERT INTO relationships (id,source_entity_id,target_entity_id,type,version,attributes_json) VALUES (?,?,?,?,1,'{}')",
      ).run(value.id, value.source, value.target, value.type);
    };
    for (let index = 0; index < 300; index++)
      store(link(`irrelevant-${index}`, "root", "input", "other"));
    const outgoing = link("selected-out", "root"),
      incoming = link("selected-in", "input", "root"),
      loop = link("selected-loop", "root", "root");
    for (const value of [outgoing, incoming, loop]) store(value);
    const revision = (
      value: Relationship,
      commit: number,
      snapshot: Relationship | null = value,
    ) => {
      db.prepare("INSERT OR IGNORE INTO identities VALUES (?,'relationship',1,1)").run(value.id);
      db.prepare("INSERT OR IGNORE INTO changesets VALUES (?,?,1,'now','test',NULL)").run(
        `c${commit}`,
        commit,
      );
      const ordinal =
        Number(
          db
            .prepare("SELECT COUNT(*) AS n FROM object_revisions WHERE changeset_id=?")
            .get(`c${commit}`)!.n,
        ) + 1;
      db.prepare("INSERT INTO object_revisions VALUES (?,?,?,?,?,?,?)").run(
        `${value.id}-${value.version}`,
        `c${commit}`,
        ordinal,
        "relationship",
        value.id,
        value.version,
        snapshot === null ? null : JSON.stringify(snapshot),
      );
    };
    for (const value of [outgoing, incoming, loop]) revision(value, 1);
    const moved = link("historical-moved", "root");
    revision(moved, 1);
    revision({ ...moved, version: 2, source: "other" }, 2);
    const changedType = link("historical-type", "root");
    revision(changedType, 1);
    revision({ ...changedType, version: 2, type: "other" }, 2);
    const deleted = link("historical-deleted", "root");
    revision(deleted, 1);
    revision({ ...deleted, version: 2 }, 2, null);
    const queries = observe(db),
      tx = impactTransaction(db, () => {});
    const base = {
      id: "root",
      direction: "outgoing" as const,
      relationshipTypes: ["uses"],
      limit: 10,
    };
    assert.deepEqual((await tx.impactIncident(base)).items, [loop, outgoing]);
    assert.match(queries.plan(0), /SEARCH relationships USING INDEX relationship_source/);
    assert.deepEqual((await tx.impactIncident({ ...base, direction: "incoming" })).items, [
      incoming,
      loop,
    ]);
    assert.match(queries.plan(1), /SEARCH relationships USING INDEX relationship_target/);
    assert.deepEqual((await tx.impactIncident({ ...base, direction: "both" })).items, [
      incoming,
      loop,
      outgoing,
    ]);
    const old = await tx.impactIncident({ ...base, atRevision: 1, limit: 2 });
    assert.deepEqual(old.items, [deleted, moved]);
    assert.ok(old.nextAfter);
    assert.match(queries.plan(3), /SEARCH r USING INDEX revision_source/);
    assert.deepEqual((await tx.impactIncident({ ...base, atRevision: 2 })).items, [loop, outgoing]);
    assert.deepEqual(
      (await tx.impactIncident({ ...base, atRevision: 1, direction: "incoming" })).items,
      [incoming, loop],
    );
    assert.match(queries.plan(5), /SEARCH r USING INDEX revision_target/);
    assert.deepEqual((await tx.impactIncident({ ...base, relationshipTypes: [] })).items, []);
  } finally {
    db.close();
  }
});

test("latest evidence and exact supersession counts use subject and scalar indexes with bounded samples", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    migrate(db);
    for (let index = 0; index < 100; index++)
      db.prepare(
        "INSERT INTO evidence(id,kind,subject_id,payload_json) VALUES (?,'review','original',?)",
      ).run(`review-${index}`, JSON.stringify({ id: `review-${index}` }));
    for (const id of ["z", "a", "d", "c", "b"])
      append(db, { ...receipt(id), supersedes: "original" });
    const queries = observe(db),
      tx = impactTransaction(db, () => {});
    assert.deepEqual(await tx.latestEvidence("review", "original"), { id: "review-99" });
    assert.match(queries.plan(0), /SEARCH evidence USING INDEX evidence_subject/);
    assert.equal(await tx.latestEvidence("observation", "original"), undefined);
    assert.deepEqual(await tx.impactSupersession("original"), { count: 5, ids: ["a", "b", "c"] });
    assert.match(queries.plan(2), /SEARCH evidence USING INDEX receipt_supersedes/);
    assert.match(queries.plan(3), /SEARCH evidence USING INDEX receipt_supersedes/);
    assert.deepEqual(await tx.impactSupersession("missing"), { count: 0, ids: [] });
  } finally {
    db.close();
  }
});

test("format7 backfills immutable receipt dependencies and subsequent receipt appends rollback atomically without native history writes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-impact-storage-")),
    path = join(directory, "project.sqlite");
  let repository: SQLiteRepository | undefined;
  try {
    repository = new SQLiteRepository(path);
    const original = receipt("original", ["old-input"], [link("old-link")]);
    await repository.transaction((tx) =>
      tx.appendEvidence("receipt", original.output.id, original),
    );
    repository.close();
    repository = undefined;
    const downgrade = new DatabaseSync(path);
    const json = downgrade.prepare("SELECT payload_json FROM evidence").get()!.payload_json;
    downgrade.exec(
      "DROP TABLE evaluation_commands; DROP TABLE changeset_commands; DROP TABLE receipt_dependencies; DROP INDEX receipt_supersedes; DROP TABLE resource_identities; DROP INDEX resource_source_identity; ALTER TABLE entities DROP COLUMN resource_json; ALTER TABLE relationships DROP COLUMN reference_json; UPDATE storage_version SET version=7",
    );
    downgrade.close();
    repository = new SQLiteRepository(path);
    assert.deepEqual(
      await repository.transaction((tx) =>
        tx.impactReceipts({ entityIds: ["old-input"], relationshipIds: [], limit: 25 }),
      ),
      { items: [original] },
    );
    const later = receipt("later", ["new-input"]);
    await repository.transaction((tx) => tx.appendEvidence("receipt", later.output.id, later));
    await assert.rejects(
      repository.transaction(async (tx) => {
        await tx.appendEvidence("receipt", "output", receipt("rolled-back", ["absent"]));
        throw new Error("cancel transaction");
      }),
      /Storage operation failed/,
    );
    assert.deepEqual(
      await repository.transaction((tx) =>
        tx.impactReceipts({ entityIds: ["absent"], relationshipIds: [], limit: 25 }),
      ),
      { items: [] },
    );
    assert.equal(await repository.transaction((tx) => tx.impactEvidenceRevision()), 2);
    assert.equal(await repository.transaction((tx) => tx.headRevision()), 0);
    assert.deepEqual(await repository.transaction((tx) => tx.history({})), { items: [] });
    repository.close();
    repository = undefined;
    const inspect = new DatabaseSync(path);
    assert.equal(inspect.prepare("SELECT version FROM storage_version").get()!.version, 11);
    assert.equal(
      inspect.prepare("SELECT payload_json FROM evidence WHERE id='original'").get()!.payload_json,
      json,
    );
    assert.equal(
      inspect
        .prepare("SELECT COUNT(*) AS n FROM receipt_dependencies WHERE object_id='absent'")
        .get()!.n,
      0,
    );
    inspect.close();
  } finally {
    repository?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
