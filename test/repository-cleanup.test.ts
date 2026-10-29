import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

test("cleanup anchors to its repository and preserves data/evidence across preview and removal", (t) => {
  const root = mkdtempSync(join(tmpdir(), "tracer-cleanup-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  const script = join(root, "scripts/clean.mjs");
  copyFileSync(resolve("scripts/clean.mjs"), script);
  const retained = [
    "projects/tracer/tracer.sqlite",
    "projects/tracer/backups/saved.sqlite",
    "output/checks.log",
    ".fallow/session-baseline-source/original.ts",
    "node_modules/installed.js",
  ];
  const generated = ["dist/build.js", ".fallow/coverage/raw.json", "test-results/report.json"];
  for (const path of [...retained, ...generated]) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), path);
  }
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [script, ...args], { cwd: tmpdir(), encoding: "utf8" });
  assert.equal(run("--dry-run").status, 0);
  for (const path of generated) assert.ok(existsSync(join(root, path)));
  assert.notEqual(run("--unknown").status, 0);
  for (const path of generated) assert.ok(existsSync(join(root, path)));
  assert.equal(run().status, 0);
  for (const path of generated) assert.equal(existsSync(join(root, path)), false);
  for (const path of retained) assert.equal(readFileSync(join(root, path), "utf8"), path);
  assert.equal(run().status, 0);
});

test("cleanup unlinks generated symlinks and refuses a symlinked cache parent", (t) => {
  const root = mkdtempSync(join(tmpdir(), "tracer-cleanup-links-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "retained/coverage"), { recursive: true });
  writeFileSync(join(root, "retained/coverage/keep"), "saved");
  const script = join(root, "scripts/clean.mjs");
  copyFileSync(resolve("scripts/clean.mjs"), script);
  symlinkSync(join(root, "retained"), join(root, "dist"), "dir");
  const run = () => spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(run().status, 0);
  assert.equal(existsSync(join(root, "dist")), false);
  symlinkSync(join(root, "retained"), join(root, ".fallow"), "dir");
  mkdirSync(join(root, "dist"));
  assert.notEqual(run().status, 0);
  assert.ok(existsSync(join(root, "dist")));
  assert.equal(readFileSync(join(root, "retained/coverage/keep"), "utf8"), "saved");
});
