import type { Entity, SchemaObject } from "../../src/core/model.ts";
import type { ChangeAssessmentView } from "../../src/core/change-assessment.ts";
import { record } from "../../src/core/model.ts";
import { applicationModelChoices as choices } from "../application-choices.tsx";
export {
  AdditionalFields,
  RecordChoice,
  useApplicationDirty as useAssessmentDirty,
} from "../application-choices.tsx";
export function modelChoices(entities: Entity[], schema: SchemaObject | null) {
  return choices(entities, schema, "change_assessment");
}
export function assessmentChoices(entities: Entity[]) {
  return entities.filter((entity) =>
    Object.values(entity.fields).some(
      (value) => record(value) && value.contract === "change_assessment_scope",
    ),
  );
}
export function assessmentCommand(view: ChangeAssessmentView, reason: string) {
  return {
    assessmentId: view.assessment.id,
    openingCommandId: view.opening.commandId,
    commandId: crypto.randomUUID(),
    reason,
    expectedSchemaVersion: view.model.context.schemaVersion,
    expectedProjectRevision: view.model.context.projectRevision,
    expectedEvidenceRevision: view.model.context.evidenceRevision,
    expectedAssessmentVersion: view.assessment.version,
  };
}
