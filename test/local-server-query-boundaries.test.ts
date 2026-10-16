import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

test("HTTP exact-resource guards retain distinct errors and query parsing stays local to the selected route", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-query-guards-"));
  writeFileSync(
    join(directory, "index.html"),
    "<!doctype html><title>Isolated query fixture</title>",
  );
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  const history = await tracer.history();
  const server = await startLocalServer(tracer, directory, 0);
  const error = async (path: string, code: string, message: string, status = 400) => {
    const response = await fetch(server.origin + path);
    assert.equal(response.status, status, path);
    assert.deepEqual(await response.json(), { error: code, message }, path);
  };
  try {
    const exact = [
      ["configuration", "id", "validation", "Configuration requires id"],
      ["baseline", "id", "validation", "Baseline requires id"],
      ["receipt", "receiptId", "usage", "Receipt requires receiptId"],
      ["comparison", "receiptId", "usage", "Comparison requires receiptId"],
    ];
    for (const [route, key, code, message] of exact)
      for (const suffix of ["", `?${key}=x&${key}=y`, `?${key}=x&extra=y`, "?wrong=x"])
        await error(`/api/${route}${suffix}`, code, message);
    await error("/api/configuration?id=", "validation", "Configuration ID is required");
    await error(
      "/api/native-pin?id=x&version=1&version=2",
      "validation",
      "Native revision requires an id and positive exact version",
    );
    for (const path of [
      "/api/graph?depth=1&depth=2",
      "/api/timeline?before=1&before=2",
      "/api/chain?steps=broken&steps=also-broken",
    ])
      await error(path, "usage", "Duplicate query parameter");
    await error("/api/timeline?unexpected=1", "usage", "Invalid timeline query");
    await error("/api/chain?type=item", "usage", "Chain needs column steps");
    await error("/api/chain?type=item&steps=broken", "usage", "Invalid chain steps JSON");
    await error("/api/saved-views?x=a&x=b", "usage", "Saved views accept no filters");
    await error("/api/demo-guide?x=a&x=b", "usage", "Demo guide accepts no filters");
    await error("/api/unknown?x=a&x=b", "not_found", "Unknown query endpoint", 404);
    const ignored = "?x=a&x=b";
    const schemaRead = await fetch(server.origin + "/api/schema" + ignored);
    assert.equal(schemaRead.status, 200);
    assert.equal(await schemaRead.json(), null);
    const session = await fetch(server.origin + "/api/session" + ignored);
    assert.equal(session.status, 200);
    assert.match((await session.json()).token, /^[0-9a-f-]{36}$/);
    const asset = await fetch(server.origin + "/" + ignored);
    assert.equal(asset.status, 200);
    assert.match(await asset.text(), /Isolated query fixture/);
    assert.deepEqual(await tracer.history(), history);
  } finally {
    await server.close();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
