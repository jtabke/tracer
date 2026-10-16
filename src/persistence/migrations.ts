import type { DatabaseSync } from "node:sqlite";
import { ensure } from "../core/model.ts";
import type { Stored, Kind, Entity, SchemaObject, Relationship } from "../core/model.ts";
import { indexReceiptDependencies } from "./impact.ts";

const format2 = `
  CREATE TABLE identities (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('entity','relationship','schema')),
    version INTEGER NOT NULL CHECK(version > 0), active INTEGER NOT NULL CHECK(active IN (0,1))
  );
  CREATE TABLE entities (
    id TEXT PRIMARY KEY REFERENCES identities(id), type TEXT NOT NULL,
    human_key TEXT UNIQUE COLLATE BINARY, version INTEGER NOT NULL CHECK(version > 0), attributes_json TEXT NOT NULL
  );
  CREATE INDEX entity_type_id ON entities(type, id);
  CREATE TABLE relationships (
    id TEXT PRIMARY KEY REFERENCES identities(id), source_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
    target_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
    type TEXT NOT NULL, version INTEGER NOT NULL CHECK(version > 0), attributes_json TEXT NOT NULL
  );
  CREATE INDEX relationship_source ON relationships(source_entity_id, type, id);
  CREATE INDEX relationship_target ON relationships(target_entity_id, type, id);
  CREATE INDEX relationship_type_id ON relationships(type, id);
  CREATE TABLE schemas (
    id TEXT PRIMARY KEY CHECK(id = 'project') REFERENCES identities(id), version INTEGER NOT NULL CHECK(version > 0), definition_json TEXT NOT NULL
  );
  CREATE TABLE project_counter (id INTEGER PRIMARY KEY CHECK(id = 1), value INTEGER NOT NULL);
  INSERT INTO project_counter VALUES (1, 0);
  CREATE TABLE changesets (
    id TEXT PRIMARY KEY, project_revision INTEGER NOT NULL UNIQUE, schema_version INTEGER NOT NULL,
    at TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT
  );
  CREATE TABLE object_revisions (
    revision_id TEXT PRIMARY KEY, changeset_id TEXT NOT NULL REFERENCES changesets(id),
    ordinal INTEGER NOT NULL, kind TEXT NOT NULL, object_id TEXT NOT NULL REFERENCES identities(id),
    version INTEGER NOT NULL, snapshot_json TEXT,
    UNIQUE(changeset_id, ordinal), UNIQUE(object_id, version)
  );
  CREATE INDEX revision_object ON object_revisions(object_id, version);
`;

export function writeCurrent(db: DatabaseSync, kind: Kind, object: Stored) {
  if (kind === "schema") {
    const schema = object as SchemaObject;
    db.prepare(
      "INSERT INTO schemas VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET version=excluded.version, definition_json=excluded.definition_json",
    ).run(
      object.id,
      object.version,
      JSON.stringify({
        entityTypes: schema.entityTypes,
        relationshipTypes: schema.relationshipTypes,
        ...(schema.coverageExpectations === undefined
          ? {}
          : { coverageExpectations: schema.coverageExpectations }),
      }),
    );
  } else if (kind === "entity") {
    const entity = object as Entity;
    db.prepare(
      "INSERT INTO entities VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET type=excluded.type, human_key=excluded.human_key, version=excluded.version, attributes_json=excluded.attributes_json",
    ).run(
      entity.id,
      entity.type,
      entity.key ?? null,
      entity.version,
      JSON.stringify(entity.fields),
    );
  } else {
    const link = object as Relationship;
    db.prepare(
      "INSERT INTO relationships VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET source_entity_id=excluded.source_entity_id, target_entity_id=excluded.target_entity_id, type=excluded.type, version=excluded.version, attributes_json=excluded.attributes_json",
    ).run(link.id, link.source, link.target, link.type, link.version, JSON.stringify(link.fields));
  }
}

// Called only inside the physical-format migration transaction.
function importLegacyObjects(db: DatabaseSync) {
  let schemaVersion = 0;
  for (const row of db.prepare("SELECT * FROM revisions ORDER BY sequence").all()) {
    const snapshot = row.snapshot === null ? null : (JSON.parse(String(row.snapshot)) as Stored);
    if (row.kind === "schema") schemaVersion = Number(row.version);
    db.prepare(
      "INSERT INTO identities VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET version=excluded.version, active=excluded.active",
    ).run(row.id!, row.kind!, row.version!, snapshot === null ? 0 : 1);
    const changesetId = globalThis.crypto.randomUUID();
    db.prepare("INSERT INTO changesets VALUES (?, ?, ?, ?, ?, ?)").run(
      changesetId,
      row.sequence!,
      schemaVersion,
      row.at!,
      row.actor!,
      row.reason!,
    );
    db.prepare("INSERT INTO object_revisions VALUES (?, ?, 1, ?, ?, ?, ?)").run(
      globalThis.crypto.randomUUID(),
      changesetId,
      row.kind!,
      row.id!,
      row.version!,
      row.snapshot!,
    );
  }
  for (const kind of ["schema", "entity", "relationship"] as const) {
    for (const row of db.prepare("SELECT payload FROM objects WHERE kind=?").all(kind))
      writeCurrent(db, kind, JSON.parse(String(row.payload)));
  }
  ensure(
    db.prepare("PRAGMA foreign_key_check").all().length === 0,
    "storage",
    "Legacy database contains invalid references",
  );
  db.exec(
    "UPDATE project_counter SET value=(SELECT COALESCE(MAX(project_revision),0) FROM changesets); DROP TABLE objects; DROP TABLE revisions; DROP TABLE revision_counter;",
  );
}

