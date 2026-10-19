import type { DatabaseSync } from "node:sqlite";
import { ensure } from "../core/model.ts";
import type { Transaction } from "../application/ports/repository.ts";
import type { SavedView } from "../core/presentation.ts";

export function workspaceViewTransaction(
  db: DatabaseSync,
  check: () => void,
): Pick<Transaction, "getView" | "listViews" | "saveView" | "removeView"> {
  const decode = (row: Record<string, unknown>): SavedView => ({
    id: String(row.id),
    name: String(row.name),
    version: Number(row.version),
    definition: JSON.parse(String(row.definition_json)),
  });
  return {
    getView: async (id) => {
      check();
      const row = db.prepare("SELECT * FROM workspace_views WHERE id=?").get(id);
      return row ? decode(row) : undefined;
    },
    listViews: async () => {
      check();
      return db
        .prepare("SELECT * FROM workspace_views ORDER BY name COLLATE BINARY,id LIMIT 51")
        .all()
        .map(decode);
    },
    saveView: async (view, expectedVersion) => {
      check();
      ensure(
        view.version === expectedVersion + 1,
        "conflict",
        "Saved view versions advance by one",
      );
      if (expectedVersion === 0)
        db.prepare("INSERT INTO workspace_views VALUES (?,?,?,?)").run(
          view.id,
          view.name,
          view.version,
          JSON.stringify(view.definition),
        );
      else {
        const result = db
          .prepare(
            "UPDATE workspace_views SET name=?,version=?,definition_json=? WHERE id=? AND version=?",
          )
          .run(view.name, view.version, JSON.stringify(view.definition), view.id, expectedVersion);
        ensure(result.changes === 1, "conflict", "Saved view changed or was removed");
      }
    },
    removeView: async (id, expectedVersion) => {
      check();
      const result = db
        .prepare("DELETE FROM workspace_views WHERE id=? AND version=?")
        .run(id, expectedVersion);
      ensure(result.changes === 1, "conflict", "Saved view changed or was removed");
    },
  };
}
