import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { repositoryContract } from "./repository-contract.ts";

repositoryContract("SQLite", async () => {
  const repository = new SQLiteRepository(":memory:");
  return { repository, dispose: () => repository.close() };
});
