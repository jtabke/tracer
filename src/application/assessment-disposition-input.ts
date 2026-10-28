import {
  assessmentText,
  parseCandidate,
  parseActions,
  parseSupport,
} from "../core/assessment-disposition.ts";
import { ensure, json, knownProperties, record } from "../core/model.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import type {
  SetAssessmentDisposition,
  RefreshChangeAssessment,
} from "../core/change-assessment.ts";
import { prepareAssessmentSelection } from "./assessment-context.ts";
export function prepareAssessmentMutation<T extends Omit<RefreshChangeAssessment, "reason">>(
  input: T,
  extra: string[],
): T {
  input = snapshotInput(input);
  ensure(record(input) && json(input), "validation", "Invalid assessment operation");
  knownProperties(input, [
    "assessmentId",
    "openingCommandId",
    "commandId",
    "expectedSchemaVersion",
    "expectedProjectRevision",
    "expectedEvidenceRevision",
    "expectedAssessmentVersion",
    ...extra,
  ]);
  prepareAssessmentSelection({
    assessmentId: input.assessmentId,
    openingCommandId: input.openingCommandId,
  });
  for (const key of ["expectedProjectRevision", "expectedEvidenceRevision"] as const)
    ensure(
      Number.isSafeInteger(input[key]) && input[key] >= 0,
      "validation",
      "Assessment operation requires exact native/evidence guards",
    );
  ensure(
    Number.isSafeInteger(input.expectedAssessmentVersion) && input.expectedAssessmentVersion > 0,
    "validation",
    "Assessment operation requires an exact record version",
  );
  return input;
}
export function prepareDisposition(input: SetAssessmentDisposition) {
  input = prepareAssessmentMutation(input, [
    "subject",
    "dispositionId",
    "membershipId",
    "expectedDispositionVersion",
    "expectedBasisDigest",
    "title",
    "decision",
    "rationale",
    "actions",
    "support",
    "additionalFields",
  ]);
  parseCandidate(input.subject);
  assessmentText(input.dispositionId, 200);
  assessmentText(input.membershipId, 200);
  assessmentText(input.title, 200);
  assessmentText(input.rationale);
  ensure(
    Number.isSafeInteger(input.expectedDispositionVersion) &&
      input.expectedDispositionVersion >= 0 &&
      /^sha256:[a-f0-9]{64}$/.test(input.expectedBasisDigest),
    "validation",
    "Disposition requires record and assessed-basis guards",
  );
  ensure(
    ["no_action", "revise", "reverify", "investigate", "acknowledge_unknown"].includes(
      input.decision,
    ),
    "validation",
    "Invalid assessment decision",
  );
  parseActions(input.actions);
  parseSupport(input.support);
  ensure(
    record(input.additionalFields),
    "validation",
    "Provide additional disposition fields explicitly",
  );
  ensure(
    input.support.length +
      input.actions.reduce((count, action) => count + action.support.length, 0) <=
      20,
    "validation",
    "Disposition exceeds twenty supporting uses",
  );
  ensure(
    new TextEncoder().encode(JSON.stringify(input)).byteLength <= 32768,
    "validation",
    "Disposition proposal exceeds 32 KiB",
  );
  return input;
}
