import { ensure } from "../core/model.ts";
import type {
  SelectVerificationResults,
  VerificationMutation,
  VerificationResultSelection,
  VerificationConclusion,
} from "../core/verification-lifecycle.ts";
import {
  parseVerificationResultSelection,
  parseVerificationConclusion,
} from "../core/verification-lifecycle-validation.ts";
import {
  analyzeVerification,
  validateVerificationAccounting,
  verificationSelectionDigest,
} from "./verification-analysis.ts";
import {
  verificationMutationContext,
  verificationMutationFacts,
  composeVerificationMutation,
} from "./verification-mutation.ts";
import type { Transaction } from "./ports/repository.ts";

export async function selectVerificationResults(
  tx: Transaction,
  request: SelectVerificationResults,
) {
  const result = await verificationMutationContext(tx, request),
    { analysis } = result;
  validateVerificationAccounting(
    analysis.view,
    analysis.executions,
    request.selections,
    request.accounting,
  );
  const { declarations, facts } = verificationMutationFacts(
    result,
    new Set(request.selections.map((x) => x.executionId)),
  );
  const selected: VerificationResultSelection = {
    contract: "verification_result_selection",
    version: 1,
    reason: request.reason,
    selections: request.selections,
    accounting: request.accounting,
    facts,
    evidenceDigest: await verificationSelectionDigest(
      analysis.basis.digest,
      analysis.executions,
      request,
    ),
  };
  parseVerificationResultSelection(selected);
  return composeVerificationMutation(
    result,
    request,
    { [analysis.view.model.definition.case.fields.selection]: selected },
    declarations,
    "Explicit result selection and complete execution accounting recorded; no verified conclusion established",
    async (tx) => {
      const current = (await analyzeVerification(tx, request)).analysis;
      ensure(
        current.selection.state === "current",
        "conflict",
        "Selection changes its own captured support; no result selection was saved",
      );
    },
  );
}
export async function concludeVerification(tx: Transaction, request: VerificationMutation) {
  const result = await verificationMutationContext(tx, request),
    { analysis } = result,
    definition = analysis.view.model.definition;
  ensure(
    analysis.ready && analysis.recordedSelection,
    "conflict",
    "Verification cannot conclude: " + analysis.blockers.join("; "),
  );
  const { declarations } = verificationMutationFacts(
    result,
    new Set(analysis.recordedSelection.selections.map((x) => x.executionId)),
  );
  declarations.inputs.push({
    entityId: analysis.view.case.id,
    facet: "native",
    revision: analysis.view.case.version,
    fields: [definition.case.fields.selection],
    role: "explicit result selection and assessed-state references",
  });
  const certificate: VerificationConclusion = {
    contract: "verification_conclusion",
    version: 1,
    commandId: request.commandId,
    openingCommandId: request.openingCommandId,
    rationale: request.reason,
    at: {
      projectRevision: request.expectedProjectRevision,
      evidenceRevision: request.expectedEvidenceRevision,
    },
    evidenceDigest: analysis.recordedSelection.evidenceDigest,
    basisDigest: analysis.basis.digest,
    obligations: analysis.recordedSelection.selections,
  };
  parseVerificationConclusion(certificate);
  return composeVerificationMutation(
    result,
    request,
    {
      [definition.case.fields.state]: definition.states.closed,
      [definition.case.fields.conclusion]: certificate,
    },
    declarations,
    "Controlled verification conclusion: every declared obligation has an explicitly selected applicable passing execution",
    async (tx) => {
      ensure(
        (await analyzeVerification(tx, request)).analysis.completion.state === "verified",
        "conflict",
        "Conclusion changes its own supporting state; no conclusion was saved",
      );
    },
  );
}
export async function reopenVerification(tx: Transaction, request: VerificationMutation) {
  const result = await verificationMutationContext(tx, request, true),
    { view, certificate } = result.context,
    definition = view.model.definition;
  const { declarations } = verificationMutationFacts(result, new Set());
  return composeVerificationMutation(
    result,
    request,
    {
      [definition.case.fields.state]: definition.states.open,
      [definition.case.fields.conclusion]: null,
    },
    declarations,
    "Verification explicitly reopened; the original immutable conclusion and selected results remain historical",
    async (tx) => {
      ensure(
        (await analyzeVerification(tx, request)).analysis.completion.state === "open",
        "conflict",
        "Reopening did not establish an open verification",
      );
    },
    { ...view.scope, reopened: { commandId: certificate!.commandId, reason: request.reason } },
  );
}
