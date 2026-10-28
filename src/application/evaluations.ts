import { ensure, json, record, validateProvenance } from "../core/model.ts";
import type { Provenance, SchemaObject } from "../core/model.ts";
import type { EvaluationResult } from "../core/evaluation-command.ts";
import { canonical } from "../core/evidence.ts";
import type { ReceiptInput } from "../core/evidence.ts";
import type { ChangesetResult, Operation } from "./commands.ts";
import type { Repository, Transaction } from "./ports/repository.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { changesetLimits } from "../core/command-limits.ts";
import { changesetCommandId } from "./changeset-command.ts";
import { expectProjectRevision } from "./version-guard.ts";
import { projectSchema } from "./native-query-support.ts";
import { prepareReceipt, captureReceipt } from "./receipt-capture.ts";

export type EvaluationCommand = {
  commandId: string;
  expectedSchemaVersion: number;
  expectedProjectRevision?: number;
  operations: Operation[];
  receipt: ReceiptInput;
};
type NativeBatch = (
  tx: Transaction,
  schema: SchemaObject,
  operations: Operation[],
  origin: Provenance,
) => Promise<ChangesetResult>;
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
  private repository: Repository;
  private nativeBatch: NativeBatch;
  private newId: () => string;
  constructor(repository: Repository, nativeBatch: NativeBatch, newId: () => string) {
    this.repository = repository;
    this.nativeBatch = nativeBatch;
    this.newId = newId;
  }
  async commit(input: EvaluationCommand, origin: Provenance): Promise<EvaluationResult> {
    const actor = validateProvenance(origin);
    input = prepare(input);
    const intent = canonical(JSON.parse(JSON.stringify({ input, provenance: actor })));
    return this.repository.transaction(async (tx) => {
      const previous = await tx.getEvaluationCommand(input.commandId);
      if (previous) {
        ensure(
          previous.intent === intent,
          "conflict",
          "Command ID belongs to a different evaluation command",
          { path: ["commandId"] },
        );
        return previous.result;
      }
      const schema = await projectSchema(tx, input.expectedSchemaVersion);
      if (input.expectedProjectRevision !== undefined)
        expectProjectRevision(await tx.headRevision(), input.expectedProjectRevision);
      const native = input.operations.length
        ? await this.nativeBatch(tx, schema, input.operations, actor)
        : null;
      const receipt = await captureReceipt(tx, input.receipt, actor, this.newId);
      const result = { commandId: input.commandId, native, receipt };
      await tx.appendEvaluationCommand(input.commandId, intent, result);
      return result;
    });
  }
  /** Null is absence of visible success, not proof an in-flight command failed. */
  async getOutcome(commandId: string): Promise<EvaluationResult | null> {
    changesetCommandId(commandId);
    return this.repository.transaction(
      async (tx) => (await tx.getEvaluationCommand(commandId))?.result ?? null,
    );
  }
}
