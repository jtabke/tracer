import { parseAssessmentScope } from "../../core/assessment-scope-validation.ts";
import { changeAssessmentLimits } from "../../core/change-assessment.ts";
import type { AssessmentSelection, ChangeAssessmentView } from "../../core/change-assessment.ts";
import { integer, object, text } from "../decode.ts";
import { read } from "./definition.ts";
import * as q from "./query.ts";
import { applicationModelResponse } from "./application-models.ts";
import { record } from "../../core/model.ts";
import type { ApplicationModelPin } from "../../core/application-model.ts";
import type { ChangeAssessments } from "../../application/change-assessments.ts";

const view = object({
  assessment: object({ id: text, type: text, version: integer(1), title: text, state: text }),
  opening: object({ commandId: text, receiptId: text }),
  control: object({ commandId: text, receiptId: text, assessmentVersion: integer(1) }),
  scope: parseAssessmentScope,
});
function response(value: unknown, input: AssessmentSelection): ChangeAssessmentView {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > changeAssessmentLimits.viewBytes)
    throw Error("Assessment view exceeds 256 KiB");
  const decoded = view(value);
  if (!record(value) || !record(value.model) || !record(value.model.pin))
    throw Error("Missing assessment model");
  const model = applicationModelResponse(value.model, value.model.pin as ApplicationModelPin);
  if (
    decoded.assessment.id !== input.assessmentId ||
    decoded.opening.commandId !== input.openingCommandId ||
    decoded.scope.discovery.excludedReceiptOutputId !== input.assessmentId ||
    decoded.control.commandId !== (decoded.scope.control?.commandId ?? input.openingCommandId) ||
    decoded.control.assessmentVersion > decoded.assessment.version ||
    model.context.projectRevision < decoded.scope.basis.projectRevision ||
    model.context.schemaVersion < decoded.scope.basis.schemaVersion ||
    model.context.evidenceRevision < decoded.scope.basis.evidenceRevision ||
    decoded.assessment.type !== model.definition.assessment.type ||
    decoded.assessment.state !== model.definition.states.open
  )
    throw Error("Assessment view does not match its selection or controlled context");
  return { ...decoded, model };
}
export const assessmentReads = {
  "/api/change-assessment": read({
    features: ["change-assessment-scope-refresh"],
    query: q.query({ assessmentId: q.textParam, openingCommandId: q.textParam }),
    response,
    handle: ({ tracer }, input) => {
      const assessments: ChangeAssessments = tracer.changeAssessments;
      return assessments.get(input);
    },
  }),
};
