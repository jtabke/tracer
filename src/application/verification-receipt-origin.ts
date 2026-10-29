import { ensure, record } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type { Receipt } from "../core/evidence.ts";
import type { OpenVerificationCase } from "../core/verification-case.ts";
import {
  parseVerificationExecution,
  parseVerificationScope,
} from "../core/verification-case-validation.ts";
import type { Transaction } from "./ports/repository.ts";
import { verificationCommand } from "./verification-context.ts";
import { prepareVerificationOpening } from "./verification-inputs.ts";
import { resolveVerificationModel } from "./verification-models.ts";
import { pinEntity } from "./native-pins.ts";

/** Authenticate protocol-owned metadata through durable outcomes, never authored type/role labels. */
export async function verificationReceiptOrigin(tx: Transaction, receipt: Receipt) {
  const commandId = await tx.evaluationCommandForReceipt(receipt.id);
  if (!commandId) return null;
  const stored = await tx.getEvaluationCommand(commandId);
  ensure(stored, "storage", "Receipt command origin is unavailable");
  const intent: unknown = JSON.parse(stored.intent);
  ensure(record(intent), "storage", "Invalid receipt command origin");
  if (intent.operation !== "verification.execute") return null;
  ensure(
    record(intent.input) &&
      typeof intent.input.caseId === "string" &&
      typeof intent.input.openingCommandId === "string",
    "storage",
    "Invalid verification execution origin",
  );
  const selection = {
    caseId: intent.input.caseId,
    openingCommandId: intent.input.openingCommandId,
  };
  const command = await verificationCommand(tx, commandId, selection);
  ensure(
    canonical(command.result.receipt) === canonical(receipt),
    "storage",
    "Receipt differs from its controlled execution outcome",
  );
  const opening = await verificationCommand(tx, selection.openingCommandId, selection);
  ensure(
    opening.operation === "verification.open",
    "storage",
    "Execution has no controlled opening origin",
  );
  const request = prepareVerificationOpening(opening.input as OpenVerificationCase);
  const model = await resolveVerificationModel(tx, request.basis.model);
  const data = parseVerificationExecution(
    receipt.output.fields[model.definition.execution.fields.data],
  );
  ensure(
    data.commandId === commandId &&
      data.caseId === selection.caseId &&
      data.openingCommandId === selection.openingCommandId &&
      command.input.executionId === receipt.output.id,
    "storage",
    "Controlled source execution identity does not match its command",
  );
  const original = await pinEntity(tx, selection.caseId, data.basisVersion, true);
  const basis = parseVerificationScope(
    original.entity.fields[model.definition.case.fields.basis],
  ).basis;
  return {
    commandId,
    data,
    basis,
    model,
    inputOffset: data.source.kind === "prior_receipt" ? 5 : 4,
    relationshipOffset: 2,
  };
}
