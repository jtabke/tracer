import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { ensure } from "../core/model.ts";
import type { Entity, Relationship } from "../core/model.ts";
import type { CoverageFilter, CoverageNativeQuery, CoverageNativeRow } from "../core/coverage.ts";
import type { Transaction } from "./contracts.ts";
import { page } from "./pages.ts";

type Row = Record<string, unknown>;
type SQL = { text: string; values: SQLInputValue[] };

/** Resolve final native revisions before applying logical population/connection filters. */
function nativeTables(atRevision?: number): SQL {
  if (atRevision === undefined)
    return {
      text: `native_entities AS NOT MATERIALIZED (
        SELECT id,type,human_key,version,attributes_json AS fields FROM entities
      ), native_links AS NOT MATERIALIZED (
        SELECT id,type,source_entity_id AS source,target_entity_id AS target,version,
          attributes_json AS fields FROM relationships
      )`,
      values: [],
    };
  return {
    text: `native_entities AS NOT MATERIALIZED (
      SELECT r.object_id AS id,json_extract(r.snapshot_json,'$.type') AS type,
        json_extract(r.snapshot_json,'$.key') AS human_key,r.version,
        json_extract(r.snapshot_json,'$.fields') AS fields
      ${historicalRows("entity")}
    ), native_links AS NOT MATERIALIZED (
      SELECT r.object_id AS id,json_extract(r.snapshot_json,'$.type') AS type,
        json_extract(r.snapshot_json,'$.source') AS source,
        json_extract(r.snapshot_json,'$.target') AS target,r.version,
        json_extract(r.snapshot_json,'$.fields') AS fields
      ${historicalRows("relationship")}
    )`,
    values: [atRevision, atRevision, atRevision, atRevision],
  };
}
function historicalRows(kind: "entity" | "relationship") {
  return `FROM object_revisions r
    WHERE r.kind='${kind}' AND r.snapshot_json IS NOT NULL
      AND EXISTS (SELECT 1 FROM changesets c
        WHERE c.id=r.changeset_id AND c.project_revision<=?)
      AND NOT EXISTS (
        SELECT 1 FROM object_revisions newer JOIN changesets nc ON nc.id=newer.changeset_id
        WHERE newer.object_id=r.object_id AND newer.version>r.version
          AND nc.project_revision<=?
      )`;
}
/** json_each keeps exact primitive types and literal field keys without constructing JSON paths. */
function fieldFilter(fields: string, filter?: CoverageFilter): SQL {
  if (!filter) return { text: "1=1", values: [] };
  const types =
    typeof filter.equals === "number"
      ? ["integer", "real"]
      : [typeof filter.equals === "boolean" ? String(filter.equals) : "text"];
  const value = typeof filter.equals === "boolean" ? Number(filter.equals) : filter.equals;
  return {
    text: `EXISTS (SELECT 1 FROM json_each(${fields}) field
      WHERE field.key=? AND field.type IN (${types.map(() => "?").join(",")})
        AND field.atom=? COLLATE BINARY)`,
    values: [filter.field, ...types, value],
  };
}
function subjectPage(db: DatabaseSync, query: CoverageNativeQuery) {
  const native = nativeTables(query.atRevision);
  const filter = fieldFilter("subject.fields", query.expectation.subject.filter);
  const after = query.after === undefined ? "" : "AND subject.id>? COLLATE BINARY";
  const rows = db
    .prepare(
      `WITH ${native.text}
      SELECT subject.* FROM native_entities subject
      WHERE subject.type=? AND ${filter.text} ${after}
      ORDER BY subject.id COLLATE BINARY LIMIT ?`,
    )
    .all(
      ...native.values,
      query.expectation.subject.type,
      ...filter.values,
      ...(query.after === undefined ? [] : [query.after]),
      query.limit + 1,
    );
  return page(rows, query.limit, (row) => String(row.id));
}
function coverageRows(db: DatabaseSync, query: CoverageNativeQuery, subjects: Row[]) {
  const native = nativeTables(query.atRevision);
  const filter = fieldFilter("related.fields", query.expectation.related.filter);
  const outgoing = query.expectation.direction === "outgoing";
  const subjectEndpoint = outgoing ? "source" : "target";
  const relatedEndpoint = outgoing ? "target" : "source";
  return db
    .prepare(
      `WITH ${native.text},
    selected(id) AS (VALUES ${subjects.map(() => "(?)").join(",")}),
    incident AS MATERIALIZED (
      SELECT subject.id AS subject_id,link.id AS link_id,link.${relatedEndpoint} AS related_id
      FROM selected subject CROSS JOIN native_links link
      WHERE link.${subjectEndpoint}=subject.id AND link.type=?
    ), resolved AS MATERIALIZED (
      SELECT incident.*,related.id AS resolved_id,
        CASE WHEN related.type=? AND ${filter.text} THEN 1 ELSE 0 END AS qualifies
      FROM incident LEFT JOIN native_entities related ON related.id=incident.related_id
    ), targets AS MATERIALIZED (
      SELECT subject_id,related_id,COUNT(*) AS link_count,MIN(link_id) AS link_id
      FROM resolved WHERE qualifies=1 GROUP BY subject_id,related_id
    ), totals AS (
      SELECT subject_id,COUNT(*) AS target_count,SUM(link_count) AS relationship_count
      FROM targets GROUP BY subject_id
    ), unknowns AS (
      SELECT subject_id,SUM(resolved_id IS NULL) AS unresolved_count
      FROM resolved GROUP BY subject_id
    ), ranked AS (
      SELECT targets.*,ROW_NUMBER() OVER (
        PARTITION BY subject_id ORDER BY related_id COLLATE BINARY
      ) AS sample_rank FROM targets
    )
    SELECT subject.id AS subject_id,
      COALESCE(totals.target_count,0) AS target_count,
      COALESCE(totals.relationship_count,0) AS relationship_count,
      COALESCE(unknowns.unresolved_count,0) AS unresolved_count,
      related.id AS related_id,related.type AS related_type,
      related.human_key AS related_key,related.version AS related_version,
      related.fields AS related_fields,
      representative.id AS link_id,representative.type AS link_type,
      representative.source AS link_source,representative.target AS link_target,
      representative.version AS link_version,representative.fields AS link_fields
    FROM selected subject LEFT JOIN totals ON totals.subject_id=subject.id
      LEFT JOIN unknowns ON unknowns.subject_id=subject.id
      LEFT JOIN ranked ON ranked.subject_id=subject.id AND ranked.sample_rank<=3
      LEFT JOIN native_entities related ON related.id=ranked.related_id
      LEFT JOIN native_links representative ON representative.id=ranked.link_id
    ORDER BY subject.id COLLATE BINARY,ranked.related_id COLLATE BINARY
  `,
    )
    .all(
      ...native.values,
      ...subjects.map((subject) => String(subject.id)),
      query.expectation.relationshipType,
      query.expectation.related.type,
      ...filter.values,
    );
}
function entity(row: Row, prefix = ""): Entity {
  const key = row[prefix ? `${prefix}key` : "human_key"];
  return {
    id: String(row[`${prefix}id`]),
    type: String(row[`${prefix}type`]),
    version: Number(row[`${prefix}version`]),
    ...(key === null ? {} : { key: String(key) }),
    fields: JSON.parse(String(row[`${prefix}fields`])),
  };
}
function relationship(row: Row): Relationship {
  return {
    id: String(row.link_id),
    type: String(row.link_type),
    source: String(row.link_source),
    target: String(row.link_target),
    version: Number(row.link_version),
    fields: JSON.parse(String(row.link_fields)),
  };
}
function nativeRow(subject: Entity, row: Row): CoverageNativeRow {
  const unresolved = Number(row.unresolved_count);
  return {
    subject,
    distinctTargets: unresolved ? null : Number(row.target_count),
    matchingRelationships: unresolved ? null : Number(row.relationship_count),
    samples: [],
    samplesComplete: unresolved === 0 && Number(row.target_count) <= 3,
    unresolvedRelationships: unresolved,
  };
}
export function coverageTransaction(
  db: DatabaseSync,
  check: () => void,
): Pick<Transaction, "coveragePage"> {
  return {
    coveragePage: async (query) => {
      check();
      ensure(
        Number.isSafeInteger(query.limit) && query.limit > 0 && query.limit <= 100,
        "validation",
        "Coverage subject page limit must be 1–100",
      );
      const subjects = subjectPage(db, query);
      if (!subjects.items.length) return { ...subjects, items: [] };
      const summaries = new Map<string, CoverageNativeRow>();
      const byId = new Map(subjects.items.map((row) => [String(row.id), entity(row)]));
      for (const row of coverageRows(db, query, subjects.items)) {
        const id = String(row.subject_id);
        let summary = summaries.get(id);
        if (!summary) {
          summary = nativeRow(byId.get(id)!, row);
          summaries.set(id, summary);
        }
        if (row.related_id !== null)
          summary.samples.push({
            related: entity(row, "related_"),
            relationship: relationship(row),
          });
      }
      return { ...subjects, items: [...summaries.values()] };
    },
  };
}
