import { TransactionQueue } from "./transaction-queue.ts";
import { decodeEntity, decodeRelationship } from "./native-codec.ts";
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";
import type { Repository, Transaction } from "../application/ports/repository.ts";
import { TracerError, ensure } from "../core/model.ts";
import type {
  Kind,
  Stored,
  Changeset,
  Revision,
  ObjectQuery,
  HistoryQuery,
  Page,
} from "../core/model.ts";
import { workspaceViewTransaction } from "./workspace-views.ts";
import { configurationTransaction } from "./configurations.ts";
import { baselineTransaction } from "./baselines.ts";
import { page, jsonPage } from "./pages.ts";
import { coverageTransaction } from "./coverage.ts";
import { impactTransaction, indexReceiptDependencies } from "./impact.ts";
import { migrate, writeCurrent } from "./migrations.ts";
import { workingContextTransaction } from "./working-context.ts";

type Row = Record<string, unknown>;
function decodeRevision(row: Row): Revision {
  return {
    revisionId: String(row.revision_id),
    changesetId: String(row.changeset_id),
    projectRevision: Number(row.project_revision),
    ordinal: Number(row.ordinal),
    schemaVersion: Number(row.schema_version),
    kind: row.kind as Kind,
    id: String(row.object_id),
    version: Number(row.version),
    snapshot: row.snapshot_json === null ? null : JSON.parse(String(row.snapshot_json)),
  };
}
const tables = { entity: "entities", relationship: "relationships", schema: "schemas" } as const;
function decode(kind: Kind, row: Row): Stored {
  const common = { id: String(row.id), version: Number(row.version) };
  if (kind === "schema") return { ...common, ...JSON.parse(String(row.definition_json)) };
  return kind === "entity" ? decodeEntity(row) : decodeRelationship(row);
}
function changeset(row: Row): Changeset {
  return {
    id: String(row.id),
    projectRevision: Number(row.project_revision),
    schemaVersion: Number(row.schema_version),
    at: String(row.at),
    actor: String(row.actor),
    ...(row.reason === null ? {} : { reason: String(row.reason) }),
  };
}
function storageError(error: unknown): Error {
  if (error instanceof TracerError) return error;
  const code = (error as { errcode?: number })?.errcode;
  if (code === 787 || code === 1811)
    return new TracerError(
      "referential_integrity",
      "An active relationship requires active endpoints",
    );
  if (code === 1555 || code === 2067)
    return new TracerError("conflict", "Identity or human key already exists");
  if (code !== undefined && [5, 6].includes(code & 255))
    return new TracerError("busy", "Database is busy; retry the complete command");
  return new TracerError("storage", "Storage operation failed");
}
function filters(query: ObjectQuery) {
  const clauses = ["1=1"],
    params: SQLInputValue[] = [];
  for (const [filter, column] of Object.entries({
    type: "type",
    key: "human_key",
    source: "source_entity_id",
    target: "target_entity_id",
  })) {
    const value = query[filter as keyof ObjectQuery];
    if (value !== undefined) {
      clauses.push(`${column}=?`);
      params.push(value);
    }
  }
  if (query.incident !== undefined) {
    clauses.push("(source_entity_id=? OR target_entity_id=?)");
    params.push(query.incident, query.incident);
  }
  if (query.search) {
    clauses.push(
      "(human_key LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM json_each(attributes_json) v WHERE v.type='text' AND v.value LIKE ? ESCAPE '\\'))",
    );
    const pattern = "%" + query.search.replace(/[\\%_]/g, (character) => "\\" + character) + "%";
    params.push(pattern, pattern);
  }
  if (query.field !== undefined) {
    clauses.push(
      "EXISTS (SELECT 1 FROM json_each(attributes_json) f WHERE f.key=? AND f.type=\'text\' AND f.value=?)",
    );
    params.push(query.field, query.value!);
  }
  if (query.without !== undefined) {
    clauses.push(
      `NOT EXISTS (SELECT 1 FROM relationships r JOIN entities t ON t.id=r.target_entity_id WHERE r.source_entity_id=${tables.entity}.id AND r.type=? AND t.type=?)`,
    );
    params.push(query.without, query.targetType!);
  }
  if (query.after !== undefined) {
    clauses.push("id > ? COLLATE BINARY");
    params.push(query.after);
  }
  return { where: clauses.join(" AND "), params };
}

