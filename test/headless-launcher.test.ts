import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "../src/client.ts";

test(
  "headless launcher starts outside the checkout without dist and prints a headless resume command",
  { timeout: 15000 },
  async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-headless-launch-"));
    const child = spawn(
      process.execPath,
      [
        "--import",
        "data:text/javascript," +
          encodeURIComponent(`
            import { registerHooks } from 'node:module';
            registerHooks({ resolve(specifier, context, next) {
              const result = next(specifier, context);
              if (result.url.includes('/examples/') || result.url.includes('/ui/'))
                throw new Error('Headless startup imported frontend/demo code: ' + result.url);
              return result;
            }});
          `),
        resolve("src/interfaces/serve.ts"),
        "--headless",
        "--db",
        "project.sqlite",
        "--port",
        "0",
      ],
      { cwd: directory, stdio: ["ignore", "pipe", "pipe"] },
    );
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        await once(child, "exit");
      }
      rmSync(directory, { recursive: true, force: true });
    });
    let output = "";
    let errors = "";
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      errors += chunk;
    });
    const origin = await new Promise<string>((resolveOrigin, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => reject(new Error(`Launcher exited ${code}: ${errors}`)));
      child.stdout.setEncoding("utf8").on("data", (chunk) => {
        output += chunk;
        const match = /Tracer: (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
        if (match) resolveOrigin(match[1]);
      });
    });
    assert.match(output, /Resume saved setup: npm run serve:api -- --db/);
    const client = createClient({ baseUrl: origin });
    await client.connect();
    assert.equal(await client.read("/api/schema", {}), null);
    await client.write("/api/schema", {
      schema: { entityTypes: {}, relationshipTypes: {} },
      expectedVersion: 0,
    });
    assert.equal((await client.read("/api/history", {})).items[0].kind, "schema");
    assert.equal((await client.read("/api/timeline", {})).items[0].actor, "local-api");
    assert.equal((await fetch(origin + "/")).status, 404);
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    assert.deepEqual(await exited, [0, null]);
    assert.equal(errors.includes("Error"), false, errors);
  },
);

test("explicit demo selection still creates an isolated resumable empty project", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-lazy-demo-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const { seedDemo } = await import("../examples/seed-demo.ts");
  const { SQLiteRepository } = await import("../src/persistence/sqlite.ts");
  const { Tracer } = await import("../src/application/service.ts");
  const project = await seedDemo(join(directory, "empty"), "empty");
  const repository = new SQLiteRepository(project.database);
  try {
    assert.equal(await new Tracer(repository).getSchema(), undefined);
  } finally {
    repository.close();
  }
  await assert.rejects(seedDemo(join(directory, "empty"), "empty"), { code: "EEXIST" });
  await assert.rejects(seedDemo(join(directory, "invalid"), "invalid"), /Unknown demo size/);
  assert.equal(existsSync(join(directory, "invalid")), false);
});

test("launcher releases acquired repositories after secondary-open or server-start failure", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-launch-cleanup-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const instrument =
    "data:text/javascript," +
    encodeURIComponent(`
    import { SQLiteRepository } from ${JSON.stringify(pathToFileURL(resolve("src/persistence/sqlite.ts")).href)};
    const close = SQLiteRepository.prototype.close;
    SQLiteRepository.prototype.close = function () {
      close.call(this);
      console.log('repository-closed');
    };
  `);
  for (const [args, expectedCloses] of [
    [["--headless", "--secondary-db", "missing/other.sqlite"], 1],
    // Browser startup fails because this disposable directory has no dist assets.
    [["--secondary-db", "other.sqlite"], 2],
  ] as const) {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        instrument,
        resolve("src/interfaces/serve.ts"),
        "--db",
        "project.sqlite",
        "--port",
        "0",
        ...args,
      ],
      { cwd: directory, encoding: "utf8", timeout: 10000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout.split("repository-closed").length - 1, expectedCloses);
  }
});

test("launcher validates ports and guide files before creating any database", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-launch-validation-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const args of [
    ["--port", "NaN"],
    ["--port", "-1"],
    ["--port", "65536"],
    ["--port", "1.5"],
    ["--secondary-db", "other.sqlite", "--secondary-guide", "missing.json"],
  ]) {
    const result = spawnSync(
      process.execPath,
      [resolve("src/interfaces/serve.ts"), "--headless", "--db", "project.sqlite", ...args],
      { cwd: directory, encoding: "utf8", timeout: 10000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(existsSync(join(directory, "project.sqlite")), false);
    assert.equal(existsSync(join(directory, "other.sqlite")), false);
  }
});
