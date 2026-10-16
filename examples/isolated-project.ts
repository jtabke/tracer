import { mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";

/** Own only a newly created directory; never clean up a refused existing destination. */
export async function inNewProject<T>(
  destination: string,
  seed: (tracer: Tracer, paths: { directory: string; database: string }) => Promise<T>,
): Promise<T> {
  const directory = resolve(destination);
  mkdirSync(directory);
  let repository: SQLiteRepository | undefined;
  try {
    const database = join(directory, "project.sqlite");
    repository = new SQLiteRepository(database);
    return await seed(new Tracer(repository), { directory, database });
  } catch (error) {
    repository?.close();
    repository = undefined;
    rmSync(directory, { recursive: true, force: true });
    throw error;
  } finally {
    repository?.close();
  }
}
