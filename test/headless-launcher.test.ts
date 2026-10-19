import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "../src/client.ts";

test(
  "headless launcher starts outside the checkout without dist and prints a headless resume command",
  { timeout: 15000 },
  async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-headless-launch-"));
    const child = spawn(
      process.execPath,
      [resolve("src/interfaces/serve.ts"), "--headless", "--db", "project.sqlite", "--port", "0"],
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
  },
);
