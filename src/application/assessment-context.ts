import { expectVersion } from "./version-guard.ts";
import { parseAssessmentClosure } from "../core/assessment-closure.ts";
import { ensure, json, knownProperties, record } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { parseAssessmentScope } from "../core/assessment-scope-validation.ts";
import type { AssessmentSelection, ChangeAssessmentView } from "../core/change-assessment.ts";
import type { Transaction } from "./ports/repository.ts";
import { changesetCommandId } from "./changeset-command.ts";
import { pinEntity } from "./native-pins.ts";
import { prepareModelPin, resolveApplicationModel } from "./application-models.ts";

export function prepareAssessmentSelection(input: AssessmentSelection) {
  input = snapshotInput(input);
  ensure(record(input), "validation", "Select an assessment and its opening command");
  knownProperties(input, ["assessmentId", "openingCommandId"]);
  changesetCommandId(input.openingCommandId);
  ensure(
    typeof input.assessmentId === "string" &&
      input.assessmentId.length > 0 &&
      input.assessmentId.length <= 200,
    "validation",
    "Select an assessment identity",
  );
  return input;
}
async function command(
  tx: Transaction,
  commandId: string,
  selection: AssessmentSelection,
  opening: boolean,
) {
  const stored = await tx.getEvaluationCommand(commandId);
  ensure(stored, "not_found", "Assessment application command not found");
  const intent: unknown = JSON.parse(stored.intent);
  ensure(record(intent) && record(intent.input), "storage", "Invalid assessment command intent");
  ensure(
    (opening
      ? intent.operation === "change-assessment.open"
      : [
          "change-assessment.refresh",
          "change-assessment.disposition",
          "change-assessment.close",
          "change-assessment.reopen",
        ].includes(String(intent.operation))) &&
      intent.input.assessmentId === selection.assessmentId &&
      (opening || intent.input.openingCommandId === selection.openingCommandId),
    "conflict",
    "Command does not govern this assessment",
  );
  ensure(
    stored.result.receipt.output.id === selection.assessmentId,
    "storage",
    "Assessment command output mismatch",
  );
  return { intent: intent.input, result: stored.result };
}

/** Direct journal lookups, not a search through historical receipts or authored status values. */
export async function assessmentContext(
  tx: Transaction,
  selection: AssessmentSelection,
  expectedVersion?: number,
) {
  const opening = await command(tx, selection.openingCommandId, selection, true);
  ensure(record(opening.intent.model), "storage", "Opening model selection is missing");
  const pin = prepareModelPin(
    opening.intent.model as import("../core/application-model.ts").ApplicationModelPin,
  );
  const model = await resolveApplicationModel(tx, pin),
    binding = model.definition.assessment;
  const genesis = await pinEntity(tx, selection.assessmentId, 1, true);
  ensure(
    canonical(genesis.entity) === canonical(opening.result.receipt.output),
    "conflict",
    "Opening command does not match assessment genesis",
  );
  const entity = await tx.get("entity", selection.assessmentId);
  ensure(entity, "not_found", "Assessment is unavailable");
  if (expectedVersion !== undefined)
    expectVersion(entity.version, expectedVersion, false, { kind: "entity", id: entity.id });
  ensure(
    entity.type === binding.type &&
      canonical(entity.fields[binding.fields.model]) === canonical(pin),
    "conflict",
    "Assessment model selection changed since genesis",
  );
  const scope = parseAssessmentScope(entity.fields[binding.fields.scope]);
  ensure(
    scope.control === undefined || scope.control.openingCommandId === selection.openingCommandId,
    "conflict",
    "Scope belongs to a different opening command",
  );
  const controlId = scope.control?.commandId ?? selection.openingCommandId;
  const control =
    controlId === selection.openingCommandId
      ? opening
      : await command(tx, controlId, selection, false);
  ensure(
    control.result.receipt.output.version <= entity.version,
    "conflict",
    "Controlled assessment version is in the future",
  );
  for (const role of ["model", "scope", "state", "closure"] as const) {
    const name = binding.fields[role];
    ensure(
      json(entity.fields[name]) &&
        canonical(entity.fields[name]) === canonical(control.result.receipt.output.fields[name]),
      "conflict",
      "Assessment controlled fields changed outside an application command",
      { path: [name] },
    );
  }
  const original = parseAssessmentScope(genesis.entity.fields[binding.fields.scope]);
  ensure(
    canonical(scope.query) === canonical(original.query) &&
      scope.purpose === original.purpose &&
      scope.discovery.excludedReceiptOutputId === selection.assessmentId,
    "conflict",
    "Assessment discovery contract changed since genesis",
  );
  const title = entity.fields[binding.fields.title],
    state = entity.fields[binding.fields.state];
  ensure(
    typeof title === "string" && typeof state === "string",
    "validation",
    "Invalid assessment presentation fields",
  );
  const view: ChangeAssessmentView = {
    assessment: { id: entity.id, type: entity.type, version: entity.version, title, state },
    model,
    opening: { commandId: selection.openingCommandId, receiptId: opening.result.receipt.id },
    control: {
      commandId: controlId,
      receiptId: control.result.receipt.id,
      assessmentVersion: control.result.receipt.output.version,
    },
    scope,
  };
  const certificate =
    state === model.definition.states.closed
      ? parseAssessmentClosure(
          entity.fields[binding.fields.closure],
          scope,
          controlId,
          selection.openingCommandId,
        )
      : null;
  if (certificate)
    ensure(
      control.result.native?.changeset.projectRevision === certificate.at.projectRevision + 1,
      "conflict",
      "Closure context does not match its committed revision",
    );
  return { entity, view, certificate };
}
