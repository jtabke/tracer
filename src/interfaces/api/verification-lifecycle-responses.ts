import type {
  VerificationAnalysis,
  VerificationMutation,
  SelectVerificationResults,
  ReviseVerificationBasis,
} from "../../core/verification-lifecycle.ts";
import type { VerificationSelection } from "../../core/verification-case.ts";
import {
  verificationBytes,
  parseVerificationScope,
} from "../../core/verification-case-validation.ts";
import {
  verificationDigest,
  parseVerificationResultSelection,
  parseVerificationConclusion,
} from "../../core/verification-lifecycle-validation.ts";
import { optional, array, boolean, literal, nullable, object, text } from "../decode.ts";
import {
  verificationCaseResponse,
  resultModel,
  nativeResults,
  same,
  matches,
} from "./verification-case-responses.ts";
import { evaluation } from "./evaluations.ts";
import { record } from "../../core/model.ts";

const outcome = literal("passed", "failed", "blocked", "not_run");
const executionSummary = object({
  id: text,
  receiptId: text,
  methodId: text,
  immutableDigest: text,
  stateDigest: text,
  current: boolean,
  eligibleCriterionIds: array(text),
  priorSourceSupported: optional(boolean),
  results: array(object({ criterionId: text, currentCriterionId: nullable(text), outcome })),
  support: object({
    changed: boolean,
    unknown: boolean,
    assessed: boolean,
    reviewRequired: boolean,
    superseded: boolean,
  }),
});
const analysisBody = object({
  basis: object({
    state: literal("current", "changed", "unknown"),
    digest: text,
    reasons: array(text),
  }),
  recordedSelection: parseVerificationResultSelection,
  recordedConclusion: parseVerificationConclusion,
  executions: array(executionSummary),
  obligations: array(
    object({
      criterionId: text,
      methodId: text,
      executionId: nullable(text),
      outcome: nullable(outcome),
      applicability: literal(
        "unselected",
        "current",
        "assessed",
        "changed",
        "unknown",
        "unavailable",
        "wrong_basis",
        "superseded",
      ),
      reasons: array(text),
    }),
  ),
  proposalDigest: text,
  selection: object({
    state: literal("none", "incomplete", "stale", "current"),
    evidenceDigest: nullable(text),
    unassessedExecutionIds: array(text),
  }),
  ready: boolean,
  blockers: array(text),
  completion: object({
    state: literal("open", "verified", "needs_reassessment"),
    commandId: nullable(text),
    receiptId: nullable(text),
  }),
});
export function verificationAnalysisResponse(
  value: unknown,
  input: VerificationSelection,
): VerificationAnalysis {
  verificationBytes(value, 262144);
  if (!record(value)) throw Error("Missing verification analysis");
  const decoded = analysisBody(value),
    view = verificationCaseResponse(value.view, input);
  verificationDigest(decoded.proposalDigest);
  verificationDigest(decoded.basis.digest);
  same(
    decoded.executions.map((x) => x.id),
    view.executions.map((x) => x.executionId),
    "Verification analysis population",
  );
  if (decoded.executions.length > 100 || decoded.obligations.length > 100)
    throw Error("Verification analysis exceeds declared bounds");
  for (const item of decoded.executions) {
    verificationDigest(item.immutableDigest);
    verificationDigest(item.stateDigest);
  }
  same(
    decoded.obligations.map((x) => [x.criterionId, x.methodId]),
    view.scope.basis.methods.flatMap((m) => m.criterionIds.map((id) => [id, m.entityId])),
    "Verification obligation population",
  );
  same(
    decoded.selection.unassessedExecutionIds,
    decoded.executions
      .filter((x) => !decoded.recordedSelection?.accounting.some((a) => a.executionId === x.id))
      .map((x) => x.id),
    "Unassessed execution population",
  );
  same(decoded.ready, decoded.blockers.length === 0, "Verification readiness explanation");
  if (!decoded.recordedSelection) same(decoded.selection.state, "none", "Missing selection state");
  const closed = view.case.state === view.model.definition.states.closed;
  same(!!decoded.recordedConclusion, closed, "Verification conclusion/state");
  if (closed) {
    same(
      decoded.completion.commandId,
      decoded.recordedConclusion!.commandId,
      "Verification conclusion command",
    );
    same(decoded.completion.receiptId, view.control.receiptId, "Verification conclusion receipt");
    same(
      decoded.completion.state,
      decoded.ready && decoded.recordedConclusion!.basisDigest === decoded.basis.digest
        ? "verified"
        : "needs_reassessment",
      "Verification conclusion applicability",
    );
  } else
    matches(
      decoded.completion,
      { state: "open", commandId: null, receiptId: null },
      "Open verification completion",
    );
  return { ...decoded, view };
}
function verificationMutationResponse(value: unknown, input?: VerificationMutation) {
  verificationBytes(value, 524288);
  const result = evaluation(value, input),
    { definition, pin } = resultModel(result),
    native = nativeResults(result, 1),
    output = result.receipt.output;
  same(output.type, definition.case.type, "Verification mutation output type");
  if (input) {
    matches(
      output,
      { id: input.caseId, version: input.expectedCaseVersion + 1 },
      "Verification mutation output",
    );
    same(
      native.changeset.projectRevision,
      input.expectedProjectRevision + 1,
      "Verification mutation revision",
    );
  }
  const scope = parseVerificationScope(output.fields[definition.case.fields.basis]);
  same(scope.control.commandId, result.commandId, "Verification mutation control command");
  if (input)
    same(scope.control.openingCommandId, input.openingCommandId, "Verification opening selection");
  same(output.fields[definition.case.fields.model], pin, "Verification mutation model");
  return { result, definition, scope, fields: output.fields };
}
export function verificationSelectedResponse(value: unknown, input?: SelectVerificationResults) {
  const { result, definition, fields } = verificationMutationResponse(value, input),
    selected = parseVerificationResultSelection(fields[definition.case.fields.selection]);
  if (!selected) throw Error("Missing recorded selection");
  if (input)
    matches(
      selected,
      { reason: input.reason, selections: input.selections, accounting: input.accounting },
      "Requested result selection",
    );
  matches(
    fields,
    {
      [definition.case.fields.state]: definition.states.open,
      [definition.case.fields.conclusion]: null,
    },
    "Selected verification state",
  );
  return result;
}
export function verificationConcludedResponse(value: unknown, input?: VerificationMutation) {
  const { result, definition, fields } = verificationMutationResponse(value, input),
    certificate = parseVerificationConclusion(fields[definition.case.fields.conclusion]),
    selected = parseVerificationResultSelection(fields[definition.case.fields.selection]);
  if (!certificate || !selected) throw Error("Missing verification conclusion/selection");
  if (input)
    matches(
      certificate,
      {
        commandId: input.commandId,
        openingCommandId: input.openingCommandId,
        rationale: input.reason,
        at: {
          projectRevision: input.expectedProjectRevision,
          evidenceRevision: input.expectedEvidenceRevision,
        },
        evidenceDigest: selected.evidenceDigest,
        obligations: selected.selections,
      },
      "Requested verification conclusion",
    );
  same(
    fields[definition.case.fields.state],
    definition.states.closed,
    "Concluded verification state",
  );
  return result;
}
export function verificationReopenedResponse(value: unknown, input?: VerificationMutation) {
  const { result, definition, fields, scope } = verificationMutationResponse(value, input);
  matches(
    fields,
    {
      [definition.case.fields.state]: definition.states.open,
      [definition.case.fields.conclusion]: null,
    },
    "Reopened verification state",
  );
  if (!scope.reopened) throw Error("Missing reopening reason");
  if (input) same(scope.reopened.reason, input.reason, "Requested reopening reason");
  return result;
}
export function verificationRevisedResponse(value: unknown, input?: ReviseVerificationBasis) {
  const { result, definition, fields, scope } = verificationMutationResponse(value, input);
  matches(
    fields,
    {
      [definition.case.fields.state]: definition.states.open,
      [definition.case.fields.conclusion]: null,
      [definition.case.fields.selection]: null,
    },
    "Revised verification state",
  );
  if (!scope.revisions?.length) throw Error("Missing basis revision lineage");
  if (input) {
    if (input.targetConfigurationId !== undefined)
      same(
        scope.target?.configurationId,
        input.targetConfigurationId,
        "Requested revised verification target",
      );
    if (input.targetPolicy !== undefined)
      same(scope.target?.policy, input.targetPolicy, "Requested revised input policy");
    matches(
      scope.revisions.at(-1) ?? {},
      {
        commandId: input.commandId,
        caseVersion: input.expectedCaseVersion,
        reason: input.reason,
        mapping: input.mapping,
      },
      "Requested basis revision lineage",
    );
    same(scope.basis.model, input.basis.model, "Requested basis model");
    matches(scope.basis.requirement, input.basis.requirement, "Requested requirement revision");
    same(scope.basis.criteria, input.basis.criteria, "Requested revised criteria");
    matches(scope.basis.coverage, input.basis.coverage, "Requested revised coverage");
    same(
      scope.basis.methods.map((x) => ({
        entityId: x.entityId,
        version: x.version,
        relationship: { id: x.relationship.id, version: x.relationship.version },
        criterionIds: x.criterionIds,
      })),
      input.basis.methods,
      "Requested revised methods",
    );
  }
  return result;
}
