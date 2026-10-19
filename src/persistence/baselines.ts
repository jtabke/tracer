import type { DatabaseSync } from "node:sqlite";
import type { Transaction } from "../application/ports/repository.ts";
import type { Baseline } from "../core/baseline.ts";
import type { Stored } from "../core/model.ts";
import { jsonPage } from "./pages.ts";

export function baselineTransaction(
  db: DatabaseSync,
  check: () => void,
): Pick<Transaction, "getBaseline" | "baselines" | "appendBaseline" | "queryAt"> {
  return {
    getBaseline: async (id) => {
      check();
      const row = db.prepare("SELECT payload_json FROM baselines WHERE id=?").get(id);
      return row ? JSON.parse(String(row.payload_json)) : undefined;
    },
    baselines: async (query) => {
      check();
      const limit = query.limit ?? 25;
      const rows = db
        .prepare(
          "SELECT sequence,payload_json FROM baselines WHERE sequence>? ORDER BY sequence LIMIT ?",
        )
        .all(Number(query.after ?? 0), limit + 1);
      return jsonPage<Baseline>(rows, limit);
    },
    appendBaseline: async (value) => {
      check();
      db.prepare("INSERT INTO baselines(id,payload_json) VALUES (?,?)").run(
        value.id,
        JSON.stringify(value),
      );
    },
    queryAt: async (kind, revision, query) => {
      check();
      const limit = query.limit ?? 100;
      // Choose the final version at the complete commit BEFORE excluding tombstones.
      const rows = db
        .prepare(
          `
        SELECT r.object_id,r.snapshot_json FROM object_revisions r
        JOIN changesets c ON c.id=r.changeset_id
        WHERE r.kind=? AND c.project_revision<=? AND r.snapshot_json IS NOT NULL
          AND (? IS NULL OR r.object_id>? COLLATE BINARY)
          AND NOT EXISTS (
            SELECT 1 FROM object_revisions newer JOIN changesets nc ON nc.id=newer.changeset_id
            WHERE newer.object_id=r.object_id AND newer.version>r.version AND nc.project_revision<=?
          )
        ORDER BY r.object_id COLLATE BINARY LIMIT ?
      `,
        )
        .all(kind, revision, query.after ?? null, query.after ?? null, revision, limit + 1);
      return jsonPage<Stored>(rows, limit, "snapshot_json", "object_id");
    },
  };
}
