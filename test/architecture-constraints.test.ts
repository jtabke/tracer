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
    for (const name of ["src/core", "src/application/ports", "src/persistence", "ui", "config"])
      mkdirSync(join(directory, name), { recursive: true });
    const config = JSON.parse(readFileSync(".fallowrc.json", "utf8"));
    config.entry = ["src/core/bad.ts", "src/application/bad.ts", "ui/bad.ts"];
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
      'import { write as save } from "./write-transport.ts"; import { headless } from "../src/client.ts"; import "../docs/ux-artifacts/study.ts"; export function bad() { save(); return headless + fetch("/"); }',
    );
    writeFileSync(join(directory, "src/client.ts"), "export const headless = 1;");
    const branches = Array.from(
      { length: 23 },
      (_, index) => `if (x === ${index}) return ${index};`,
    ).join("\n");
    writeFileSync(
      join(directory, "src/core/bad.ts"),
      `import { bad } from "../../ui/bad.ts"; export const illegal = bad; export function tooComplex(x: number) { ${branches} return -1; }`,
    );
    writeFileSync(
      join(directory, "src/application/bad.ts"),
      'import { driver } from "../persistence/bad.ts"; export const service = driver;',
    );
    writeFileSync(
      join(directory, "src/persistence/bad.ts"),
      'import type { Port } from "../application/ports/repository.ts"; export const driver: Port = { value: 1 };',
    );
    writeFileSync(
      join(directory, "src/application/ports/repository.ts"),
      'import { service } from "../bad.ts"; export type Port = { value: number }; export const illegal = service;',
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
    for (const [from, to] of [
      ["application", "persistence"],
      ["repository-contract", "application"],
      ["ui", "headless-client"],
    ])
      assert.ok(
        report.check.boundary_violations.some(
          (finding: { from_zone: string; to_zone: string }) =>
            finding.from_zone === from && finding.to_zone === to,
        ),
        `${from} must not depend on ${to}`,
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
import { createClient } from "../src/client.ts";
import { read as endpoint } from "../src/interfaces/api/definition.ts";
import { query, textParam } from "../src/interfaces/api/query.ts";
import { object, number } from "../src/interfaces/decode.ts";
import type { Entity, Page, Relationship } from "../src/core/model.ts";
import type { Receipt } from "../src/core/evidence.ts";
import type { ChangeImpact } from "../src/core/impact.ts";
import type { Transaction } from "../src/application/ports/repository.ts";
import type { Evidence, EvidenceKind, EvidenceAppend, Observation, Review, ExternalIdentity } from "../src/core/evidence.ts";
import type { Tracer } from "../src/index.ts";
declare const tx: Transaction;
const nativeEntity: Promise<Entity | undefined> = tx.get("entity", "item");
const nativeLink: Promise<Relationship | undefined> = tx.getAt("relationship", "link", 1);
const nativeSchema: Promise<import("../src/core/model.ts").SchemaObject | undefined> = tx.get("schema", "project");
void nativeEntity; void nativeLink; void nativeSchema;
// @ts-expect-error native read result follows its selected kind
const wrongNative: Promise<Relationship | undefined> = tx.get("entity", "item");
// @ts-expect-error historical reads use the same kind/result correlation
const wrongHistorical: Promise<Entity | undefined> = tx.getAt("schema", "project", 1);
// @ts-expect-error native reads do not support invented kinds
void tx.get("document", "item");
void wrongNative; void wrongHistorical;

declare const tracer: Tracer;
declare const captured: Receipt;
declare const observed: Observation;
declare const reviewed: Review;
declare const external: ExternalIdentity;
declare const kind: EvidenceKind;
declare const payload: Evidence;
declare const entry: EvidenceAppend;
void tx.appendEvidence("receipt", "output", captured);
void tx.appendEvidence("observation", "input", observed);
void tx.appendEvidence("review", "receipt", reviewed);
void tx.appendEvidence("external", "input", external);
void tx.appendEvidence(...entry);
const capturedRead: Promise<Receipt | undefined> = tx.getEvidence("receipt", "id");
const reviews: Promise<Page<Review>> = tx.evidence("review", {});
const lastObservation: Promise<Observation | undefined> = tx.latestEvidence("observation", "id");
const serviceReviews: Promise<Page<Review>> = tracer.evidence.list("review");
void [capturedRead, reviews, lastObservation, serviceReviews];
// @ts-expect-error a receipt cannot be stored as a review
void tx.appendEvidence("review", "receipt", captured);
// @ts-expect-error a review cannot be stored as an observation
void tx.appendEvidence("observation", "input", reviewed);
// @ts-expect-error an observation cannot be stored as a receipt
void tx.appendEvidence("receipt", "output", observed);
// @ts-expect-error a receipt cannot be stored as an external identity
void tx.appendEvidence("external", "input", captured);
// @ts-expect-error independently union-typed arguments do not establish kind/payload correlation
void tx.appendEvidence(kind, "subject", payload);
// @ts-expect-error reads follow the selected kind
const wrongEvidence: Promise<Review | undefined> = tx.getEvidence("receipt", "id");
// @ts-expect-error callers cannot override the selected kind using a type argument
void tx.getEvidence<"review">("receipt", "id");
// @ts-expect-error only observations and reviews have a latest-by-subject operation
void tx.latestEvidence("receipt", "id");
void wrongEvidence;
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
// @ts-expect-error empty query endpoints reject unsupported parameters
void read("/api/schema", {unexpected: "value"});
const client = createClient({baseUrl: "http://localhost:4317"});
const resolvedModel: Promise<import("../src/core/application-model.ts").ResolvedApplicationModel> = client.read("/api/application-model", {entityId: "model", version: 1, field: "definition"});
void resolvedModel;
// @ts-expect-error model selection must pin a version
void client.read("/api/application-model", {entityId: "model", field: "definition"});
// @ts-expect-error model selection is specific, not a schema-version query
void client.read("/api/application-model", {id: "model", schemaVersion: 1});

const evaluationRequest = {commandId: "analysis-1", expectedSchemaVersion: 1, expectedEvidenceRevision: 0, operations: [], receipt: {outputId: "output", outcome: "recorded", inputs: []}};
const evaluationResult: Promise<import("../src/core/evaluation-command.ts").EvaluationResult> = client.write("/api/evaluation-commands", evaluationRequest);
const assessmentRequest: import("../src/core/change-assessment.ts").OpenChangeAssessment = {
  commandId: "assessment", assessmentId: "identity", title: "Scope", purpose: "Impact",
  model: {entityId: "model", version: 1, field: "definition"},
  query: {baselineId: "baseline", rootId: "root", direction: "outgoing", relationshipTypes: []},
  additionalFields: {}, expectedSchemaVersion: 1, expectedProjectRevision: 1, expectedEvidenceRevision: 0,
};
const assessmentResult: typeof evaluationResult = client.write("/api/change-assessments/open", assessmentRequest);
void assessmentResult;
const assessmentSelection = {assessmentId: "assessment", openingCommandId: "open-command"};
const assessmentView: Promise<import("../src/core/change-assessment.ts").ChangeAssessmentView> = client.read("/api/change-assessment", assessmentSelection);
void assessmentView;
const analysis: Promise<import("../src/core/change-assessment.ts").AssessmentAnalysis> = client.read("/api/assessment-analysis", assessmentSelection);
void analysis;
// @ts-expect-error disposition operations require explicit candidate basis and action/support declarations
void client.write("/api/change-assessments/disposition", {...assessmentSelection, commandId: "judgment"});
// @ts-expect-error closure requires exact native/evidence/record guards and rationale
void client.write("/api/change-assessments/close", assessmentSelection);
// @ts-expect-error controlled assessment selection requires original opening command identity
void client.read("/api/change-assessment", {assessmentId: "assessment"});
// @ts-expect-error refresh needs explicit native/evidence/assessment guards and rationale
void client.write("/api/change-assessments/refresh", {...assessmentSelection, commandId: "refresh"});
// @ts-expect-error assessment basis is mandatory
void client.write("/api/change-assessments/open", {...assessmentRequest, expectedEvidenceRevision: undefined});
// @ts-expect-error a paged population cannot be claimed as complete assessment scope
void client.write("/api/change-assessments/open", {...assessmentRequest, query: {...assessmentRequest.query, after: "cursor"}});
const evaluationOutcome: Promise<import("../src/core/evaluation-command.ts").EvaluationResult | null> = client.read("/api/evaluation-outcome", {commandId: "analysis-1"});
void evaluationResult; void evaluationOutcome;
// @ts-expect-error evidence guards are numeric watermarks, not timestamps
void client.write("/api/evaluation-commands", {...evaluationRequest, expectedEvidenceRevision: "now"});
// @ts-expect-error evaluation writes require command identity and a schema guard
void client.write("/api/evaluation-commands", {operations: [], receipt: evaluationRequest.receipt});
// @ts-expect-error evaluation outcomes use command identity, not engineering object identity
void client.read("/api/evaluation-outcome", {id: "output"});
// @ts-expect-error a native changeset response is not an evaluation result
const wrongEvaluation: Promise<import("../src/core/evaluation-command.ts").EvaluationResult> = client.write("/api/changesets", {expectedSchemaVersion: 1, operations: []});
void wrongEvaluation;
const native: Promise<Page<Entity>> = client.read("/api/entities", {});
void native;
endpoint({
  query: query({id: textParam}),
  handle: (_context, input) => ({id: input.id}),
  // @ts-expect-error the decoder must match the service's actual result
  response: object({id: number}),
});

void client.checkCompatibility({features: ["changeset-command-recovery"], minimumLimits: {maxChangesetOperations: 1000}});
// @ts-expect-error advertised limit names are specific to this API
void client.checkCompatibility({minimumLimits: {anything: 1000}});
// @ts-expect-error capabilities have no project schema query
void client.read("/api/capabilities", {schemaVersion: 1});
// @ts-expect-error headless queries obey the same endpoint contract
void client.read("/api/native-pin", {id: "item"});
// @ts-expect-error headless writes require captured version guards
void client.write("/api/changesets", {operations: []});
// @ts-expect-error callers cannot choose a headless response type
void client.read<Entity>("/api/entities", {});
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
