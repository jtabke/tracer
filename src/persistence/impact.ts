import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { EvidenceByKind, Receipt } from "../core/evidence.ts";
import type { ImpactIncidentQuery, ImpactReceiptQuery } from "../core/impact.ts";
import type { Relationship } from "../core/model.ts";
import type { Transaction } from "../application/ports/repository.ts";
import { jsonPage, page } from "./pages.ts";
import { decodeRelationship } from "./native-codec.ts";

/** Derived lookup only: immutable receipt JSON remains the captured dependency authority. */
export function indexReceiptDependencies(db: DatabaseSync, sequence?: number) {
  const where = sequence === undefined ? "e.kind='receipt'" : "e.kind='receipt' AND e.sequence=?";
  const values = sequence === undefined ? [] : [sequence];
  db.prepare(
    `INSERT INTO receipt_dependencies(dependency_kind,object_id,receipt_sequence)
    SELECT 'entity',json_extract(input.value,'$.entityId'),e.sequence
      FROM evidence e,json_each(e.payload_json,'$.inputs') input WHERE ${where}
    UNION
    SELECT 'relationship',json_extract(link.value,'$.id'),e.sequence
      FROM evidence e,json_each(e.payload_json,'$.inputs') input,
        json_each(input.value,'$.links') link WHERE ${where}
    UNION
    SELECT 'relationship',json_extract(input.value,'$.relationship.id'),e.sequence
      FROM evidence e,json_each(e.payload_json,'$.relationshipInputs') input WHERE ${where}`,
  ).run(...values, ...values, ...values);
}

function endpoints(direction: ImpactIncidentQuery["direction"]) {
  if (direction === "outgoing") return ["source"];
  if (direction === "incoming") return ["target"];
  return ["source", "target"];
}
function currentIncident(endpoint: string) {
  return `SELECT * FROM relationships WHERE ${endpoint}_entity_id=?
      AND type IN (SELECT value FROM json_each(?))`;
}
function historicalIncident(endpoint: string) {
  return `SELECT r.object_id AS id,r.snapshot_json AS payload_json
    FROM object_revisions r WHERE r.kind='relationship'
      AND json_extract(r.snapshot_json,'$.${endpoint}')=?
      AND json_extract(r.snapshot_json,'$.type') IN (SELECT value FROM json_each(?))
      AND EXISTS (SELECT 1 FROM changesets c
        WHERE c.id=r.changeset_id AND c.project_revision<=?)
      AND NOT EXISTS (SELECT 1 FROM object_revisions newer
        JOIN changesets nc ON nc.id=newer.changeset_id
        WHERE newer.object_id=r.object_id AND newer.version>r.version
          AND nc.project_revision<=?)`;
}
function incidentPage(db: DatabaseSync, query: ImpactIncidentQuery) {
  const historical = query.atRevision !== undefined;
  const branches = endpoints(query.direction);
  const values: SQLInputValue[] = branches.flatMap(() => [
    query.id,
    JSON.stringify(query.relationshipTypes),
    ...(historical ? [query.atRevision!, query.atRevision!] : []),
  ]);
  const rows = db
    .prepare(
      `${branches.map(historical ? historicalIncident : currentIncident).join(" UNION ")}
      ORDER BY id COLLATE BINARY LIMIT ?`,
    )
    .all(...values, query.limit + 1);
  if (historical) return jsonPage<Relationship>(rows, query.limit, "payload_json", "id");
  const selected = page(rows, query.limit, (row) => String(row.id));
  return { ...selected, items: selected.items.map(decodeRelationship) };
}
function receiptPage(db: DatabaseSync, query: ImpactReceiptQuery) {
  const rows = db
    .prepare(
      `WITH selected AS (
      SELECT receipt_sequence FROM receipt_dependencies
        WHERE dependency_kind='entity' AND object_id IN (SELECT value FROM json_each(?))
      UNION
      SELECT receipt_sequence FROM receipt_dependencies
        WHERE dependency_kind='relationship' AND object_id IN (SELECT value FROM json_each(?))
    ) SELECT e.sequence,e.payload_json FROM selected CROSS JOIN evidence e
      WHERE e.sequence=selected.receipt_sequence AND e.sequence>?
      ORDER BY e.sequence LIMIT ?`,
    )
    .all(
      JSON.stringify(query.entityIds),
      JSON.stringify(query.relationshipIds),
      Number(query.after ?? 0),
      query.limit + 1,
    );
  return jsonPage<Receipt>(rows, query.limit);
}
export function impactTransaction(
  db: DatabaseSync,
  check: () => void,
): Pick<
  Transaction,
  | "impactIncident"
  | "impactReceipts"
  | "impactEvidenceRevision"
  | "latestEvidence"
  | "impactSupersession"
  | "supersedingReceiptIds"
> {
  return {
    impactIncident: async (query) => {
      check();
      return incidentPage(db, query);
    },
    impactReceipts: async (query) => {
      check();
      return receiptPage(db, query);
    },
    impactEvidenceRevision: async () => {
      check();
      return Number(
        db.prepare("SELECT COALESCE(MAX(sequence),0) AS revision FROM evidence").get()!.revision,
      );
    },
    latestEvidence: async <K extends "observation" | "review">(kind: K, subject: string) => {
      check();
      const row = db
        .prepare(
          "SELECT payload_json FROM evidence WHERE kind=? AND subject_id=? ORDER BY sequence DESC LIMIT 1",
        )
        .get(kind, subject);
      return row ? (JSON.parse(String(row.payload_json)) as EvidenceByKind[K]) : undefined;
    },
    impactSupersession: async (receiptId) => {
      check();
      const where =
        "FROM evidence WHERE kind='receipt' AND json_extract(payload_json,'$.supersedes')=?";
      const count = Number(db.prepare(`SELECT COUNT(*) AS count ${where}`).get(receiptId)!.count);
      const ids = db
        .prepare(`SELECT id ${where} ORDER BY id COLLATE BINARY LIMIT 3`)
        .all(receiptId)
        .map((row) => String(row.id));
      return { count, ids };
    },
    supersedingReceiptIds: async (receiptId) => {
      check();
      return db
        .prepare(
          `SELECT id FROM evidence WHERE kind='receipt'
          AND json_extract(payload_json,'$.supersedes')=? ORDER BY sequence`,
        )
        .all(receiptId)
        .map((row) => String(row.id));
    },
  };
}
