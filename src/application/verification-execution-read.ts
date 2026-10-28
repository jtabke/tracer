import { ensure } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type { Receipt } from "../core/evidence.ts";
import type {
  VerificationSelection,
  VerificationExecutionView,
  VerificationInputState,
  VerificationCaseView,
  VerificationExecutionRegistration,
} from "../core/verification-case.ts";
import {
  parseVerificationExecution,
  verificationBytes,
} from "../core/verification-case-validation.ts";
import { verificationCaseLimits } from "../core/verification-case.ts";
import { verificationContext, verificationCommand } from "./verification-context.ts";
import { compareCapturedInputs } from "./receipt-comparison.ts";
import type { Transaction } from "./ports/repository.ts";

async function state(tx: Transaction, receipt: Receipt): Promise<VerificationInputState> {
  const comparison = await compareCapturedInputs(tx, receipt),
    supersession = await tx.impactSupersession(receipt.id);
  return {
    receiptId: receipt.id,
    state: comparison.state,
    hasChanged: comparison.hasChanged,
    hasUnknown: comparison.hasUnknown,
    supersededByCount: supersession.count,
  };
}
export async function readVerificationExecution(
  tx: Transaction,
  selection: VerificationSelection,
  executionId: string,
): Promise<VerificationExecutionView> {
  const { view } = await verificationContext(tx, selection),
    registration = view.executions.find((x) => x.executionId === executionId);
  ensure(registration, "not_found", "Execution is outside this controlled case registry");
  const { receipt, fields, current, data, membership, recorded, source } =
    await verificationExecutionContext(tx, view, registration);
  const result: VerificationExecutionView = {
    caseId: selection.caseId,
    openingCommandId: selection.openingCommandId,
    execution: {
      id: executionId,
      type: receipt.output.type,
      recordedVersion: receipt.output.version,
      currentVersion: current?.version ?? null,
      title: String(current?.fields[fields.title] ?? receipt.output.fields[fields.title]),
    },
    receiptId: receipt.id,
    membership: {
      id: registration.membershipId,
      currentVersion: membership?.version ?? null,
      current: !!membership && canonical(membership) === canonical(recorded),
    },
    data,
    comparison: {
      record: await state(tx, receipt),
      source: source ? await state(tx, source) : null,
    },
  };
  verificationBytes(result, verificationCaseLimits.viewBytes);
  return result;
}

export async function verificationExecutionContext(
  tx: Transaction,
  view: VerificationCaseView,
  registration: VerificationExecutionRegistration,
) {
  const selection = { caseId: view.case.id, openingCommandId: view.opening.commandId },
    executionId = registration.executionId;
  const command = await verificationCommand(tx, registration.commandId, selection),
    receipt = command.result.receipt;
  ensure(
    command.operation === "verification.execute" &&
      command.input.executionId === executionId &&
      receipt.output.id === executionId,
    "conflict",
    "Execution command does not match its registered output",
  );
  const fields = view.model.definition.execution.fields,
    current = await tx.get("entity", executionId);
  ensure(
    receipt.output.type === view.model.definition.execution.type,
    "conflict",
    "Execution type does not match its governing model",
  );
  if (current)
    ensure(
      current.type === receipt.output.type &&
        canonical(current.fields[fields.data]) === canonical(receipt.output.fields[fields.data]),
      "conflict",
      "Controlled execution result changed outside its application command",
    );
  const data = parseVerificationExecution(receipt.output.fields[fields.data]);
  ensure(
    data.caseId === selection.caseId &&
      data.openingCommandId === selection.openingCommandId &&
      data.commandId === registration.commandId &&
      data.membershipId === registration.membershipId,
    "conflict",
    "Execution data does not match its case registration",
  );
  const membership = await tx.get("relationship", registration.membershipId),
    recorded = command.result.native?.results.find((x) => x.id === registration.membershipId);
  const source =
    data.source.kind === "prior_receipt"
      ? await tx.getEvidence("receipt", data.source.receiptId)
      : null;
  ensure(
    data.source.kind === "performed" || source,
    "storage",
    "Original execution source receipt is missing",
  );
  if (source) verificationBytes(source, verificationCaseLimits.priorReceiptBytes);
  return { receipt, fields, current, data, membership, recorded, source };
}
