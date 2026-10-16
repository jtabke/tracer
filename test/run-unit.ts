import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const coverage = resolve(".fallow/coverage");
rmSync(coverage, { recursive: true, force: true });
mkdirSync(coverage, { recursive: true });
const files = [
  ...readdirSync("test")
    .filter((name) => name.endsWith(".test.ts"))
    .map((name) => `test/${name}`),
  ...readdirSync("test/map")
    .filter((name) => name.endsWith(".test.mjs"))
    .map((name) => `test/map/${name}`),
];
const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/c8/bin/c8.js"),
    "--reporter=json",
    "--reports-dir=.fallow/coverage/unit",
    "--temp-directory=.fallow/coverage/raw",
    "--include=src/**",
    "--include=ui/**",
    "--include=test/**",
    "--include=examples/**",
    "--exclude=node_modules/**",
    "--exclude=output/**",
    process.execPath,
    "--test",
    ...files,
  ],
  {
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
