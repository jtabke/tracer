import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedRealisticProject } from "../../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../../src/persistence/sqlite.ts";
import { projectWorkspace } from "./workspace-snapshot.ts";
import { Tracer } from "../../src/application/service.ts";

// Export a fresh disposable native example. Never open an owner database.
const directory = mkdtempSync(join(tmpdir(), "tracer-identity-history-"));
let repository;
try {
  const seeded = await seedRealisticProject(join(directory, "aster"), "medical");
  repository = new SQLiteRepository(seeded.database);
  const tracer = new Tracer(repository);
  const snapshot = await tracer.getProjectSnapshot();
  const revisions = [];
  let after;
  do {
    const page = await tracer.history({ after, limit: 1000 });
    revisions.push(...page.items);
    after = page.nextAfter;
  } while (after);
  const changesets = [];
  let cursor = 0;
  while (true) {
    const page = await tracer.changesets(cursor, 1000);
    changesets.push(...page);
    if (page.length < 1000) break;
    cursor = page.at(-1).projectRevision;
  }
  const data = {
    source: "../../examples/seed-realistic-project.ts",
    provenance:
      "Disposable fictional Aster export; fixture timestamps are not real engineering activity.",
    ...projectWorkspace(snapshot, revisions, changesets),
  };
  writeFileSync(new URL("./data.json", import.meta.url), JSON.stringify(data, null, 2) + "\n");
  console.log(
    `${data.entities.length} native records / ${data.relationships.length} native links / r${snapshot.projectRevision}; ${revisions.length} object revisions / ${changesets.length} changesets`,
  );
} finally {
  repository?.close();
  rmSync(directory, { recursive: true, force: true });
}
