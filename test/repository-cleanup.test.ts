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
    ".local/tracer-development/tracer.sqlite",
    ".local/tracer-development/backups/saved.sqlite",
    "output/checks.log",
    ".fallow/session-baseline-source/original.ts",
    "node_modules/installed.js",
  ];
  const generated = [
    "dist/build.js",
    ".fallow/coverage/raw.json",
    "test-results/report.json",
    "test/workbench/data.json",
  ];
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

test("experiments stay ignored while maintained source and selected documentation images remain publishable", () => {
  const ignored = [
    "studies/layout/index.html",
    "experiments/proposal/report.json",
    "output/repo-cleanup-studies/archive/manifest.json",
    "docs/ux-artifacts/new-study/concept.png",
    "test/workbench/data.json",
    ".local/tracer-development/project-export.json",
  ];
  const maintained = [
    "README.md",
    "docs/images/change-assessments-workspace-desktop.png",
    "docs/development/archive.md",
    "test/workbench/check-workbench.mjs",
    "test/map/fixtures/fixture.json",
    "scripts/register.mjs",
  ];
  const result = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], {
    input: [...ignored, ...maintained].join("\n") + "\n",
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split("\n"), ignored);
});

test("a fresh clone cannot silently reseed a missing private development register", (t) => {
  const root = mkdtempSync(join(tmpdir(), "tracer-private-register-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  const script = join(root, "scripts/register.mjs");
  copyFileSync(resolve("scripts/register.mjs"), script);
  symlinkSync(resolve("src"), join(root, "src"), "dir");
  const database = join(root, "must-not-create.sqlite");
  const init = spawnSync(process.execPath, [script, "--db", database, "init"], {
    encoding: "utf8",
  });
  assert.notEqual(init.status, 0);
  assert.match(init.stderr, /Private bootstrap is unavailable/);
  assert.equal(existsSync(database), false);
  const status = spawnSync(process.execPath, [script, "status"], { encoding: "utf8" });
  assert.notEqual(status.status, 0);
  assert.match(status.stderr, /Restore a backup/);
  assert.equal(existsSync(join(root, ".local/tracer-development/tracer.sqlite")), false);
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
