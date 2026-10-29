import { changeAssessmentSchema } from "../src/core/application-model.ts";
import type { OpenChangeAssessment, AssessmentSelection } from "../src/core/change-assessment.ts";
import type { InputDeclaration } from "../src/core/evidence.ts";
import { assessmentFixtureDefinition, assessmentCommand } from "./application-model-fixture.ts";
import {
  verificationFixture,
  verificationActor as actor,
  verificationTargetInput,
  verificationOpening,
  verificationExecution,
  verificationResults,
  verificationMutation,
} from "./verification-fixture.ts";

export async function installAssessmentFixture(
  f: Awaited<ReturnType<typeof verificationFixture>>,
  domain: "engineering" | "research" = "engineering",
) {
  const schema = await f.tracer.getSchema();
  if (!schema) throw Error("Fixture schema is unavailable");
  const { field, definition } = assessmentFixtureDefinition(domain);
  // Both configured application roles coexist; vocabulary names do not establish shared lifecycle identity.
  if (definition.assessment.type === f.definition.case.type)
    definition.assessment.type = "impact_investigation";
  const fragment = changeAssessmentSchema(definition);
  await f.tracer.setSchema(
    {
      entityTypes: {
        ...schema.entityTypes,
        ...fragment.entityTypes,
        impact_profile: { fields: { [field]: { type: "json", required: true } } },
      },
      relationshipTypes: { ...schema.relationshipTypes, ...fragment.relationshipTypes },
    },
    schema.version,
    actor,
  );
  const model = await f.tracer.createEntity(
    { type: "impact_profile", fields: { [field]: definition } },
    schema.version + 1,
    actor,
  );
  const pin = { entityId: model.id, version: 1, field };
  return { pin, definition };
}
export async function pairVerificationFixture(domain: "engineering" | "research" = "engineering") {
  const f = await verificationFixture(domain);
  try {
    const { pin, definition } = await installAssessmentFixture(f, domain);
    const before = await f.tracer.configurations.captureExact(
      await verificationTargetInput(f),
      actor,
    );
    const after = await f.tracer.configurations.captureExact(
      await verificationTargetInput(f),
      actor,
    );
    const context = await f.tracer.applicationModels.resolve(pin);
    const opening: OpenChangeAssessment = {
      commandId: crypto.randomUUID(),
      assessmentId: crypto.randomUUID(),
      title: "Account for selected candidate change",
      purpose: "Synthetic pair assessment and controlled verification composition",
      model: pin,
      query: {
        source: "configuration_pair",
        beforeId: before.id,
        afterId: after.id,
        policy: "scoped-reference-dependencies-v1",
        rootId: f.requirement.id,
        direction: "outgoing",
        relationshipTypes: [],
        depth: 1,
      },
      additionalFields: {},
      expectedSchemaVersion: context.context.schemaVersion,
      expectedProjectRevision: context.context.projectRevision,
      expectedEvidenceRevision: context.context.evidenceRevision,
    };
    await f.tracer.changeAssessments.open(opening, actor);
    const assessment: AssessmentSelection = {
      assessmentId: opening.assessmentId,
      openingCommandId: opening.commandId,
    };
    return { f, pin, definition, before, after, assessment, opening };
  } catch (error) {
    f.close();
    throw error;
  }
}
export async function performTargetVerification(
  x: Awaited<ReturnType<typeof pairVerificationFixture>>,
  targetId = x.after.id,
  inputs: InputDeclaration[] = [],
) {
  const result = await performVerification(x.f, targetId, inputs);
  await x.f.tracer.changeAssessments.refresh(await assessmentCommand(x.f, x.assessment), actor);
  return result;
}
export async function performVerification(
  f: Awaited<ReturnType<typeof verificationFixture>>,
  targetId: string,
  inputs: InputDeclaration[] = [],
) {
  const opening = await verificationOpening(f);
  opening.targetConfigurationId = targetId;
  await f.tracer.verification.open(opening, actor);
  const selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
  const execution = await verificationExecution(f, selection);
  execution.inputs = inputs;
  const activity = await f.tracer.verification.recordExecution(execution, actor);
  await f.tracer.verification.selectResults(
    await verificationResults(f, selection, execution.executionId),
    actor,
  );
  const conclusion = await f.tracer.verification.conclude(
    await verificationMutation(f, selection),
    actor,
  );
  return { selection, execution, activity, conclusion };
}
