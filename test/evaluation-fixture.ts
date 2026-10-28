import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";
import type { EvaluationCommand } from "../src/application/evaluations.ts";
export const evaluationActor = {
  actor: "evaluation-fixture",
  reason: "Synthetic engineering/research operation",
};
const models = {
  engineering: {
    criterion: "requirement",
    article: "build",
    method: "test_plan",
    activity: "test_run",
    conclusion: "verification_summary",
    threshold: "limit_W",
    articleRevision: "revision",
    methodRevision: "procedure",
    annotation: "rationale",
    allocation: "allocated_to",
    planning: "verified_by",
    analysis: "evaluates",
    execution: "execution_of",
    value: 20,
    outcome: "SIMULATED PASS: 19 W <= 20 W for build A under procedure P1",
  },
  research: {
    criterion: "hypothesis",
    article: "cohort",
    method: "analysis_method",
    activity: "analysis_run",
    conclusion: "finding",
    threshold: "alpha",
    articleRevision: "cohort_version",
    methodRevision: "script",
    annotation: "comment",
    allocation: "studies",
    planning: "tested_using",
    analysis: "analyzes",
    execution: "runs",
    value: 0.05,
    outcome:
      "SIMULATED exploratory association for cohort A under analysis P1; no scientific validity claimed",
  },
} as const;
export async function evaluationFixture(domain: keyof typeof models = "engineering") {
  const model = models[domain],
    directory = mkdtempSync(join(tmpdir(), "tracer-evaluation-")),
    database = join(directory, "project.sqlite"),
    specFile = join(directory, "definition.md"),
    reportFile = join(directory, "report.md");
  let repository = new SQLiteRepository(database),
    observations = 0;
  const service = () =>
    new Tracer(repository, undefined, async (locator) => {
      observations++;
      return observeLocal(locator);
    });
  let tracer = service();
  await tracer.setSchema(
    {
      entityTypes: {
        [model.criterion]: {
          fields: {
            title: { type: "string" },
            statement: { type: "string" },
            [model.threshold]: { type: "number" },
            [model.annotation]: { type: "string" },
          },
        },
        [model.article]: {
          fields: { title: { type: "string" }, [model.articleRevision]: { type: "string" } },
        },
        [model.method]: {
          fields: { title: { type: "string" }, [model.methodRevision]: { type: "string" } },
        },
        [model.activity]: { fields: { title: { type: "string" }, conditions: { type: "json" } } },
        [model.conclusion]: { fields: { title: { type: "string" } } },
      },
      relationshipTypes: {
        [model.allocation]: { source: [model.criterion], target: [model.article], fields: {} },
        [model.planning]: { source: [model.criterion], target: [model.method], fields: {} },
        [model.analysis]: { source: [model.method], target: [model.article], fields: {} },
        [model.execution]: { source: [model.activity], target: [model.method], fields: {} },
        cites: {
          source: [model.criterion, model.activity],
          target: [],
          resourceTarget: true,
          reference: true,
          fields: {},
        },
      },
      coverageExpectations: {
        method: {
          name: "Explicit planned method",
          subject: { type: model.criterion },
          relationshipType: model.planning,
          direction: "outgoing",
          related: { type: model.method },
          minimumDistinctTargets: 1,
        },
      },
    },
    0,
    evaluationActor,
  );
  const criterion = await tracer.createEntity(
    {
      type: model.criterion,
      fields: {
        title: "Criterion",
        statement: "Use the recorded criterion and conditions",
        [model.threshold]: model.value,
        [model.annotation]: "Initial annotation",
      },
    },
    1,
    evaluationActor,
  );
  const article = await tracer.createEntity(
    { type: model.article, fields: { title: "Candidate A", [model.articleRevision]: "A" } },
    1,
    evaluationActor,
  );
  const method = await tracer.createEntity(
    { type: model.method, fields: { title: "Planned method", [model.methodRevision]: "P1" } },
    1,
    evaluationActor,
  );
  for (const [type, source, target] of [
    [model.allocation, criterion, article],
    [model.analysis, method, article],
  ] as const)
    await tracer.createRelationship(
      { type, source: source.id, target: target.id, fields: {} },
      1,
      evaluationActor,
    );
  writeFileSync(specFile, `SIMULATED ${domain} source; criterion ${model.value}\n`);
  writeFileSync(reportFile, model.outcome + "\n");
  const resource = async (label: string, externalId: string, path: string) => {
    const entity = await tracer.createEntity(
      {
        type: "@resource",
        fields: {},
        resource: { label, source: { system: "file", externalId } },
      },
      1,
      evaluationActor,
    );
    const observation = await tracer.evidence.observe(
      { entityId: entity.id, locator: { system: "file", path } },
      evaluationActor,
    );
    return { entity, observation };
  };
  const spec = await resource("Criterion context", "fixture:definition", specFile),
    report = await resource("Execution material", "fixture:report", reportFile);
  const definition = await tracer.createRelationship(
    {
      type: "cites",
      source: criterion.id,
      target: spec.entity.id,
      fields: {},
      reference: {
        role: "criterion context",
        selector: { kind: "section", value: "4.2" },
        state: { mode: "pinned", observationId: spec.observation.id },
      },
    },
    1,
    evaluationActor,
  );
  const baseline = await tracer.baselines.capture(
    {
      name: "Before application operation",
      expectedProjectRevision: (await tracer.timeline()).head,
    },
    evaluationActor,
  );
  const activityId = crypto.randomUUID(),
    outputId = crypto.randomUUID(),
    reportReferenceId = crypto.randomUUID();
  const command: EvaluationCommand = {
    commandId: `${domain}-evaluation`,
    expectedSchemaVersion: 1,
    expectedProjectRevision: (await tracer.timeline()).head,
    operations: [
      {
        op: "entity.create",
        id: activityId,
        input: {
          type: model.activity,
          fields: {
            title: "Recorded activity",
            conditions: { context: domain, temperature_C: 23, sample_count: 100 },
          },
        },
      },
      {
        op: "entity.create",
        id: outputId,
        input: { type: model.conclusion, fields: { title: "Managed conclusion" } },
      },
      {
        op: "relationship.create",
        id: crypto.randomUUID(),
        input: { type: model.planning, source: criterion.id, target: method.id, fields: {} },
      },
      {
        op: "relationship.create",
        id: crypto.randomUUID(),
        input: { type: model.execution, source: activityId, target: method.id, fields: {} },
      },
      {
        op: "reference.create",
        id: reportReferenceId,
        input: {
          type: "cites",
          source: activityId,
          sourceVersion: 1,
          target: report.entity.id,
          targetVersion: 1,
          fields: {},
          reference: {
            role: "supporting result",
            selector: { kind: "section", value: "Results" },
            state: { mode: "pinned", observationId: report.observation.id },
          },
        },
      },
    ],
    receipt: {
      outputId,
      expectedOutputVersion: 1,
      outcome: model.outcome,
      inputs: [
        {
          entityId: criterion.id,
          expectedVersion: 1,
          fields: ["statement", model.threshold],
          role: "criterion",
        },
        {
          entityId: article.id,
          expectedVersion: 1,
          fields: [model.articleRevision],
          role: "candidate",
        },
        { entityId: method.id, expectedVersion: 1, fields: [model.methodRevision], role: "method" },
        {
          entityId: activityId,
          expectedVersion: 1,
          fields: ["conditions"],
          role: "activity conditions",
        },
        { entityId: spec.entity.id, observationId: spec.observation.id, role: "criterion source" },
        {
          entityId: report.entity.id,
          observationId: report.observation.id,
          role: "supporting material",
        },
      ],
      relationshipInputs: [
        { id: definition.id, expectedVersion: 1, role: "criterion interpretation" },
        { id: reportReferenceId, expectedVersion: 1, role: "result interpretation" },
      ],
    },
  };
  const impact = {
    baselineId: baseline.id,
    rootId: criterion.id,
    direction: "outgoing" as const,
    relationshipTypes: [model.allocation, model.planning, model.analysis, "cites"],
    depth: 2,
    limit: 1,
  };
  return {
    domain,
    model,
    directory,
    database,
    specFile,
    reportFile,
    criterion,
    article,
    method,
    spec,
    report,
    definition,
    baseline,
    command,
    impact,
    get tracer() {
      return tracer;
    },
    get repository() {
      return repository;
    },
    get observations() {
      return observations;
    },
    reopen() {
      repository.close();
      repository = new SQLiteRepository(database);
      tracer = service();
      return tracer;
    },
    close() {
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
