import { lstatSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--dry-run"))
  throw new Error("Usage: npm run clean -- [--dry-run]");
if (lstatSync(resolve(root, ".fallow"), { throwIfNoEntry: false })?.isSymbolicLink())
  throw new Error("Refusing cleanup through a symbolic-link .fallow directory");

// Explicit generated outputs only. Keep projects, backups, output evidence,
// dependency installs and historical baseline/source snapshots intact.
const generated = [
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
  ".fallow/coverage",
  ".fallow/workbench-static",
  ".fallow/cache.bin",
  ".fallow/churn.bin",
  ".fallow/graph-cache.bin",
  "test/workbench/data.json",
  ".DS_Store",
];
let count = 0;
for (const path of generated) {
  const target = resolve(root, path);
  if (!lstatSync(target, { throwIfNoEntry: false })) continue;
  if (!args.length) rmSync(target, { recursive: true, force: true });
  console.log(`${args.length ? "Would remove" : "Removed"} ${path}`);
  count++;
}
if (!count) console.log("No generated artifacts to remove.");
