import coverage from "istanbul-lib-coverage";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const measured = coverage.createCoverageMap({});
const directory = resolve(".fallow/coverage");
measured.merge(JSON.parse(readFileSync(join(directory, "unit/coverage-final.json"), "utf8")));
const browser = join(directory, "browser");
const files = readdirSync(browser).filter((name) => name.endsWith(".json"));
if (!files.length) throw new Error("Run the browser workflows before the quality gate.");
for (const file of files) measured.merge(JSON.parse(readFileSync(join(browser, file), "utf8")));
writeFileSync(join(directory, "coverage-final.json"), JSON.stringify(measured.toJSON()));
