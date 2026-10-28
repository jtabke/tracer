import { ensure, validateProvenance } from "../core/model.ts";
import type { Provenance, SchemaObject } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type { ReceiptInput } from "../core/evidence.ts";
import type { EvaluationResult } from "../core/evaluation-command.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { changesetLimits } from "../core/command-limits.ts";
import type { ChangesetResult, Operation } from "./commands.ts";
import type { Repository, Transaction } from "./ports/repository.ts";
import { changesetCommandId } from "./changeset-command.ts";
import { projectSchema } from "./native-query-support.ts";
import { expectProjectRevision, expectEvidenceRevision } from "./version-guard.ts";
import { prepareReceipt, captureReceipt } from "./receipt-capture.ts";

export type EvaluationGuards = {
  commandId: string;
  expectedSchemaVersion: number;
  expectedProjectRevision?: number;
  expectedEvidenceRevision?: number;
};
export type NativeBatch = (
  tx: Transaction,
  schema: SchemaObject,
  operations: Operation[],
  actor: Provenance,
) => Promise<ChangesetResult>;
type Composition = { operations: Operation[]; receipt: ReceiptInput };

/** Internal, fixed native-plus-receipt protocol. Application intent precedes derived writes. */
export class EvaluationExecutor {
  private repository: Repository;
  private nativeBatch: NativeBatch;
  private newId: () => string;
  constructor(repository: Repository, nativeBatch: NativeBatch, newId: () => string) {
    this.repository = repository;
    this.nativeBatch = nativeBatch;
    this.newId = newId;
  }
  async execute<T extends EvaluationGuards>(
    input: T,
    origin: Provenance,
    compose: (tx: Transaction, request: T) => Promise<Composition>,
    operation?: "change-assessment.open" | "change-assessment.refresh",
  ): Promise<EvaluationResult> {
    input = snapshotInput(input);
    const actor = validateProvenance(origin);
    changesetCommandId(input.commandId);
    ensure(
      Number.isSafeInteger(input.expectedSchemaVersion) && input.expectedSchemaVersion > 0,
      "validation",
      "Application command needs a positive schema version",
    );
    // Omit the discriminator for existing evaluation commands: persisted intent bytes are a contract.
    const intent = canonical(
      JSON.parse(JSON.stringify({ input, provenance: actor, ...(operation ? { operation } : {}) })),
    );
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
      if (input.expectedEvidenceRevision !== undefined)
        expectEvidenceRevision(await tx.impactEvidenceRevision(), input.expectedEvidenceRevision);
      const proposal = await compose(tx, input);
      ensure(
        Array.isArray(proposal.operations) &&
          proposal.operations.length <= changesetLimits.maxOperations,
        "validation",
        "Application command exceeds 1000 native operations",
      );
      const receiptInput = prepareReceipt(proposal.receipt);
      const native = proposal.operations.length
        ? await this.nativeBatch(tx, schema, proposal.operations, actor)
        : null;
      const receipt = await captureReceipt(tx, receiptInput, actor, this.newId);
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
