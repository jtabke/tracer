import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";
import type { InputDeclaration } from "../src/core/evidence.ts";
export const cycleActor = {
  actor: "evidence-cycle-qa",
  reason: "Simulated engineering workflow; actual Tracer behavioral checks",
};
export async function evidenceCycleFixture() {
  const directory = mkdtempSync(join(tmpdir(), "tracer-evidence-cycle-")),
    database = join(directory, "project.sqlite"),
    definitionFile = join(directory, "definition.md"),
    reportFile = join(directory, "test-report.md");
  let repository = new SQLiteRepository(database),
    tracer = new Tracer(repository, undefined, observeLocal);
  await tracer.setSchema(
    {
      entityTypes: {
        requirement: {
          fields: {
            title: { type: "string" },
            statement: { type: "string" },
            limit_W: { type: "number" },
            rationale: { type: "string" },
            verificationStatus: { type: "string" },
          },
        },
        component: { fields: { title: { type: "string" }, revision: { type: "string" } } },
        verification_plan: { fields: { title: { type: "string" }, procedure: { type: "string" } } },
        verification_run: { fields: { title: { type: "string" }, conditions: { type: "json" } } },
        verification_assessment: { fields: { title: { type: "string" } } },
        note: { fields: { title: { type: "string" } } },
      },
      relationshipTypes: {
        allocated_to: { source: ["requirement"], target: ["component"], fields: {} },
        verified_by: { source: ["requirement"], target: ["verification_plan"], fields: {} },
        evaluates: { source: ["verification_plan"], target: ["component"], fields: {} },
        execution_of: { source: ["verification_run"], target: ["verification_plan"], fields: {} },
        cites: {
          source: ["requirement", "verification_run"],
          target: [],
          reference: true,
          resourceTarget: true,
          fields: {},
        },
      },
    },
    0,
    cycleActor,
  );
  const requirement = await tracer.createEntity(
    {
      type: "requirement",
      key: "REQ-POWER",
      fields: {
        title: "Operating power",
        statement: "Operating power shall not exceed the declared limit.",
        limit_W: 20,
        rationale: "Supply compatibility",
        verificationStatus: "not_verified",
      },
    },
    1,
    cycleActor,
  );
  const article = await tracer.createEntity(
    { type: "component", key: "ARTICLE", fields: { title: "Product candidate", revision: "A" } },
    1,
    cycleActor,
  );
  const plan = await tracer.createEntity(
    {
      type: "verification_plan",
      key: "PLAN-POWER",
      fields: { title: "Measure operating power", procedure: "P1" },
    },
    1,
    cycleActor,
  );
  const run = await tracer.createEntity(
    {
      type: "verification_run",
      key: "RUN-A",
      fields: {
        title: "Simulated run A",
        conditions: { ambient_C: 23, mode: "normal", peak_W: 19 },
      },
    },
    1,
    cycleActor,
  );
  const conclusion = await tracer.createEntity(
    {
      type: "verification_assessment",
      key: "ASSESS-POWER",
      fields: { title: "Power conformance assessment" },
    },
    1,
    cycleActor,
  );
  const links = [];
  for (const [type, source, target] of [
    ["allocated_to", requirement, article],
    ["verified_by", requirement, plan],
    ["evaluates", plan, article],
    ["execution_of", run, plan],
  ] as const)
    links.push(
      await tracer.createRelationship(
        { type, source: source.id, target: target.id, fields: {} },
        1,
        cycleActor,
      ),
    );
  writeFileSync(definitionFile, "Section 4.2: Maximum operating power 20 W\n");
  writeFileSync(reportFile, "SIMULATED report: article A, procedure P1, peak 19 W\n");
  const definition = await tracer.createEntity(
    {
      type: "@resource",
      fields: {},
      resource: {
        label: "Customer specification",
        source: { system: "file", externalId: "customer-specification" },
      },
    },
    1,
    cycleActor,
  );
  const report = await tracer.createEntity(
    {
      type: "@resource",
      fields: {},
      resource: {
        label: "Power test report",
        source: { system: "file", externalId: "power-test-report" },
      },
    },
    1,
    cycleActor,
  );
  const definitionObservation = await tracer.evidence.observe(
    { entityId: definition.id, locator: { system: "file", path: definitionFile } },
    cycleActor,
  );
  const reportObservation = await tracer.evidence.observe(
    { entityId: report.id, locator: { system: "file", path: reportFile } },
    cycleActor,
  );
  const definitionReference = await tracer.createRelationship(
    {
      type: "cites",
      source: requirement.id,
      target: definition.id,
      fields: {},
      reference: {
        role: "definition",
        explanation: "Establishes the power threshold",
        selector: { kind: "section", value: "4.2" },
        state: { mode: "pinned", observationId: definitionObservation.id },
      },
    },
    1,
    cycleActor,
  );
  const reportReference = await tracer.createRelationship(
    {
      type: "cites",
      source: run.id,
      target: report.id,
      fields: {},
      reference: {
        role: "supporting result",
        selector: { kind: "section", value: "Results" },
        state: { mode: "pinned", observationId: reportObservation.id },
      },
    },
    1,
    cycleActor,
  );
  const inputs: InputDeclaration[] = [
    { entityId: requirement.id, fields: ["statement", "limit_W"], role: "acceptance criterion" },
    { entityId: article.id, fields: ["revision"], role: "article under test" },
    { entityId: plan.id, fields: ["procedure"], role: "executed procedure" },
    { entityId: run.id, fields: ["conditions"], role: "activity conditions" },
    { entityId: definition.id, observationId: definitionObservation.id, role: "definition source" },
    { entityId: report.id, observationId: reportObservation.id, role: "supporting material" },
  ];
  const receipt = await tracer.evidence.recordReceipt(
    {
      outputId: conclusion.id,
      outcome: "SIMULATED PASS for article A, procedure P1: 19 W ≤ 20 W. Workflow fixture only.",
      inputs,
      relationshipInputs: [
        { id: definitionReference.id, role: "criterion interpretation" },
        { id: reportReference.id, role: "result interpretation" },
      ],
    },
    cycleActor,
  );
  const baseline = await tracer.baselines.capture(
    {
      id: "before-power-change",
      name: "Native state before power change",
      expectedProjectRevision: (await tracer.timeline()).head,
    },
    cycleActor,
  );
  return {
    get tracer() {
      return tracer;
    },
    get repository() {
      return repository;
    },
    directory,
    database,
    definitionFile,
    reportFile,
    requirement,
    article,
    plan,
    run,
    conclusion,
    definition,
    report,
    definitionObservation,
    reportObservation,
    definitionReference,
    reportReference,
    links,
    receipt,
    baseline,
    inputs,
    reopen() {
      repository.close();
      repository = new SQLiteRepository(database);
      tracer = new Tracer(repository, undefined, observeLocal);
      return tracer;
    },
    close() {
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
