import { EvaluationExecutor } from "./evaluation-executor.ts";
import { ensure, json, record } from "../core/model.ts";
import type { Provenance } from "../core/model.ts";
import type { EvaluationResult } from "../core/evaluation-command.ts";
import type { ReceiptInput } from "../core/evidence.ts";
import type { Operation } from "./commands.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { changesetLimits } from "../core/command-limits.ts";
import { changesetCommandId } from "./changeset-command.ts";
import { prepareReceipt } from "./receipt-capture.ts";

export type EvaluationCommand = {
  commandId: string;
  expectedSchemaVersion: number;
  expectedProjectRevision?: number;
  expectedEvidenceRevision?: number;
  operations: Operation[];
  receipt: ReceiptInput;
};
function prepare(input: EvaluationCommand) {
  input = snapshotInput(input);
  ensure(
    record(input) &&
      json(input) &&
      Object.keys(input).every((key) =>
        [
          "commandId",
          "expectedSchemaVersion",
          "expectedProjectRevision",
          "expectedEvidenceRevision",
          "operations",
          "receipt",
        ].includes(key),
      ),
    "validation",
    "Invalid evaluation command",
  );
  changesetCommandId(input.commandId);
  ensure(
    Number.isSafeInteger(input.expectedSchemaVersion) &&
      input.expectedSchemaVersion > 0 &&
      Array.isArray(input.operations) &&
      input.operations.length <= changesetLimits.maxOperations,
    "validation",
    "Evaluation needs a schema version and 0–1000 native operations",
  );
  input.receipt = prepareReceipt(input.receipt);
  return input;
}

/** One guarded application boundary over native and evidence protocols. No external IO or implicit retry. */
export class Evaluations {
  private executor: EvaluationExecutor;
  constructor(executor: EvaluationExecutor) {
    this.executor = executor;
  }
  async commit(input: EvaluationCommand, origin: Provenance): Promise<EvaluationResult> {
    input = prepare(input);
    return this.executor.execute(input, origin, async (_tx, request) => request);
  }
  /** Null is absence of visible success, not proof an in-flight command failed. */
  getOutcome(commandId: string): Promise<EvaluationResult | null> {
    return this.executor.getOutcome(commandId);
  }
}
