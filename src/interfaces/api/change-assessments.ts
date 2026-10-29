import { record } from "../../core/model.ts";
import type { ChangeAssessments } from "../../application/change-assessments.ts";
import { array, fields, literal, number, optional, text } from "../decode.ts";
import { write } from "./definition.ts";
import { strictObject } from "./input.ts";
import { evaluation } from "./evaluations.ts";
import type { OpenChangeAssessment } from "../../core/change-assessment.ts";
import type { RefreshChangeAssessment } from "../../core/change-assessment.ts";
import { parseChangeAssessmentModel } from "../../core/application-model.ts";
import { parseAssessmentScope } from "../../core/assessment-scope-validation.ts";
import { canonical } from "../../core/evidence.ts";

const baselineQuery = strictObject({
  baselineId: text,
  rootId: text,
  direction: literal("incoming", "outgoing", "both"),
  relationshipTypes: array(text),
  depth: optional(number),
});
const pairQuery = strictObject({
  source: literal("configuration_pair"),
  beforeId: text,
  afterId: text,
  policy: literal("scoped-reference-dependencies-v1"),
  rootId: text,
  direction: literal("incoming", "outgoing", "both"),
  relationshipTypes: array(text),
  depth: optional(number),
});
function assessmentQuery(value: unknown): OpenChangeAssessment["query"] {
  return record(value) && value.source === "configuration_pair"
    ? pairQuery(value)
    : baselineQuery(value);
}
function openingSource(result: ReturnType<typeof evaluation>, input: OpenChangeAssessment) {
  const captured = result.receipt.inputs.find(
    (x) => x.entityId === input.model.entityId && x.entity.version === input.model.version,
  );
  if (!captured) throw Error("Assessment opening has no selected interpretation model");
  const model = parseChangeAssessmentModel(captured.entity.fields[input.model.field]);
  const scope = parseAssessmentScope(result.receipt.output.fields[model.assessment.fields.scope]);
  const query = {
    ...input.query,
    relationshipTypes: [...input.query.relationshipTypes].sort(),
    depth: input.query.depth ?? 2,
  };
  if (
    canonical(scope.query) !== canonical(query) ||
    scope.purpose !== input.purpose ||
    scope.basis.projectRevision !== input.expectedProjectRevision ||
    scope.basis.evidenceRevision !== input.expectedEvidenceRevision ||
    scope.basis.schemaVersion !== input.expectedSchemaVersion ||
    (scope.version === 2 && !scope.control) ||
    (scope.control &&
      (scope.control.commandId !== input.commandId ||
        scope.control.openingCommandId !== input.commandId))
  )
    throw Error("Assessment opening belongs to another captured source or context");
}

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
  if (input) openingSource(result, input);
  return result;
}

export const changeAssessmentWrites = {
  "/api/change-assessments/refresh": write(
    {
      commandId: text,
      assessmentId: text,
      openingCommandId: text,
      expectedSchemaVersion: number,
      expectedProjectRevision: number,
      expectedEvidenceRevision: number,
      expectedAssessmentVersion: number,
      reason: text,
    },
    (value: unknown, input?: RefreshChangeAssessment) => {
      const result = evaluation(value, input);
      if (
        !result.native ||
        result.native.results.length !== 1 ||
        result.native.results[0].id !== result.receipt.output.id ||
        (input &&
          (result.receipt.output.id !== input.assessmentId ||
            result.receipt.output.version !== input.expectedAssessmentVersion + 1 ||
            result.native.changeset.projectRevision !== input.expectedProjectRevision + 1))
      )
        throw Error("Refresh result does not match its command");
      return result;
    },
    {
      features: [
        "change-assessment-scope-refresh",
        "atomic-evaluation-commands",
        "evidence-revision-guards",
      ],
    },
  )(({ tracer, provenance }, input) => {
    const assessments: ChangeAssessments = tracer.changeAssessments;
    return assessments.refresh(input, provenance);
  }),
  "/api/change-assessments/open": write(
    {
      commandId: text,
      assessmentId: text,
      title: text,
      purpose: text,
      model: strictObject({ entityId: text, version: number, field: text }),
      query: assessmentQuery,
      additionalFields: fields,
      expectedSchemaVersion: number,
      expectedProjectRevision: number,
      expectedEvidenceRevision: number,
    },
    opened,
    {
      features: [
        "change-assessment-opening",
        "configuration-pair-assessments",
        "atomic-evaluation-commands",
        "evidence-revision-guards",
      ],
    },
  )(({ tracer, provenance }, input) => {
    const assessments: ChangeAssessments = tracer.changeAssessments;
    return assessments.open(input, provenance);
  }),
};
