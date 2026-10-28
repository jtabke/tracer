import type { ChangeAssessments } from "../../application/change-assessments.ts";
import { array, fields, literal, number, optional, text } from "../decode.ts";
import { write } from "./definition.ts";
import { strictObject } from "./input.ts";
import { evaluation } from "./evaluations.ts";
import type { OpenChangeAssessment } from "../../core/change-assessment.ts";

function opened(value: unknown, input?: OpenChangeAssessment) {
  const result = evaluation(value, input);
  if (
    !result.native ||
    result.native.results.length !== 1 ||
    result.native.results[0].id !== result.receipt.output.id ||
    result.receipt.output.version !== 1 ||
    (input &&
      (result.receipt.output.id !== input.assessmentId ||
        result.native.changeset.projectRevision !== input.expectedProjectRevision + 1))
  )
    throw Error("Assessment result does not match its opening command");
  return result;
}

export const changeAssessmentWrites = {
  "/api/change-assessments/open": write(
    {
      commandId: text,
      assessmentId: text,
      title: text,
      purpose: text,
      model: strictObject({ entityId: text, version: number, field: text }),
      query: strictObject({
        baselineId: text,
        rootId: text,
        direction: literal("incoming", "outgoing", "both"),
        relationshipTypes: array(text),
        depth: optional(number),
      }),
      additionalFields: fields,
      expectedSchemaVersion: number,
      expectedProjectRevision: number,
      expectedEvidenceRevision: number,
    },
    opened,
    {
      features: [
        "change-assessment-opening",
        "atomic-evaluation-commands",
        "evidence-revision-guards",
      ],
    },
  )(({ tracer, provenance }, input) => {
    const assessments: ChangeAssessments = tracer.changeAssessments;
    return assessments.open(input, provenance);
  }),
};
