import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Tracer, verificationSchema } from "../src/index.ts";
import type { VerificationModel, PrepareVerificationBasis, Schema } from "../src/index.ts";
import type {
  OpenVerificationCase,
  RecordVerificationExecution,
  VerificationSelection,
} from "../src/index.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";

export const verificationActor = {
  actor: "verification contract fixture",
  reason: "Synthetic engineering/research data; production application contract checks",
};
const models: Record<"engineering" | "research", VerificationModel> = {
  engineering: {
    contract: "requirement_verification",
    version: 1,
    requirement: {
      type: "requirement",
      fields: { title: "title", statement: "statement", acceptance: ["acceptance"] },
    },
    method: {
      type: "test_plan",
      fields: { title: "title", procedure: "method", expected: "expectedResult" },
    },
    case: {
      type: "verification_case",
      fields: {
        title: "title",
        state: "state",
        model: "model",
        basis: "basis",
        executions: "executions",
        selection: "selection",
        conclusion: "conclusion",
      },
    },
    execution: { type: "test_execution", fields: { title: "title", data: "result" } },
    relationships: {
      requirementMethod: "verified_by",
      requirementCase: "has_verification",
      caseExecution: "has_execution",
    },
    states: { open: "open", closed: "closed" },
    outcomes: { passed: "passed", failed: "failed", blocked: "blocked", not_run: "not_run" },
    policy: { allowAssessedDesignChanges: false },
  },
  research: {
    contract: "requirement_verification",
    version: 1,
    requirement: {
      type: "hypothesis",
      fields: { title: "name", statement: "claim", acceptance: ["decision_rule"] },
    },
    method: {
      type: "analysis_method",
      fields: { title: "name", procedure: "protocol", expected: "expectation" },
    },
    case: {
      type: "investigation",
      fields: {
        title: "name",
        state: "stage",
        model: "profile",
        basis: "declared_scope",
        executions: "runs",
        selection: "assessed_runs",
        conclusion: "finding",
      },
    },
    execution: { type: "analysis_run", fields: { title: "name", data: "observations" } },
    relationships: {
      requirementMethod: "tested_using",
      requirementCase: "investigated_by",
      caseExecution: "includes_run",
    },
    states: { open: "active", closed: "concluded" },
    outcomes: {
      passed: "supported",
      failed: "not_supported",
      blocked: "unavailable",
      not_run: "unexecuted",
    },
    policy: { allowAssessedDesignChanges: true },
  },
};
export async function verificationFixture(domain: keyof typeof models = "engineering") {
  const directory = mkdtempSync(join(tmpdir(), "tracer-verification-")),
    database = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(database);
  const service = () =>
    new Tracer(repository, undefined, async () => {
      throw Error("Verification reads cannot observe external content");
    });
  let tracer = service();
  const definition = structuredClone(models[domain]),
    fragment = verificationSchema(definition);
  const schema: Schema = {
    ...fragment,
    entityTypes: {
      ...fragment.entityTypes,
      model_definition: { fields: { definition: { type: "json" as const, required: true } } },
    },
  };
  await tracer.setSchema(schema, 0, verificationActor);
  const profile = await tracer.createEntity(
    { type: "model_definition", fields: { definition } },
    1,
    verificationActor,
  );
  const acceptance = "AC-1: Retain exact 🧪 inputs. AC-2: Explain the recorded result.";
  const requirement = await tracer.createEntity(
    {
      type: definition.requirement.type,
      fields: {
        [definition.requirement.fields.title]: "Criterion-bearing record",
        [definition.requirement.fields.statement]:
          "Use the explicit engineering criterion and method",
        [definition.requirement.fields.acceptance[0]]: acceptance,
      },
    },
    1,
    verificationActor,
  );
  const method = await tracer.createEntity(
    {
      type: definition.method.type,
      fields: {
        [definition.method.fields.title]: "Declared method",
        [definition.method.fields.procedure]:
          "Exercise exact recorded inputs and observe the result",
        [definition.method.fields.expected]: "Every assigned criterion is accounted for explicitly",
      },
    },
    1,
    verificationActor,
  );
  const relationship = await tracer.createRelationship(
    {
      type: definition.relationships.requirementMethod,
      source: requirement.id,
      target: method.id,
      fields: {},
    },
    1,
    verificationActor,
  );
  const split = acceptance.indexOf(" AC-2:");
  const input: PrepareVerificationBasis = {
    model: { entityId: profile.id, version: 1, field: "definition" },
    requirement: { entityId: requirement.id, version: 1 },
    coverage: {
      kind: "complete",
      rationale: "These two explicit ranges cover the entire declared acceptance field",
    },
    criteria: [
      {
        id: "AC-1",
        field: definition.requirement.fields.acceptance[0],
        start: 0,
        end: split,
        quote: acceptance.slice(0, split),
      },
      {
        id: "AC-2",
        field: definition.requirement.fields.acceptance[0],
        start: split + 1,
        end: acceptance.length,
        quote: acceptance.slice(split + 1),
      },
    ],
    methods: [
      {
        entityId: method.id,
        version: 1,
        relationship: { id: relationship.id, version: 1 },
        criterionIds: ["AC-1", "AC-2"],
      },
    ],
  };
  return {
    get tracer() {
      return tracer;
    },
    get repository() {
      return repository;
    },
    schema,
    definition,
    profile,
    requirement,
    method,
    relationship,
    input,
    database,
    reopen() {
      repository.close();
      repository = new SQLiteRepository(database);
      tracer = service();
    },
    close() {
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
type Fixture = Awaited<ReturnType<typeof verificationFixture>>;
export async function verificationOpening(f: Fixture): Promise<OpenVerificationCase> {
  const model = await f.tracer.verification.resolveModel(f.input.model);
  return {
    commandId: randomUUID(),
    caseId: randomUUID(),
    membershipId: randomUUID(),
    title: "Scoped criterion verification",
    purpose: "Account for the declared criteria/methods without inferring engineering truth",
    basis: structuredClone(f.input),
    additionalFields: {},
    expectedSchemaVersion: model.context.schemaVersion,
    expectedProjectRevision: model.context.projectRevision,
    expectedEvidenceRevision: model.context.evidenceRevision,
  };
}
export async function verificationExecution(
  f: Fixture,
  selection: VerificationSelection,
): Promise<RecordVerificationExecution> {
  const view = await f.tracer.verification.get(selection);
  return {
    ...selection,
    commandId: randomUUID(),
    executionId: randomUUID(),
    membershipId: randomUUID(),
    title: "Explicit fixture execution",
    methodId: f.method.id,
    source: { kind: "performed" },
    conditions: { scope: "Synthetic fixture; no physical/scientific validity claim" },
    results: view.scope.basis.methods[0].criterionIds.map((criterionId) => ({
      criterionId,
      outcome: "passed",
      actual: "Fixture observation recorded",
      rationale: "Explicit typed attestation, not a parsed prose outcome",
    })),
    inputs: [],
    relationshipInputs: [],
    additionalFields: {},
    expectedCaseVersion: view.case.version,
    expectedSchemaVersion: view.model.context.schemaVersion,
    expectedProjectRevision: view.model.context.projectRevision,
    expectedEvidenceRevision: view.model.context.evidenceRevision,
  };
}