// Physical format versions are independent of project schema versions.
// The v1 prototype stored one object revision per transaction. Preserve each as one changeset.
function storageVersion(db: DatabaseSync) {
  const exists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='storage_version'")
    .get();
  const versions = exists ? db.prepare("SELECT version FROM storage_version").all() : [];
  ensure(
    !exists ||
      (versions.length === 1 && [1, 2, 3, 4, 5, 6, 7, 8].includes(Number(versions[0].version))),
    "unsupported_storage",
    "Unsupported physical database format",
  );
  return exists ? Number(versions[0].version) : 0;
}
export function migrate(db: DatabaseSync) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const version = storageVersion(db);
    if (version < 2) {
      // Free the v1 index name before creating the new history index.
      if (version === 1) db.exec("DROP INDEX IF EXISTS revision_object");
      db.exec(format2);
      if (version === 1) {
        importLegacyObjects(db);
      } else db.exec("CREATE TABLE storage_version (version INTEGER NOT NULL)");
      db.exec("DELETE FROM storage_version; INSERT INTO storage_version VALUES (2)");
    }
    if (version < 3) {
      db.exec(`
        CREATE TABLE evidence (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('external','observation','receipt','review')),
          subject_id TEXT NOT NULL,
          payload_json TEXT NOT NULL, system TEXT, external_id TEXT,
          UNIQUE(kind,id), UNIQUE(system,external_id)
        );
        CREATE INDEX evidence_subject ON evidence(kind,subject_id,sequence);
        CREATE TRIGGER evidence_no_update BEFORE UPDATE ON evidence BEGIN SELECT RAISE(ABORT,'Immutable evidence'); END;
        CREATE TRIGGER evidence_no_delete BEFORE DELETE ON evidence BEGIN SELECT RAISE(ABORT,'Immutable evidence'); END;
        UPDATE storage_version SET version=3;
      `);
    }
    if (version < 4) {
      db.exec(`
        CREATE TABLE workspace_views (
          id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE BINARY,
          version INTEGER NOT NULL CHECK(version > 0), definition_json TEXT NOT NULL
        );
        UPDATE storage_version SET version=4;
      `);
    }
    if (version < 5) {
      db.exec(`
        CREATE TABLE configurations (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT NOT NULL UNIQUE, subject_id TEXT NOT NULL, payload_json TEXT NOT NULL
        );
        CREATE INDEX configuration_subject ON configurations(subject_id,sequence);
        CREATE TRIGGER configuration_no_update BEFORE UPDATE ON configurations BEGIN SELECT RAISE(ABORT,'Immutable configuration'); END;
        CREATE TRIGGER configuration_no_delete BEFORE DELETE ON configurations BEGIN SELECT RAISE(ABORT,'Immutable configuration'); END;
        UPDATE storage_version SET version=5;
      `);
    }
    if (version < 6) {
      db.exec(`
        CREATE TABLE baselines (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL
        );
        CREATE TRIGGER baseline_no_update BEFORE UPDATE ON baselines BEGIN SELECT RAISE(ABORT,'Immutable baseline'); END;
        CREATE TRIGGER baseline_no_delete BEFORE DELETE ON baselines BEGIN SELECT RAISE(ABORT,'Immutable baseline'); END;
        UPDATE storage_version SET version=6;
      `);
    }
    if (version < 7) {
      db.exec(`
        CREATE INDEX coverage_source_target ON relationships(source_entity_id,type,target_entity_id,id);
        CREATE INDEX coverage_target_source ON relationships(target_entity_id,type,source_entity_id,id);
        UPDATE storage_version SET version=7;
      `);
    }
    if (version < 8) {
      db.exec(`
        CREATE TABLE receipt_dependencies (
          dependency_kind TEXT NOT NULL CHECK(dependency_kind IN ('entity','relationship')),
          object_id TEXT NOT NULL,
          receipt_sequence INTEGER NOT NULL REFERENCES evidence(sequence),
          PRIMARY KEY(dependency_kind,object_id,receipt_sequence)
        ) WITHOUT ROWID;
        CREATE INDEX receipt_supersedes ON evidence(json_extract(payload_json,'$.supersedes'),id)
          WHERE kind='receipt';
      `);
      indexReceiptDependencies(db);
      db.exec("UPDATE storage_version SET version=8");
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS revision_kind_object_version ON object_revisions(kind,object_id,version);
      CREATE INDEX IF NOT EXISTS revision_source ON object_revisions(json_extract(snapshot_json,'$.source'),object_id,version) WHERE kind='relationship';
      CREATE INDEX IF NOT EXISTS revision_target ON object_revisions(json_extract(snapshot_json,'$.target'),object_id,version) WHERE kind='relationship';
    `);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
