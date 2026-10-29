import type {
  VerificationMutation,
  SelectVerificationResults,
  ReviseVerificationBasis,
  ReviewVerificationSupport,
} from "../core/verification-lifecycle.ts";
import {
  prepareVerificationMutation,
  prepareVerificationResults,
  prepareVerificationRevision,
  prepareVerificationSupportReview,
} from "./verification-inputs.ts";
import { analyzeVerification } from "./verification-analysis.ts";
import {
  selectVerificationResults,
  concludeVerification,
  reopenVerification,
} from "./verification-results.ts";
import { reviseVerificationBasis } from "./verification-revise.ts";
import type { ApplicationModelPin } from "../core/application-model.ts";
import type { PrepareVerificationBasis } from "../core/verification-basis.ts";
import type { Repository } from "./ports/repository.ts";
import { prepareModelPin } from "./application-models.ts";
import { resolveVerificationModel } from "./verification-models.ts";
import { prepareVerificationBasis, resolveVerificationBasis } from "./verification-basis.ts";
import {
  prepareVerificationOpening,
  prepareVerificationExecution,
  prepareVerificationSelection,
} from "./verification-inputs.ts";
import type {
  OpenVerificationCase,
  RecordVerificationExecution,
  VerificationSelection,
} from "../core/verification-case.ts";
import type { Provenance } from "../core/model.ts";
import { EvaluationExecutor } from "./evaluation-executor.ts";
import { openVerificationCase } from "./verification-open.ts";
import { recordVerificationExecution } from "./verification-execute.ts";
import { verificationContext } from "./verification-context.ts";
import { readVerificationExecution } from "./verification-execution-read.ts";
import { ensure } from "../core/model.ts";
import { verificationText } from "../core/verification-criteria.ts";
import { validateProvenance } from "../core/model.ts";
import { reviewVerificationSupport } from "./verification-review-support.ts";

/** Shared verification meaning. Native storage, evidence and transport retain their own contracts. */
export class Verification {
  private repository: Repository;
  private executor: EvaluationExecutor;
  constructor(repository: Repository, executor: EvaluationExecutor) {
    this.repository = repository;
    this.executor = executor;
  }
  async resolveModel(input: ApplicationModelPin) {
    input = prepareModelPin(input);
    return this.repository.transaction((tx) => resolveVerificationModel(tx, input), {
      readOnly: true,
    });
  }
  async prepareBasis(input: PrepareVerificationBasis) {
    input = prepareVerificationBasis(input);
    return this.repository.transaction((tx) => resolveVerificationBasis(tx, input), {
      readOnly: true,
    });
  }
  async open(input: OpenVerificationCase, actor: Provenance) {
    input = prepareVerificationOpening(input);
    return this.executor.execute(input, actor, openVerificationCase, "verification.open");
  }
  async recordExecution(input: RecordVerificationExecution, actor: Provenance) {
    input = prepareVerificationExecution(input);
    return this.executor.execute(input, actor, recordVerificationExecution, "verification.execute");
  }
  async analyze(input: VerificationSelection) {
    input = prepareVerificationSelection(input);
    return this.repository.transaction(
      async (tx) => (await analyzeVerification(tx, input)).analysis,
      { readOnly: true },
    );
  }
  async selectResults(input: SelectVerificationResults, actor: Provenance) {
    input = prepareVerificationResults(input);
    return this.executor.execute(input, actor, selectVerificationResults, "verification.select");
  }
  async conclude(input: VerificationMutation, actor: Provenance) {
    input = prepareVerificationMutation(input);
    return this.executor.execute(input, actor, concludeVerification, "verification.conclude");
  }
  async reopen(input: VerificationMutation, actor: Provenance) {
    input = prepareVerificationMutation(input);
    return this.executor.execute(input, actor, reopenVerification, "verification.reopen");
  }
  async reviseBasis(input: ReviseVerificationBasis, actor: Provenance) {
    input = prepareVerificationRevision(input);
    return this.executor.execute(input, actor, reviseVerificationBasis, "verification.revise");
  }
  async reviewSupport(input: ReviewVerificationSupport, actor: Provenance) {
    input = prepareVerificationSupportReview(input);
    const origin = validateProvenance(actor);
    return this.executor.execute(
      input,
      origin,
      (tx, request) => reviewVerificationSupport(tx, request, origin),
      "verification.review_support",
    );
  }
  async get(input: VerificationSelection) {
    input = prepareVerificationSelection(input);
    return this.repository.transaction(async (tx) => (await verificationContext(tx, input)).view, {
      readOnly: true,
    });
  }
  async locate(caseId: string) {
    verificationText(caseId, 200);
    return this.repository.transaction(
      async (tx) => {
        const first = (await tx.evidence("receipt", { subject: caseId, limit: 1 })).items[0];
        const commandId = first && (await tx.evaluationCommandForReceipt(first.id));
        ensure(commandId, "not_found", "No controlled verification opening found");
        return (await verificationContext(tx, { caseId, openingCommandId: commandId })).view;
      },
      { readOnly: true },
    );
  }
  async execution(input: VerificationSelection, executionId: string) {
    input = prepareVerificationSelection(input);
    verificationText(executionId, 200);
    return this.repository.transaction((tx) => readVerificationExecution(tx, input, executionId), {
      readOnly: true,
    });
  }
}
