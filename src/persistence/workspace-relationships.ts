import type { DatabaseSync } from "node:sqlite";
import { ensure, type Relationship } from "../core/model.ts";
import { decodeRelationship } from "./native-codec.ts";
import { page } from "./pages.ts";

/** Walk the immutable creation log, not UUID order. The same cursor works when a page
 * that was current becomes historical. Resolve the version before filtering its type. */
export function orderedRelationships(
  db: DatabaseSync,
  at: number | undefined,
  query: { after?: string; type?: string; limit: number },
) {
  const cursor = query.after ?? "0:0";
  const [start, ordinal] = cursor.split(":").map(Number);
  ensure(
    /^\d+:\d+$/.test(cursor) && Number.isSafeInteger(start) && Number.isSafeInteger(ordinal),
    "validation",
    "Invalid workspace connection cursor",
  );
  const current = at === undefined;
  const join = current
    ? "CROSS JOIN relationships link ON link.id=birth.object_id"
    : `CROSS JOIN object_revisions link ON link.rowid=(
    SELECT v.rowid FROM object_revisions v JOIN changesets vc ON vc.id=v.changeset_id
    WHERE v.object_id=birth.object_id AND vc.project_revision<=? ORDER BY v.version DESC LIMIT 1
  )`;
  const type = current ? "link.type" : "json_extract(link.snapshot_json,'$.type')";
  const rows = db
    .prepare(
      `
    SELECT c.project_revision,birth.ordinal,${current ? "link.*" : "link.snapshot_json"}
    FROM changesets c CROSS JOIN object_revisions birth ON birth.changeset_id=c.id
    ${join}
    WHERE c.project_revision>=? AND (c.project_revision>? OR birth.ordinal>?)
      AND birth.version=1 AND birth.kind='relationship'
      ${current ? "" : "AND c.project_revision<=? AND link.snapshot_json IS NOT NULL"}
      ${query.type === undefined ? "" : `AND ${type}=?`}
    ORDER BY c.project_revision,birth.ordinal LIMIT ?
  `,
    )
    .all(
      ...(current ? [] : [at!]),
      start,
      start,
      ordinal,
      ...(current ? [] : [at!]),
      ...(query.type === undefined ? [] : [query.type]),
      query.limit + 1,
    );
  const result = page(rows, query.limit, (row) => `${row.project_revision}:${row.ordinal}`);
  return {
    ...result,
    items: result.items.map((row) =>
      current ? decodeRelationship(row) : (JSON.parse(String(row.snapshot_json)) as Relationship),
    ),
  };
}
