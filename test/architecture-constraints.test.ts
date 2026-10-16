import test from "node:test";
import assert from "node:assert/strict";
import { builtinModules } from "node:module";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, "").split("/")[0]));
function platformImports(source: string) {
  return ts
    .preProcessFile(source, true, true)
    .importedFiles.map((item) => item.fileName)
    .filter((name) => name.startsWith("node:") || builtins.has(name.split("/")[0]));
}
test("domain and application modules cannot depend on Node, including type and dynamic imports", () => {
  assert.deepEqual(
    platformImports(
      'import type { Stats } from "node:fs"; import("fs/promises"); const fs = require("fs");',
    ),
    ["node:fs", "fs/promises", "fs"],
  );
  for (const directory of ["src/core", "src/application"])
    for (const file of readdirSync(directory, { recursive: true }).map(String))
      if (file.endsWith(".ts"))
        assert.deepEqual(
          platformImports(readFileSync(join(directory, file), "utf8")),
          [],
          `${directory}/${file} must inject platform capabilities`,
        );
});

test("the actual quality gate rejects forbidden dependencies, raw HTTP and complexity growth", () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-architecture-gate-"));
  try {
    for (const name of ["src/core", "ui", "config"])
      mkdirSync(join(directory, name), { recursive: true });
    const config = JSON.parse(readFileSync(".fallowrc.json", "utf8"));
    config.entry = ["src/core/bad.ts", "ui/bad.ts"];
    // The injected fixture has no runtime measurements; new complex code must still fail.
    config.health = { ...config.health, coverage: null };
    writeFileSync(join(directory, ".fallowrc.json"), JSON.stringify(config));
    writeFileSync(
      join(directory, "config/fallow-policy.json"),
      readFileSync("config/fallow-policy.json"),
    );
    writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module" }));
    writeFileSync(
      join(directory, "ui/write-transport.ts"),
      "export function write() { return 1; }",
    );
    writeFileSync(
      join(directory, "ui/bad.ts"),
      'import { write as save } from "./write-transport.ts"; import "../docs/ux-artifacts/study.ts"; export function bad() { save(); return fetch("/"); }',
    );
    const branches = Array.from(
      { length: 23 },
      (_, index) => `if (x === ${index}) return ${index};`,
    ).join("\n");
    writeFileSync(
      join(directory, "src/core/bad.ts"),
      `import { bad } from "../../ui/bad.ts"; export const illegal = bad; export function tooComplex(x: number) { ${branches} return -1; }`,
    );
    // Exercise all configured checks together on a deliberately forbidden fixture.
    // The production gate runs the same detectors separately without baselines.
    const flags = ["--fail-on-issues"];
    const result = spawnSync(
      process.execPath,
      [
        resolve("node_modules/fallow/bin/fallow"),
        ...flags.filter((flag) => flag !== "--format"),
        "--root",
        directory,
        "--format",
        "json",
        "--no-cache",
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.gate_outcomes["error-severity-findings"].enforced, true);
    assert.equal(report.gate_outcomes["health-findings"].enforced, true);
    assert.ok(
      report.check.boundary_violations.some(
        (finding: { from_zone: string; to_zone: string }) =>
          finding.from_zone === "core" && finding.to_zone === "ui",
      ),
    );
    assert.ok(
      report.check.boundary_violations.some(
        (finding: { from_zone: string; to_zone: string }) =>
          finding.from_zone === "ui" && finding.to_zone === "http-transport",
      ),
    );
    assert.ok(
      report.check.policy_violations.some(
        (finding: { rule_id: string }) => finding.rule_id === "typed-http",
      ),
    );
    assert.ok(
      report.check.policy_violations.some(
        (finding: { rule_id: string }) => finding.rule_id === "production-only",
      ),
    );
    assert.ok(
      report.health.findings.some(
        (finding: { name: string; effective_severity: string }) =>
          finding.name === "tooComplex" && finding.effective_severity === "error",
      ),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the API contract rejects wrong endpoints, queries, payloads and caller-selected response types", () => {
  const file = resolve("test/__api-contract-type-probe__.ts");
  const source = `
import { read } from "../ui/api.ts";
import { write } from "../ui/write-transport.ts";
import type { Entity, Page, Relationship } from "../src/core/model.ts";
import type { Receipt } from "../src/core/evidence.ts";
import type { ChangeImpact } from "../src/core/impact.ts";
const entities: Promise<Page<Entity>> = read("/api/entities", {});
const receipts: Promise<Page<Receipt>> = read("/api/evidence", {kind: "receipt"});
const impact: Promise<ChangeImpact> = read("/api/impact", {baselineId: "baseline", rootId: "item", direction: "incoming", relationshipTypes: []});
void [entities, receipts, impact];
// @ts-expect-error impact requires an explicit baseline and selected direction
void read("/api/impact", {rootId: "item", relationshipTypes: []});
// @ts-expect-error stored impact directions differ from workflow presentation directions
void read("/api/impact", {baselineId: "baseline", rootId: "item", direction: "forward", relationshipTypes: []});
// @ts-expect-error selected relationship types are a native array in the typed contract
void read("/api/impact", {baselineId: "baseline", rootId: "item", direction: "incoming", relationshipTypes: "dependency"});
// @ts-expect-error unknown routes are not part of the wire contract
void read("/api/not-a-route", {});
// @ts-expect-error required query fields cannot be omitted
void read("/api/comparison", {});
// @ts-expect-error queries are specific to the endpoint
void read("/api/table", {rootId: "item"});
// @ts-expect-error schema writes require the complete command
void write("/api/schema", {expectedVersion: 1});
// @ts-expect-error response types follow the route
const wrong: Promise<Page<Relationship>> = read("/api/entities", {});
// @ts-expect-error callers cannot promise their own response type
void read<Entity>("/api/entities", {});
void wrong;
`;
  const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const host = ts.createCompilerHost(parsed.options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) =>
    name === file
      ? ts.createSourceFile(name, source, languageVersion, true)
      : original(name, languageVersion, onError, shouldCreateNewSourceFile);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([file], parsed.options, host));
  assert.deepEqual(
    diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")),
    [],
  );
});
