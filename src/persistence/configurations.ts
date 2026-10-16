import type { DatabaseSync } from "node:sqlite";
import type { Transaction } from "./contracts.ts";
import type { Configuration } from "../core/configuration.ts";
import { jsonPage } from "./pages.ts";

export function configurationTransaction(
  db: DatabaseSync,
  check: () => void,
): Pick<Transaction, "getConfiguration" | "configurations" | "appendConfiguration"> {
  return {
    getConfiguration: async (id) => {
      check();
      const row = db.prepare("SELECT payload_json FROM configurations WHERE id=?").get(id);
      return row ? JSON.parse(String(row.payload_json)) : undefined;
    },
    configurations: async (query) => {
      check();
      const limit = query.limit ?? 25;
      const rows = db
        .prepare(
          "SELECT sequence,payload_json FROM configurations WHERE (? IS NULL OR subject_id=?) AND sequence>? ORDER BY sequence LIMIT ?",
        )
        .all(query.subject ?? null, query.subject ?? null, Number(query.after ?? 0), limit + 1);
      return jsonPage<Configuration>(rows, limit);
    },
    appendConfiguration: async (value) => {
      check();
      db.prepare("INSERT INTO configurations(id,subject_id,payload_json) VALUES (?,?,?)").run(
        value.id,
        value.subject.id,
        JSON.stringify(value),
      );
    },
  };
}
