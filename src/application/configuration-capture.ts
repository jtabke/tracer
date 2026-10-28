import { ensure } from "../core/model.ts";
import type { Provenance } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type {
  Configuration,
  ExactConfigurationInput,
  PinnedEntity,
} from "../core/configuration.ts";
import { validateConfigurationCapture } from "../core/configuration-capture-validation.ts";
import type { Transaction } from "./ports/repository.ts";
import { projectSchema } from "./native-query-support.ts";
import { expectProjectRevision, expectEvidenceRevision } from "./version-guard.ts";
import { configurationMembers } from "./configuration-members.ts";
import { captureRelationships } from "./configuration-relationships.ts";

export async function configurationCaptureContext(tx: Transaction, expectedSchemaVersion?: number) {
  return {
    schema: await projectSchema(tx, expectedSchemaVersion),
    projectRevision: await tx.headRevision(),
    evidenceRevision: await tx.impactEvidenceRevision(),
  };
}

async function captureContent(
  tx: Transaction,
  input: ExactConfigurationInput,
  members: PinnedEntity[],
) {
  const content: NonNullable<Configuration["capture"]>["content"] = [];
  const ids = new Set(members.map((p) => p.entity.id));
  for (const selection of input.content) {
    ensure(
      ids.has(selection.entityId),
      "validation",
      "Content must belong to a selected native member",
    );
    const observation =
      selection.observationId === null
        ? null
        : await tx.getEvidence("observation", selection.observationId);
    ensure(
      observation !== undefined && (!observation || observation.entityId === selection.entityId),
      "validation",
      "Content observation must identify the selected member",
    );
    content.push({
      entityId: selection.entityId,
      observation,
      ...(selection.reason === undefined ? {} : { reason: selection.reason }),
    });
  }
  for (const pin of members) {
    const external =
      pin.entity.resource?.source || (await tx.getEvidence("external", pin.entity.id));
    ensure(
      !external || content.some((s) => s.entityId === pin.entity.id),
      "validation",
      "External members need an explicit observation or explained unknown content state",
    );
  }
  return content;
}
export async function captureExactConfiguration(
  tx: Transaction,
  input: ExactConfigurationInput,
  actor: Provenance,
): Promise<Configuration> {
  const previous = await tx.getConfiguration(input.id);
  if (previous) {
    validateConfigurationCapture(previous);
    ensure(
      previous.capture &&
        canonical({
          input: previous.capture.intent,
          actor: {
            actor: previous.actor,
            ...(previous.reason === undefined ? {} : { reason: previous.reason }),
          },
        }) === canonical({ input, actor }),
      "conflict",
      "Configuration identity belongs to different capture intent or provenance",
    );
    return previous;
  }
  const context = await configurationCaptureContext(tx, input.expectedSchemaVersion),
    { projectRevision: head, evidenceRevision: evidence } = context;
  expectProjectRevision(head, input.expectedProjectRevision);
  expectEvidenceRevision(evidence, input.expectedEvidenceRevision);
  const subject = await tx.get("entity", input.subjectId);
  ensure(
    subject && subject.version === input.expectedSubjectVersion,
    "conflict",
    "Configuration subject changed before capture",
  );
  const members = await configurationMembers(tx, input.members, true),
    relationships = await captureRelationships(tx, input.relationships, members),
    content = await captureContent(tx, input, members);
  const value: Configuration = {
    ...actor,
    id: input.id,
    at: new Date().toISOString(),
    name: input.name.trim(),
    subject,
    members,
    relationships,
    capture: {
      contract: "configuration_capture",
      version: 1,
      intent: input,
      context,
      content,
    },
  };
  validateConfigurationCapture(value);
  await tx.appendConfiguration(value);
  return value;
}
