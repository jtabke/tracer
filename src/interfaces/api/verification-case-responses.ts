import { record } from "../../core/model.ts";
import { canonical } from "../../core/evidence.ts";
import { parseVerificationModel } from "../../core/verification-model.ts";
import {
  parseVerificationScope,
  parseVerificationExecution,
  parseExecutionRegistry,
  verificationBytes,
} from "../../core/verification-case-validation.ts";
import { verificationCaseLimits } from "../../core/verification-case.ts";
import type {
  VerificationSelection,
  VerificationCaseView,
  VerificationExecutionView,
  OpenVerificationCase,
  RecordVerificationExecution,
} from "../../core/verification-case.ts";
import { boolean, integer, literal, nullable, object, text } from "../decode.ts";
import { verificationModelResponse } from "./verification-models.ts";
import { evaluation } from "./evaluations.ts";
import type { EvaluationResult } from "../../core/evaluation-command.ts";

function same(actual: unknown, expected: unknown, message: string) {
  if (canonical(actual) !== canonical(expected)) throw Error(message);
}
function matches(actual: object, expected: Record<string, unknown>, message: string) {
  for (const [key, value] of Object.entries(expected))
    same((actual as Record<string, unknown>)[key], value, message + ": " + key);
}
const caseView = object({
  case: object({ id: text, type: text, version: integer(1), title: text, state: text }),
  scope: parseVerificationScope,
  opening: object({ commandId: text, receiptId: text }),
  control: object({ commandId: text, receiptId: text, caseVersion: integer(1) }),
  executions: parseExecutionRegistry,
});
export function verificationCaseResponse(
  value: unknown,
  input: VerificationSelection,
): VerificationCaseView {
  verificationBytes(value, verificationCaseLimits.viewBytes);
  const decoded = caseView(value);
  if (!record(value) || !record(value.model)) throw Error("Missing verification model");
  const model = verificationModelResponse(value.model, decoded.scope.basis.model),
    basis = decoded.scope.basis;
  matches(
    decoded.case,
    { id: input.caseId, type: model.definition.case.type, state: model.definition.states.open },
    "Verification case selection",
  );
  matches(decoded.opening, { commandId: input.openingCommandId }, "Verification opening");
  matches(
    decoded.scope.control,
    { openingCommandId: input.openingCommandId, commandId: decoded.control.commandId },
    "Verification control",
  );
  if (decoded.control.caseVersion > decoded.case.version)
    throw Error("Future verification control");
  for (const clock of ["projectRevision", "schemaVersion", "evidenceRevision"] as const)
    if (basis.at[clock] > model.context[clock]) throw Error("Future verification basis context");
  same(
    Object.keys(basis.requirement.acceptance).sort(),
    [...model.definition.requirement.fields.acceptance].sort(),
    "Verification acceptance fields",
  );
  for (const method of basis.methods)
    same(
      method.relationship.type,
      model.definition.relationships.requirementMethod,
      "Verification method link type",
    );
  return { ...decoded, model };
}
const state = object({
  receiptId: text,
  state: literal("current", "changed", "unknown"),
  hasChanged: boolean,
  hasUnknown: boolean,
  supersededByCount: integer(),
});
const executionView = object({
  caseId: text,
  openingCommandId: text,
  execution: object({
    id: text,
    type: text,
    recordedVersion: integer(1),
    currentVersion: nullable(integer(1)),
    title: text,
  }),
  receiptId: text,
  membership: object({ id: text, currentVersion: nullable(integer(1)), current: boolean }),
  data: parseVerificationExecution,
  comparison: object({ record: state, source: nullable(state) }),
});
export function verificationExecutionResponse(
  value: unknown,
  input: VerificationSelection & { executionId: string },
): VerificationExecutionView {
  verificationBytes(value, verificationCaseLimits.viewBytes);
  const result = executionView(value);
  matches(
    result,
    { caseId: input.caseId, openingCommandId: input.openingCommandId },
    "Verification execution selection",
  );
  matches(
    result.execution,
    { id: input.executionId, recordedVersion: 1 },
    "Verification execution identity",
  );
  matches(
    result.data,
    {
      caseId: input.caseId,
      openingCommandId: input.openingCommandId,
      membershipId: result.membership.id,
    },
    "Verification execution data",
  );
  same(result.comparison.record.receiptId, result.receiptId, "Verification comparison receipt");
  const original =
    result.data.source.kind === "prior_receipt" ? result.data.source.receiptId : null;
  same(result.comparison.source?.receiptId ?? null, original, "Original execution source");
  if (result.membership.current && result.membership.currentVersion !== 1)
    throw Error("Invalid current execution membership");
  for (const comparison of [
    result.comparison.record,
    ...(result.comparison.source ? [result.comparison.source] : []),
  ])
    same(
      comparison.state,
      comparison.hasUnknown ? "unknown" : comparison.hasChanged ? "changed" : "current",
      "Contradictory verification input state",
    );
  return result;
}
function resultModel(result: EvaluationResult) {
  const captured = result.receipt.inputs.find(
    (x) => x.role === "verification interpretation model",
  );
  if (!captured || captured.facet !== "native" || captured.fields?.length !== 1)
    throw Error("Missing captured verification model");
  return {
    definition: parseVerificationModel(captured.entity.fields[captured.fields[0]]),
    pin: {
      entityId: captured.entityId,
      version: captured.entity.version,
      field: captured.fields[0],
    },
  };
}
function nativeResults(result: EvaluationResult, count: number) {
  if (!result.native || result.native.results.length !== count)
    throw Error("Verification native operation count");
  same(
    result.native.results[0],
    result.receipt.output,
    "Verification native/captured output mismatch",
  );
  return result.native;
}
export function openedVerificationResponse(value: unknown, input?: OpenVerificationCase) {
  verificationBytes(value, verificationCaseLimits.responseBytes);
  const result = evaluation(value, input),
    { definition, pin } = resultModel(result);
  const native = nativeResults(result, 2),
    fields = definition.case.fields,
    output = result.receipt.output,
    scope = parseVerificationScope(output.fields[fields.basis]);
  matches(output, { version: 1, type: definition.case.type }, "Verification opening output");
  matches(
    output.fields,
    {
      [fields.state]: definition.states.open,
      [fields.model]: pin,
      [fields.executions]: [],
      [fields.selection]: null,
      [fields.conclusion]: null,
    },
    "Verification initial fields",
  );
  matches(
    scope.control,
    { commandId: result.commandId, openingCommandId: result.commandId },
    "Verification opening control",
  );
  matches(
    native.results[1],
    {
      id: scope.membershipId,
      type: definition.relationships.requirementCase,
      source: scope.basis.requirement.entityId,
      target: output.id,
      version: 1,
    },
    "Verification opening membership",
  );
  if (input) {
    matches(output, { id: input.caseId }, "Verification requested case");
    matches(
      scope,
      { membershipId: input.membershipId, purpose: input.purpose },
      "Verification requested scope",
    );
    same(pin, input.basis.model, "Verification requested model");
    same(
      native.changeset.projectRevision,
      input.expectedProjectRevision + 1,
      "Verification opening revision",
    );
    matches(scope.basis.requirement, input.basis.requirement, "Verification requirement basis");
    same(scope.basis.criteria, input.basis.criteria, "Verification requested criteria");
    matches(scope.basis.coverage, input.basis.coverage, "Verification source declaration");
    same(
      scope.basis.methods.map((method) => ({
        entityId: method.entityId,
        version: method.version,
        relationship: { id: method.relationship.id, version: method.relationship.version },
        criterionIds: method.criterionIds,
      })),
      input.basis.methods,
      "Verification requested methods",
    );
    matches(
      output.fields,
      { ...input.additionalFields, [fields.title]: input.title },
      "Verification requested fields",
    );
  }
  return result;
}
export function recordedVerificationResponse(value: unknown, input?: RecordVerificationExecution) {
  verificationBytes(value, verificationCaseLimits.responseBytes);
  const result = evaluation(value, input),
    { definition } = resultModel(result),
    output = result.receipt.output;
  const native = nativeResults(result, 3),
    data = parseVerificationExecution(output.fields[definition.execution.fields.data]);
  matches(output, { version: 1, type: definition.execution.type }, "Verification execution output");
  same(data.commandId, result.commandId, "Verification execution command");
  matches(
    native.results[1],
    {
      id: data.membershipId,
      source: data.caseId,
      target: output.id,
      type: definition.relationships.caseExecution,
      version: 1,
    },
    "Verification execution membership",
  );
  const caseOutput = native.results[2];
  if (!("fields" in caseOutput)) throw Error("Missing verification case output");
  matches(
    caseOutput,
    { id: data.caseId, type: definition.case.type },
    "Verification execution case",
  );
  const scope = parseVerificationScope(caseOutput.fields[definition.case.fields.basis]),
    registry = parseExecutionRegistry(caseOutput.fields[definition.case.fields.executions]);
  matches(
    scope.control,
    { commandId: result.commandId, openingCommandId: data.openingCommandId },
    "Verification execution control",
  );
  if (
    !registry.some(
      (x) =>
        x.executionId === output.id &&
        x.commandId === result.commandId &&
        x.membershipId === data.membershipId,
    )
  )
    throw Error("Execution registry mismatch");
  if (input) {
    same(output.id, input.executionId, "Requested execution identity");
    matches(
      data,
      {
        caseId: input.caseId,
        openingCommandId: input.openingCommandId,
        methodId: input.methodId,
        membershipId: input.membershipId,
        basisVersion: input.expectedCaseVersion,
        results: input.results,
        conditions: input.conditions,
      },
      "Requested execution data",
    );
    matches(data.source, input.source, "Requested execution source");
    same(caseOutput.version, input.expectedCaseVersion + 1, "Requested case version");
    same(
      native.changeset.projectRevision,
      input.expectedProjectRevision + 1,
      "Requested execution revision",
    );
    matches(
      output.fields,
      { ...input.additionalFields, [definition.execution.fields.title]: input.title },
      "Requested execution fields",
    );
  }
  return result;
}
