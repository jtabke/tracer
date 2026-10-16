import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";

test("documented headless examples run without a server and reopen their saved model", async () => {
  const example = spawnSync(process.execPath, ["examples/product-model.ts"], { encoding: "utf8" });
  assert.equal(example.status, 0, example.stderr);
  assert.match(example.stdout, /3 items, 2 links, version conflict, trace and database reopen/);
  const guide = readFileSync("docs/developer-reference.md", "utf8");
  const snippet = guide.match(/```ts\n([\s\S]*?)\n```/)?.[1];
  assert.ok(snippet, "Core quickstart must remain a runnable TypeScript code block");
  const directory = mkdtempSync(join(tmpdir(), "tracer-core-quickstart-"));
  const database = join(directory, "project.sqlite");
  try {
    const source = snippet
      .replace(/"(\.\/(?:src|examples)\/[^"\n]+)"/g, (_, path: string) =>
        JSON.stringify(pathToFileURL(resolve(path)).href),
      )
      .replace('"desk-light-api.sqlite"', JSON.stringify(database));
    const result = spawnSync(process.execPath, ["--input-type=module"], {
      input: source,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const repository = new SQLiteRepository(database);
    try {
      const snapshot = await new Tracer(repository).getProjectSnapshot();
      assert.equal(snapshot.entities.length, 2);
      assert.equal(snapshot.relationships.length, 1);
      const link = snapshot.relationships[0];
      assert.equal(link.type, "has_requirement");
      assert.equal(snapshot.entities.find((item) => item.id === link.source)?.key, "PROD-001");
      assert.equal(snapshot.entities.find((item) => item.id === link.target)?.key, "REQ-001");
    } finally {
      repository.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
