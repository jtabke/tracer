import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { repositoryContract } from "./repository-contract.ts";

repositoryContract("SQLite", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-repository-contract-"));
  const database = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(database);
  return {
    get repository() {
      return repository;
    },
    async reopen() {
      repository.close();
      repository = new SQLiteRepository(database);
      return repository;
    },
    dispose() {
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
});
