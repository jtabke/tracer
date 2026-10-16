import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { Entity, Relationship } from "../core/model.ts";
import { ensure } from "../core/model.ts";
import type {
  Transaction,
  WorkingRouteNativeQuery,
  WorkingReceiptNativeQuery,
  WorkingPathNative,
  WorkingReceiptCandidate,
} from "./contracts.ts";
import { page } from "./pages.ts";

type Step = WorkingRouteNativeQuery["steps"][number];
function endpoints(step: Step) {
  return step.direction === "incoming"
    ? ["target_entity_id", "source_entity_id"]
    : ["source_entity_id", "target_entity_id"];
}
function routeSql(query: WorkingRouteNativeQuery) {
  const ctes = ["s0(id) AS (SELECT id FROM entities WHERE id=?)"];
  const values: SQLInputValue[] = [query.focusId];
  query.steps.forEach((step, index) => {
    const [source, target] = endpoints(step);
    ctes.push(`s${index + 1}(id) AS (SELECT DISTINCT r.${target}
      FROM s${index} p JOIN relationships r ON r.${source}=p.id AND r.type=?
      JOIN entities e ON e.id=r.${target} AND e.type=?)`);
    values.push(step.relationshipType, step.type);
  });
  return { with: "WITH " + ctes.join(","), terminal: `s${query.steps.length}`, values };
}
function decodeEntity(row: Record<string, unknown>): Entity {
  return {
    id: String(row.id),
    version: Number(row.version),
    type: String(row.type),
    ...(row.human_key === null ? {} : { key: String(row.human_key) }),
    fields: JSON.parse(String(row.attributes_json)),
  };
}
function decodeLink(row: Record<string, unknown>): Relationship {
  return {
    id: String(row.id),
    version: Number(row.version),
    type: String(row.type),
    source: String(row.source_entity_id),
    target: String(row.target_entity_id),
    fields: JSON.parse(String(row.attributes_json)),
  };
}
function predecessor(
  db: DatabaseSync,
  query: WorkingRouteNativeQuery,
  index: number,
  endpoint: string,
) {
  const step = query.steps[index],
    [source, target] = endpoints(step);
  const prefix = routeSql({ ...query, steps: query.steps.slice(0, index) });
  const row = db
    .prepare(
      `${prefix.with}
    SELECT r.* FROM ${prefix.terminal} p JOIN relationships r
      ON r.${source}=p.id AND r.type=?
      JOIN entities e ON e.id=r.${target} AND e.type=?
    WHERE r.${target}=? ORDER BY r.id COLLATE BINARY LIMIT 1`,
    )
    .get(...prefix.values, step.relationshipType, step.type, endpoint);
  ensure(row, "referential_integrity", "Ordered route predecessor is unavailable");
  return decodeLink(row);
}
function selectedPath(
  db: DatabaseSync,
  query: WorkingRouteNativeQuery,
  entity: Entity,
): WorkingPathNative {
  const nodes = [entity],
    links: Relationship[] = [];
  for (let index = query.steps.length - 1; index >= 0; index--) {
    const link = predecessor(db, query, index, nodes[0].id);
    const id = query.steps[index].direction === "incoming" ? link.target : link.source;
    const row = db.prepare("SELECT * FROM entities WHERE id=?").get(id);
    ensure(row, "referential_integrity", "Ordered route endpoint is unavailable");
    links.unshift(link);
    nodes.unshift(decodeEntity(row));
  }
  return { entity, nodes, links };
}
function routeCount(db: DatabaseSync, sql: ReturnType<typeof routeSql>) {
  return Number(
    db.prepare(`${sql.with} SELECT COUNT(*) AS count FROM ${sql.terminal}`).get(...sql.values)!
      .count,
  );
}
function routeSelection(db: DatabaseSync, query: WorkingRouteNativeQuery, entity: boolean) {
  validateEndpoints(db, query);
  const sql = routeSql(query);
  const selection = entity
    ? `e.* FROM ${sql.terminal} p JOIN entities e ON e.id=p.id`
    : `p.id FROM ${sql.terminal} p`;
  const rows = db
    .prepare(
      `${sql.with} SELECT ${selection} WHERE p.id>? COLLATE BINARY ORDER BY p.id COLLATE BINARY LIMIT ?`,
    )
    .all(...sql.values, query.after ?? "", query.limit + 1);
  return { total: routeCount(db, sql), rows };
}
function routePage(db: DatabaseSync, query: WorkingRouteNativeQuery) {
  const { total, rows } = routeSelection(db, query, true);
  const selected = rows.slice(0, query.limit).map(decodeEntity);
  return {
    total,
    items: selected.map((entity) => selectedPath(db, query, entity)),
    ...(rows.length > query.limit ? { nextAfter: selected.at(-1)!.id } : {}),
  };
}
function routeIds(db: DatabaseSync, query: WorkingRouteNativeQuery) {
  const { total, rows } = routeSelection(db, query, false);
  const ids = rows.slice(0, query.limit).map((row) => String(row.id));
  return { total, ids, ...(rows.length > query.limit ? { nextAfter: ids.at(-1)! } : {}) };
}
function membershipPage(db: DatabaseSync, query: Parameters<Transaction["workingMembership"]>[0]) {
  const [source, target] = endpoints(query.step);
  const rows = db
    .prepare(
      `SELECT * FROM relationships
    WHERE ${source}=? AND type=? AND ${target} IN (SELECT value FROM json_each(?))
    ORDER BY id COLLATE BINARY LIMIT ?`,
    )
    .all(
      query.focusId,
      query.step.relationshipType,
      JSON.stringify(query.memberIds),
      query.limit + 1,
    );
  const items = rows.slice(0, query.limit).map(decodeLink);
  return { items, ...(rows.length > query.limit ? { nextAfter: items.at(-1)!.id } : {}) };
}
function validateEndpoints(db: DatabaseSync, query: WorkingRouteNativeQuery) {
  query.steps.forEach((step, index) => {
    const prefix = routeSql({ ...query, steps: query.steps.slice(0, index) });
    const [source, target] = endpoints(step);
    const missing = db
      .prepare(
        `${prefix.with} SELECT 1 FROM ${prefix.terminal} p
      JOIN relationships r ON r.${source}=p.id AND r.type=?
      LEFT JOIN entities e ON e.id=r.${target}
      WHERE e.id IS NULL LIMIT 1`,
      )
      .get(...prefix.values, step.relationshipType);
    ensure(!missing, "referential_integrity", "Ordered route contains an unavailable endpoint");
  });
}
function receiptSql(query: WorkingReceiptNativeQuery) {
  return {
    with: `WITH selected AS (
      SELECT sequence AS receipt_sequence FROM evidence WHERE kind='receipt'
        AND subject_id IN (SELECT value FROM json_each(?))
      UNION
      SELECT receipt_sequence FROM receipt_dependencies WHERE dependency_kind='entity'
        AND object_id IN (SELECT value FROM json_each(?))
      UNION
      SELECT receipt_sequence FROM receipt_dependencies WHERE dependency_kind='relationship'
        AND object_id IN (SELECT value FROM json_each(?))
    )`,
    values: [
      JSON.stringify(query.outputIds),
      JSON.stringify(query.inputIds),
      JSON.stringify(query.relationshipIds),
    ],
  };
}
function receiptPage(db: DatabaseSync, query: WorkingReceiptNativeQuery) {
  const sql = receiptSql(query);
  const total = Number(
    db.prepare(`${sql.with} SELECT COUNT(*) AS count FROM selected`).get(...sql.values)!.count,
  );
  const rows = db
    .prepare(
      `${sql.with} SELECT e.sequence,
    json_remove(e.payload_json,'$.inputs','$.schema') AS header_json,
    json_array_length(e.payload_json,'$.inputs') AS input_count,
    (SELECT json_group_array(json_object('entityId',json_extract(i.value,'$.entityId'),
       'capturedVersion',json_extract(i.value,'$.entity.version')))
     FROM json_each(e.payload_json,'$.inputs') i
     WHERE json_extract(i.value,'$.entityId') IN (SELECT value FROM json_each(?))) AS facts_json
    FROM selected CROSS JOIN evidence e
    WHERE e.sequence=selected.receipt_sequence AND e.sequence>?
    ORDER BY e.sequence LIMIT ?`,
    )
    .all(...sql.values, JSON.stringify(query.inputIds), Number(query.after ?? 0), query.limit + 1);
  const selected = page(rows, query.limit, (row) => String(row.sequence));
  return { ...selected, items: selected.items.map(decodeReceiptCandidate), total };
}
function decodeReceiptCandidate(row: Record<string, unknown>): WorkingReceiptCandidate {
  return {
    receipt: JSON.parse(String(row.header_json)),
    inputCount: Number(row.input_count),
    inputs: JSON.parse(String(row.facts_json)),
  };
}
/** Existing native endpoint and receipt-dependency indexes; no census or payload scan. */
export function workingContextTransaction(
  db: DatabaseSync,
  check: () => void,
): Pick<Transaction, "workingRoute" | "workingReceipts" | "workingRouteIds" | "workingMembership"> {
  return {
    workingRoute: async (query) => {
      check();
      return routePage(db, query);
    },
    workingReceipts: async (query) => {
      check();
      return receiptPage(db, query);
    },
    workingRouteIds: async (query) => {
      check();
      return routeIds(db, query);
    },
    workingMembership: async (query) => {
      check();
      return membershipPage(db, query);
    },
  };
}
