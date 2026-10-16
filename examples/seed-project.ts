import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { devNull } from "node:os";
import { execFileSync } from "node:child_process";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { ensure } from "../src/core/model.ts";
import type { Entity } from "../src/core/model.ts";
import type { InputDeclaration, Observation } from "../src/core/evidence.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";

/** Creates only a new isolated directory. Existing directories/projects are never overwritten. */
export async function seedProject(destination: string) {
  const directory = resolve(destination);
  mkdirSync(directory); // Deliberately outside cleanup: EEXIST must leave existing files untouched.
  let repository: SQLiteRepository | undefined;
  try {
    const database = join(directory, "project.sqlite");
    repository = new SQLiteRepository(database);
    const tracer = new Tracer(repository, undefined, observeLocal);
    const actor = { actor: "seed-demo", reason: "Offline sample project" };
    await tracer.setSchema(
      {
        entityTypes: {
          requirement: {
            fields: {
              title: { type: "string", required: true },
              approved: { type: "boolean" },
              priority: { type: "number" },
            },
          },
          artifact: {
            fields: { title: { type: "string", required: true }, notes: { type: "string" } },
          },
          evaluation: { fields: { title: { type: "string", required: true } } },
          conclusion: { fields: { title: { type: "string", required: true } } },
        },
        relationshipTypes: {
          implemented_by: { source: ["requirement"], target: ["artifact"], fields: {} },
          references: { fields: {} },
          verified_against: { source: ["evaluation"], target: ["requirement"], fields: {} },
          generated_from: { fields: {} },
        },
      },
      0,
      actor,
    );
    const create = (type: string, key: string, title: string) =>
      tracer.createEntity(
        {
          type,
          key,
          fields: { title, ...(type === "requirement" ? { approved: false, priority: 1 } : {}) },
        },
        1,
        actor,
      );
    const link = (type: string, source: Entity, target: Entity) =>
      tracer.createRelationship(
        { type, source: source.id, target: target.id, fields: {} },
        1,
        actor,
      );
    const bind = (value: Entity, system: "git" | "file") =>
      tracer.evidence.bindExternal(
        { entityId: value.id, system, externalId: value.key!, ownership: "external" },
        actor,
      );
    const observeFile = async (value: Entity, file: string, available = true) => {
      const observation = await tracer.evidence.observe(
        { entityId: value.id, locator: { system: "file", path: join(directory, file) } },
        actor,
      );
      ensure(
        !available || observation.availability === "available",
        "usage",
        "Could not observe seeded local file",
      );
      return observation;
    };
    const receipt = (
      output: Entity,
      outcome: string,
      inputs: InputDeclaration[],
      supersedes?: string,
    ) =>
      tracer.evidence.recordReceipt(
        { outputId: output.id, outcome, inputs, ...(supersedes ? { supersedes } : {}) },
        actor,
      );

    const source = join(directory, "firmware");
    mkdirSync(source);
    const hooks = join(directory, "empty-hooks");
    mkdirSync(hooks);
    const git = (...args: string[]) =>
      execFileSync(
        "git",
        ["-c", "core.hooksPath=" + hooks, "-c", "commit.gpgsign=false", "-C", source, ...args],
        {
          encoding: "utf8",
          timeout: 5000,
          env: {
            ...process.env,
            GIT_CONFIG_GLOBAL: devNull,
            GIT_CONFIG_NOSYSTEM: "1",
            GIT_TERMINAL_PROMPT: "0",
          },
        },
      );
    git("init", "--quiet", "--template=");
    git("config", "user.name", "Tracer Demo");
    git("config", "user.email", "demo@example.invalid");
    const commit = (message: string) => {
      git("add", "--", "motor.ts", "unrelated.txt");
      git("commit", "--quiet", "-m", message);
    };
    writeFileSync(join(source, "motor.ts"), "export const maximumSpeed = 100;\n");
    writeFileSync(join(source, "unrelated.txt"), "Unrelated repository note.\n");
    commit("Seed original motor implementation");
    const requirement = await create(
      "requirement",
      "REQ-001",
      "Motor shall achieve 100 RPM within the qualified range",
    );
    await create("requirement", "REQ-GAP", "Emergency stop shall disable motor (unlinked example)");
    const implementation = await create("artifact", "FW-03", "Git-tracked motor implementation");
    await bind(implementation, "git");
    const observeGit = async () => {
      const value = await tracer.evidence.observe(
        {
          entityId: implementation.id,
          locator: { system: "git", repository: source, path: "motor.ts", ref: "HEAD" },
        },
        actor,
      );
      ensure(
        value.availability === "available",
        "usage",
        "Demo needs Git with --no-lazy-fetch support",
      );
      return value;
    };
    const original = await observeGit();
    const implementationLink = await link("implemented_by", requirement, implementation);
    const report = await create("artifact", "REPORT-01", "Local verification report");
    await bind(report, "file");
    writeFileSync(
      join(directory, "verification-report.txt"),
      "PASS: motor qualified from 80 to 120 RPM.\n",
    );
    const reportObservation = await observeFile(report, "verification-report.txt");
    await link("references", requirement, report);
    const engineeringInputs = async (output: Entity, observation: Observation) => {
      const requirementLink = await link("verified_against", output, requirement);
      const reportLink = await link("generated_from", output, report);
      return [
        { entityId: requirement.id, path: [requirementLink.id] },
        {
          entityId: implementation.id,
          observationId: observation.id,
          path: [requirementLink.id, implementationLink.id],
        },
        { entityId: report.id, observationId: reportObservation.id, path: [reportLink.id] },
      ];
    };
    const changedOutput = await create(
      "evaluation",
      "EVAL-CHANGED",
      "Changed input — review required",
    );
    const changed = await receipt(
      changedOutput,
      "Original qualification",
      await engineeringInputs(changedOutput, original),
    );
    const acceptedOutput = await create(
      "evaluation",
      "EVAL-ACCEPTED",
      "Changed input — existing evidence accepted",
    );
    const accepted = await receipt(
      acceptedOutput,
      "Original qualification",
      await engineeringInputs(acceptedOutput, original),
    );
    const replacedOutput = await create(
      "evaluation",
      "EVAL-SUPERSEDED",
      "Original and replacement evaluations",
    );
    const replaced = await receipt(
      replacedOutput,
      "Original qualification (superseded)",
      await engineeringInputs(replacedOutput, original),
    );
    writeFileSync(join(source, "motor.ts"), "export const maximumSpeed = 110;\n");
    commit("Change declared motor input");
    const relevant = await observeGit();
    const currentOutput = await create(
      "evaluation",
      "EVAL-CURRENT",
      "Current — unrelated commit ignored",
    );
    const current = await receipt(
      currentOutput,
      "PASS: qualified at 110 RPM",
      await engineeringInputs(currentOutput, relevant),
    );
    const replacement = await receipt(
      replacedOutput,
      "PASS: reevaluated at 110 RPM",
      await engineeringInputs(replacedOutput, relevant),
      replaced.id,
    );
    writeFileSync(join(source, "unrelated.txt"), "Updated note; motor file unchanged.\n");
    commit("Unrelated change (not a dependency)");
    await observeGit();
    const comparison = await tracer.evidence.compareReceipt(accepted.id);
    await tracer.evidence.review(
      {
        receiptId: accepted.id,
        decision: "accepted",
        rationale:
          "110 RPM remains within the report's qualified 80–120 RPM range; no reevaluation needed.",
        expectedComparison: comparison.token,
      },
      actor,
    );

    const missing = await create("artifact", "MISSING-01", "Unavailable local calibration file");
    await bind(missing, "file");
    const unavailable = await observeFile(missing, "missing-calibration.txt", false);
    const unknownOutput = await create(
      "evaluation",
      "EVAL-UNKNOWN",
      "Unknown — missing calibration input",
    );
    const unknown = await receipt(
      unknownOutput,
      "Calibration applicability cannot be established",
      [{ entityId: missing.id, observationId: unavailable.id }],
    );

    const conclusion = await create(
      "conclusion",
      "CONCLUSION-01",
      "Research: positive association under analysis A",
    );
    const dataset = await create("artifact", "DATASET-01", "Research dataset (changed)");
    const script = await create("artifact", "SCRIPT-01", "Analysis script (unchanged)");
    const researchInputs: InputDeclaration[] = [];
    for (const [value, file, content] of [
      [dataset, "dataset.csv", "x,y\n1,2\n2,4\n"],
      [script, "analysis.py", "print('analysis A')\n"],
    ] as const) {
      await bind(value, "file");
      writeFileSync(join(directory, file), content);
      const observation = await observeFile(value, file),
        dependency = await link("generated_from", conclusion, value);
      researchInputs.push({
        entityId: value.id,
        observationId: observation.id,
        path: [dependency.id],
      });
    }
    const research = await receipt(
      conclusion,
      "Positive association using original dataset",
      researchInputs,
    );
    writeFileSync(join(directory, "dataset.csv"), "x,y\n1,2\n2,5\n");
    await observeFile(dataset, "dataset.csv");
    const researchComparison = await tracer.evidence.compareReceipt(research.id);
    await tracer.evidence.review(
      {
        receiptId: research.id,
        decision: "needs_reevaluation",
        rationale: "Dataset values changed; rerun analysis A before relying on the conclusion.",
        expectedComparison: researchComparison.token,
      },
      actor,
    );
    const scenarios = {
      current: current.id,
      changed: changed.id,
      accepted: accepted.id,
      unknown: unknown.id,
      superseded: replaced.id,
      replacement: replacement.id,
      research: research.id,
    };
    writeFileSync(join(directory, "scenarios.json"), JSON.stringify(scenarios, null, 2) + "\n");
    writeFileSync(
      join(directory, "README.txt"),
      "Tracer offline demo. All artifacts and Git commits are isolated in this directory.\nOpen Evidence and select EVAL-CURRENT, EVAL-CHANGED, EVAL-ACCEPTED, EVAL-UNKNOWN or EVAL-SUPERSEDED; CONCLUSION-01 demonstrates research reevaluation.\nEdit native fields in Table, toggle links in Matrix. To test external changes, edit dataset.csv or commit motor.ts in firmware/, then Record observation in Evidence.\nmissing-calibration.txt intentionally does not exist. Create it, observe it, and record a new receipt (the original unknown baseline remains immutable).\nRestart with: npm start -- --db " +
        JSON.stringify(database) +
        "\n",
    );
    repository.close();
    repository = undefined;
    return { directory, database, scenarios };
  } catch (error) {
    repository?.close();
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}
