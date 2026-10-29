import { ensure, record, json } from "../core/model.ts";
import type { Entity } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type { EvaluationResult } from "../core/evaluation-command.ts";
import type { VerificationSelection, VerificationCaseView } from "../core/verification-case.ts";
import {
  parseVerificationScope,
  parseExecutionRegistry,
  verificationBytes,
} from "../core/verification-case-validation.ts";
import { verificationCaseLimits } from "../core/verification-case.ts";
import { pinEntity } from "./native-pins.ts";
import { resolveVerificationModel } from "./verification-models.ts";
import { expectVersion } from "./version-guard.ts";
import type { Transaction } from "./ports/repository.ts";
import { prepareVerificationOpening } from "./verification-inputs.ts";
import type { OpenVerificationCase } from "../core/verification-case.ts";
import {
  parseVerificationResultSelection,
  parseVerificationConclusion,
} from "../core/verification-lifecycle-validation.ts";
import type { VerificationCaseScope } from "../core/verification-case.ts";

export async function verificationCommand(
  tx: Transaction,
  commandId: string,
  selection: VerificationSelection,
) {
  const stored = await tx.getEvaluationCommand(commandId);
  ensure(stored, "not_found", "Verification command not found");
  const intent: unknown = JSON.parse(stored.intent);
  ensure(record(intent) && record(intent.input), "storage", "Invalid verification command intent");
  ensure(
    [
      "verification.open",
      "verification.execute",
      "verification.select",
      "verification.conclude",
      "verification.reopen",
      "verification.revise",
    ].includes(String(intent.operation)) &&
      intent.input.caseId === selection.caseId &&
      (intent.operation === "verification.open"
        ? commandId === selection.openingCommandId
        : intent.input.openingCommandId === selection.openingCommandId),
    "conflict",
    "Command does not govern this verification case",
  );
  return { input: intent.input, result: stored.result, operation: intent.operation };
}
function controlledCase(result: EvaluationResult, caseId: string): Entity {
  const outputs =
    result.native?.results.filter((x) => x.id === caseId && "fields" in x && !("source" in x)) ??
    [];
  ensure(
    outputs.length === 1,
    "storage",
    "Verification command must retain one controlled case output",
  );
  return outputs[0] as Entity;
}
async function basisLineage(
  tx: Transaction,
  selection: VerificationSelection,
  scope: VerificationCaseScope,
  original: VerificationCaseScope,
  field: string,
) {
  const revision = scope.revisions?.at(-1);
  if (!revision) {
    ensure(
      canonical(scope.basis) === canonical(original.basis),
      "conflict",
      "Verification basis changed without a revision",
    );
    ensure(
      canonical(scope.target ?? null) === canonical(original.target ?? null),
      "conflict",
      "Verification target changed without a controlled basis revision",
    );
    return;
  }
  const command = await verificationCommand(tx, revision.commandId, selection);
  ensure(
    command.operation === "verification.revise" &&
      command.input.expectedCaseVersion === revision.caseVersion,
    "conflict",
    "Invalid verification basis revision origin",
  );
  const recorded = parseVerificationScope(
    controlledCase(command.result, selection.caseId).fields[field],
  );
  ensure(
    canonical(recorded.basis) === canonical(scope.basis) &&
      canonical(recorded.target ?? null) === canonical(scope.target ?? null) &&
      canonical(recorded.revisions) === canonical(scope.revisions),
    "conflict",
    "Verification basis does not match its controlling revision",
  );
}
function assertConclusion(
  state: string,
  closed: string,
  certificate: ReturnType<typeof parseVerificationConclusion>,
  selected: ReturnType<typeof parseVerificationResultSelection>,
  command: Awaited<ReturnType<typeof verificationCommand>>,
  scope: VerificationCaseScope,
  selection: VerificationSelection,
) {
  if (state === closed) {
    ensure(
      certificate &&
        selected &&
        command.operation === "verification.conclude" &&
        certificate.commandId === scope.control.commandId &&
        certificate.openingCommandId === selection.openingCommandId &&
        certificate.evidenceDigest === selected.evidenceDigest &&
        canonical(certificate.obligations) === canonical(selected.selections) &&
        command.result.native?.changeset.projectRevision === certificate.at.projectRevision + 1,
      "conflict",
      "Closed verification lacks a matching controlled conclusion",
    );
  } else
    ensure(certificate === null, "conflict", "Open verification cannot carry a current conclusion");
}
export async function verificationContext(
  tx: Transaction,
  selection: VerificationSelection,
  expectedVersion?: number,
) {
  const opening = await verificationCommand(tx, selection.openingCommandId, selection);
  ensure(
    opening.operation === "verification.open",
    "conflict",
    "Verification opening must be an opening operation",
  );
  const request = prepareVerificationOpening(opening.input as OpenVerificationCase);
  const model = await resolveVerificationModel(tx, request.basis.model),
    binding = model.definition.case;
  const genesis = await pinEntity(tx, selection.caseId, 1, true);
  ensure(
    canonical(genesis.entity) === canonical(opening.result.receipt.output) &&
      canonical(genesis.entity) === canonical(controlledCase(opening.result, selection.caseId)),
    "conflict",
    "Verification opening does not match native case genesis",
  );
  const entity = await tx.get("entity", selection.caseId);
  ensure(entity, "not_found", "Verification case is unavailable");
  if (expectedVersion !== undefined)
    expectVersion(entity.version, expectedVersion, false, { kind: "entity", id: entity.id });
  const scope = parseVerificationScope(entity.fields[binding.fields.basis]);
  ensure(
    scope.control.openingCommandId === selection.openingCommandId &&
      entity.type === binding.type &&
      canonical(entity.fields[binding.fields.model]) === canonical(request.basis.model),
    "conflict",
    "Verification case model/opening selection changed",
  );
  const command =
    scope.control.commandId === selection.openingCommandId
      ? opening
      : await verificationCommand(tx, scope.control.commandId, selection);
  const output = controlledCase(command.result, selection.caseId);
  ensure(
    output.version <= entity.version,
    "conflict",
    "Controlled verification version is in the future",
  );
  for (const key of ["state", "model", "basis", "executions", "selection", "conclusion"] as const) {
    const field = binding.fields[key];
    ensure(
      json(entity.fields[field]) &&
        canonical(entity.fields[field]) === canonical(output.fields[field]),
      "conflict",
      "Verification controlled fields changed outside an application command",
      { path: [field] },
    );
  }
  const original = parseVerificationScope(genesis.entity.fields[binding.fields.basis]);
  await basisLineage(tx, selection, scope, original, binding.fields.basis);
  ensure(
    canonical(scope.basis.model) === canonical(original.basis.model) &&
      scope.basis.requirement.entityId === original.basis.requirement.entityId &&
      scope.purpose === original.purpose &&
      scope.membershipId === request.membershipId,
    "conflict",
    "Verification basis changed since genesis",
  );
  const membership = await tx.get("relationship", request.membershipId),
    created = opening.result.native?.results.find((x) => x.id === request.membershipId);
  ensure(
    membership &&
      canonical(membership) === canonical(created) &&
      membership.source === scope.basis.requirement.entityId &&
      membership.target === entity.id &&
      membership.type === model.definition.relationships.requirementCase,
    "conflict",
    "Owned requirement-case membership changed or is missing",
  );
  const title = entity.fields[binding.fields.title],
    state = entity.fields[binding.fields.state];
  ensure(
    typeof title === "string" &&
      typeof state === "string" &&
      [model.definition.states.open, model.definition.states.closed].includes(state),
    "conflict",
    "Unsupported controlled verification state",
  );
  const selected = parseVerificationResultSelection(entity.fields[binding.fields.selection]);
  const certificate = parseVerificationConclusion(entity.fields[binding.fields.conclusion]);
  assertConclusion(
    state,
    model.definition.states.closed,
    certificate,
    selected,
    command,
    scope,
    selection,
  );
  const view: VerificationCaseView = {
    case: { id: entity.id, type: entity.type, version: entity.version, title, state },
    model,
    scope,
    opening: { commandId: selection.openingCommandId, receiptId: opening.result.receipt.id },
    control: {
      commandId: scope.control.commandId,
      receiptId: command.result.receipt.id,
      caseVersion: output.version,
    },
    executions: parseExecutionRegistry(entity.fields[binding.fields.executions]),
  };
  verificationBytes(view, verificationCaseLimits.viewBytes);
  return { entity, view, selected, certificate };
}