export class SQLiteRepository implements Repository {
  private db!: DatabaseSync;
  private readonly queue = new TransactionQueue();
  constructor(path: string) {
    try {
      this.db = new DatabaseSync(path);
      this.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=100; PRAGMA journal_mode=WAL;");
      migrate(this.db);
    } catch (error) {
      this.queue.close();
      this.db?.close();
      throw storageError(error);
    }
  }
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.queue.run(async () => {
      let current: Changeset | undefined;
      let ordinal = 0;
      let active = true;
      const check = () => ensure(active, "storage", "Transaction is no longer active");
      const append = (kind: Kind, id: string, version: number, snapshot: Stored | null) => {
        check();
        ensure(current, "storage", "Writes require a changeset");
        this.db
          .prepare("INSERT INTO object_revisions VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(
            globalThis.crypto.randomUUID(),
            current.id,
            ++ordinal,
            kind,
            id,
            version,
            snapshot === null ? null : JSON.stringify(snapshot),
          );
      };
      const tx: Transaction = {
        findResource: async (source) => {
          check();
          const owner = this.db
            .prepare(
              "SELECT entity_id AS id FROM resource_identities WHERE system=? AND external_id=? UNION SELECT subject_id AS id FROM evidence WHERE kind='external' AND system=? AND external_id=?",
            )
            .get(source.system, source.externalId, source.system, source.externalId);
          if (owner) {
            const existing = this.db
              .prepare("SELECT * FROM entities WHERE id=?")
              .get(String(owner.id));
            ensure(
              existing,
              "conflict",
              "Source identity belongs to a removed resource; it cannot be reassigned",
            );
            return decode("entity", existing) as import("../core/model.ts").Entity;
          }
          const row = this.db
            .prepare(
              `SELECT e.* FROM entities e WHERE
            (json_extract(e.resource_json,'$.source.system')=? AND json_extract(e.resource_json,'$.source.externalId')=?)
            OR e.id IN (SELECT subject_id FROM evidence WHERE kind='external' AND system=? AND external_id=?) LIMIT 1`,
            )
            .get(source.system, source.externalId, source.system, source.externalId);
          return row ? (decode("entity", row) as import("../core/model.ts").Entity) : undefined;
        },
        ...workingContextTransaction(this.db, check),
        ...impactTransaction(this.db, check),
        ...coverageTransaction(this.db, check),
        ...baselineTransaction(this.db, check),
        ...workspaceViewTransaction(this.db, check),
        ...configurationTransaction(this.db, check),
        getRevision: async (kind, id, version) => {
          check();
          const row = this.db
            .prepare(
              `SELECT r.*, c.project_revision, c.schema_version FROM object_revisions r JOIN changesets c ON c.id=r.changeset_id WHERE r.kind=? AND r.object_id=? AND r.version=?`,
            )
            .get(kind, id, version);
          return row ? decodeRevision(row) : undefined;
        },
        getEvidence: async (kind, id) => {
          check();
          const row = this.db
            .prepare("SELECT payload_json FROM evidence WHERE kind=? AND id=?")
            .get(kind, id);
          return row ? JSON.parse(String(row.payload_json)) : undefined;
        },
        evidence: async (kind, query) => {
          check();
          const limit = query.limit ?? 100;
          const subjects = query.subject == null ? [] : [query.subject];
          const rows = this.db
            .prepare(
              `SELECT sequence,payload_json FROM evidence WHERE kind=?
                ${subjects.length ? "AND subject_id=?" : ""}
                AND sequence>? ORDER BY sequence LIMIT ?`,
            )
            .all(kind, ...subjects, Number(query.after ?? 0), limit + 1);
          return jsonPage<import("../core/evidence.ts").Evidence>(rows, limit);
        },
        appendEvidence: async (kind, subject, value) => {
          check();
          const identity =
            kind === "external"
              ? (value as import("../core/evidence.ts").ExternalIdentity)
              : undefined;
          const inserted = this.db
            .prepare(
              "INSERT INTO evidence(id,kind,subject_id,payload_json,system,external_id) VALUES (?,?,?,?,?,?)",
            )
            .run(
              value.id,
              kind,
              subject,
              JSON.stringify(value),
              identity?.system ?? null,
              identity?.externalId ?? null,
            );
          if (kind === "receipt")
            indexReceiptDependencies(this.db, Number(inserted.lastInsertRowid));
        },
        get: async (kind, id) => {
          check();
          const row = this.db.prepare(`SELECT * FROM ${tables[kind]} WHERE id=?`).get(id);
          return row ? decode(kind, row) : undefined;
        },
        headRevision: async () => {
          check();
          return Number(
            this.db.prepare("SELECT value FROM project_counter WHERE id=1").get()!.value,
          );
        },
        getAt: async (kind, id, revision) => {
          check();
          const row = this.db
            .prepare(
              `
            SELECT r.snapshot_json FROM object_revisions r
            JOIN changesets c ON c.id=r.changeset_id
            WHERE r.kind=? AND r.object_id=? AND c.project_revision<=?
            ORDER BY r.version DESC LIMIT 1
          `,
            )
            .get(kind, id, revision);
          return row?.snapshot_json == null ? undefined : JSON.parse(String(row.snapshot_json));
        },
        incidentAt: async (id, revision, limit) => {
          check();
          const rows = this.db
            .prepare(
              `
            SELECT r.object_id, r.snapshot_json FROM object_revisions r
            JOIN changesets c ON c.id=r.changeset_id
            WHERE r.kind='relationship' AND c.project_revision<=?
              AND (json_extract(r.snapshot_json,'$.source')=? OR json_extract(r.snapshot_json,'$.target')=?)
              AND NOT EXISTS (
                SELECT 1 FROM object_revisions newer JOIN changesets nc ON nc.id=newer.changeset_id
                WHERE newer.object_id=r.object_id AND newer.version>r.version AND nc.project_revision<=?
              )
            ORDER BY r.object_id COLLATE BINARY LIMIT ?
          `,
            )
            .all(revision, id, id, revision, limit + 1);
          return page(
            rows.map((row) => JSON.parse(String(row.snapshot_json)) as Stored),
            limit,
            (item) => item.id,
          );
        },
        entityPredecessor: async (id, type) => {
          check();
          const row = this.db
            .prepare(
              "SELECT id FROM entities WHERE type=? AND id<? COLLATE BINARY ORDER BY id DESC LIMIT 1",
            )
            .get(type, id);
          return row ? String(row.id) : undefined;
        },
        query: async (kind, query: ObjectQuery) => {
          check();
          const { where, params } = filters(query);
          const limit = query.limit ?? 100;
          const rows = this.db
            .prepare(
              `SELECT * FROM ${tables[kind]} WHERE ${where} ORDER BY id COLLATE BINARY LIMIT ?`,
            )
            .all(...params, limit + 1);
          return page(
            rows.map((row) => decode(kind, row)),
            limit,
            (item) => item.id,
          );
        },
        workingSet: async (query) => {
          check();
          const { where, params } = filters({ ...query, after: undefined });
          const total = Number(
            this.db.prepare(`SELECT COUNT(*) AS count FROM entities WHERE ${where}`).get(...params)!
              .count,
          );
          const types = this.db
            .prepare("SELECT type,COUNT(*) AS count FROM entities GROUP BY type ORDER BY type")
            .all()
            .map((row) => ({ type: String(row.type), count: Number(row.count) }));
          return {
            entities: (await tx.query("entity", query)) as Page<import("../core/model.ts").Entity>,
            total,
            types,
          };
        },
        connectionCount: async (id, type) => {
          check();
          const { where, params } = filters({ incident: id, type });
          return Number(
            this.db
              .prepare(`SELECT COUNT(*) AS count FROM relationships WHERE ${where}`)
              .get(...params)!.count,
          );
        },
        traceability: async (sourceIds, targetIds, targetType, relationshipType) => {
          check();
          if (!sourceIds.length) return { links: [], missingSourceIds: [] };
          const sourcePlaceholders = sourceIds.map(() => "?").join(",");
          const links = targetIds.length
            ? this.db
                .prepare(
                  `SELECT * FROM relationships WHERE type=? AND source_entity_id IN (${sourcePlaceholders}) AND target_entity_id IN (${targetIds.map(() => "?").join(",")}) ORDER BY id LIMIT 1001`,
                )
                .all(relationshipType, ...sourceIds, ...targetIds)
                .map(
                  (row) => decode("relationship", row) as import("../core/model.ts").Relationship,
                )
            : [];
          ensure(
            links.length <= 1000,
            "validation",
            "Matrix contains more than 1000 links; narrow its pages",
          );
          const missing = this.db
            .prepare(
              `SELECT e.id FROM entities e WHERE e.id IN (${sourcePlaceholders}) AND NOT EXISTS (
            SELECT 1 FROM relationships r JOIN entities t ON t.id=r.target_entity_id
            WHERE r.source_entity_id=e.id AND r.type=? AND t.type=?
          ) ORDER BY e.id`,
            )
            .all(...sourceIds, relationshipType, targetType);
          return { links, missingSourceIds: missing.map((row) => String(row.id)) };
        },
        getChangesetCommand: async (commandId) => {
          check();
          const row = this.db
            .prepare("SELECT intent_json,result_json FROM changeset_commands WHERE command_id=?")
            .get(commandId);
          return row
            ? { intent: String(row.intent_json), result: JSON.parse(String(row.result_json)) }
            : undefined;
        },
        appendChangesetCommand: async (commandId, intent, result) => {
          check();
          ensure(
            current && current.id === result.changeset.id,
            "storage",
            "Command outcome requires its current changeset",
          );
          this.db
            .prepare("INSERT INTO changeset_commands VALUES (?,?,?,?)")
            .run(commandId, intent, current.id, JSON.stringify(result));
        },
        beginChangeset: async (id, schemaVersion, provenance) => {
          check();
          ensure(!current, "storage", "Only one changeset per transaction");
          const row = this.db
            .prepare("UPDATE project_counter SET value=value+1 WHERE id=1 RETURNING value")
            .get()!;
          current = {
            ...provenance,
            id,
            schemaVersion,
            projectRevision: Number(row.value),
            at: new Date().toISOString(),
          };
          this.db
            .prepare("INSERT INTO changesets VALUES (?, ?, ?, ?, ?, ?)")
            .run(
              id,
              current.projectRevision,
              schemaVersion,
              current.at,
              provenance.actor,
              provenance.reason ?? null,
            );
          return current;
        },
        save: async (kind, object, expectedVersion) => {
          check();
          ensure(current, "storage", "Writes require a changeset");
          ensure(
            object.version === expectedVersion + 1,
            "conflict",
            "Object versions must advance by one",
          );
          if (expectedVersion === 0) {
            // Registry entries survive deletion, so identity reuse always conflicts.
            this.db.prepare("INSERT INTO identities VALUES (?, ?, 1, 1)").run(object.id, kind);
          } else {
            const result = this.db
              .prepare(
                "UPDATE identities SET version=version+1 WHERE id=? AND kind=? AND version=? AND active=1",
              )
              .run(object.id, kind, expectedVersion);
            ensure(
              result.changes === 1,
              "conflict",
              "Object version changed or identity is inactive",
            );
          }
          writeCurrent(this.db, kind, object);
          append(kind, object.id, object.version, object);
        },
        remove: async (kind, id, expectedVersion) => {
          check();
          ensure(current, "storage", "Writes require a changeset");
          const result = this.db
            .prepare(
              "UPDATE identities SET version=version+1, active=0 WHERE id=? AND kind=? AND version=? AND active=1",
            )
            .run(id, kind, expectedVersion);
          ensure(
            result.changes === 1,
            "conflict",
            "Object version changed or identity is inactive",
          );
          this.db.prepare(`DELETE FROM ${tables[kind]} WHERE id=?`).run(id);
          append(kind, id, expectedVersion + 1, null);
        },
        history: async (query: HistoryQuery) => {
          check();
          const clauses = ["1=1"],
            params: SQLInputValue[] = [];
          if (query.kind !== undefined) {
            clauses.push("r.kind=?");
            params.push(query.kind);
          }
          if (query.id !== undefined) {
            clauses.push("r.object_id=?");
            params.push(query.id);
          }
          if (query.after !== undefined) {
            const [revision, ordinal] = query.after.split(":").map(Number);
            clauses.push("(c.project_revision > ? OR (c.project_revision=? AND r.ordinal>?))");
            params.push(revision, revision, ordinal);
          }
          const limit = query.limit ?? 100;
          const rows = this.db
            .prepare(
              `SELECT r.*, c.project_revision, c.schema_version FROM object_revisions r JOIN changesets c ON c.id=r.changeset_id WHERE ${clauses.join(" AND ")} ORDER BY c.project_revision, r.ordinal LIMIT ?`,
            )
            .all(...params, limit + 1);
          const items = rows.map(decodeRevision);
          return page(items, limit, (item) => `${item.projectRevision}:${item.ordinal}`);
        },
        changesets: async (afterRevision, limit) => {
          check();
          return this.db
            .prepare(
              "SELECT * FROM changesets WHERE project_revision>? ORDER BY project_revision LIMIT ?",
            )
            .all(afterRevision, limit)
            .map(changeset);
        },
      };
      try {
        this.db.exec("BEGIN IMMEDIATE");
        const result = await work(tx);
        ensure(!current || ordinal > 0, "validation", "Empty changesets are not committed");
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        if (this.db.isTransaction) this.db.exec("ROLLBACK");
        // Application errors retain their codes; driver details stay inside the adapter.
        throw error instanceof TracerError ? error : storageError(error);
      } finally {
        active = false;
      }
    });
  }
  close() {
    this.db.close();
    this.queue.close();
  }
}
