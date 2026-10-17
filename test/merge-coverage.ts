import { mergeProcessCovs } from "@bcoe/v8-coverage";
import coverage from "istanbul-lib-coverage";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const measured = coverage.createCoverageMap({});
const directory = resolve(".fallow/coverage");
measured.merge(JSON.parse(readFileSync(join(directory, "unit/coverage-final.json"), "utf8")));
const browser = join(directory, "browser");
const files = readdirSync(browser).filter((name) => name.endsWith(".json"));
if (!files.length) throw new Error("Run the browser workflows before the quality gate.");
for (const file of files) measured.merge(JSON.parse(readFileSync(join(browser, file), "utf8")));
writeFileSync(join(directory, "coverage-final.json"), JSON.stringify(measured.toJSON()));

// Merge measured V8 ranges before consumption: separate processes can contain
// zero-count versions of a handler exercised in another process.
const captures = readdirSync(join(directory, "captures"))
  .filter((name) => name.endsWith(".json"))
  .map((name) => JSON.parse(readFileSync(join(directory, "captures", name), "utf8")));
const raw = {
  ...mergeProcessCovs(captures),
  "source-map-cache": Object.assign({}, ...captures.map((capture) => capture["source-map-cache"])),
};
mkdirSync(join(directory, "raw"), { recursive: true });
writeFileSync(join(directory, "raw/coverage.json"), JSON.stringify(raw));
