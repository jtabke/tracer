import { ensure } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type {
  VerificationSelection,
  VerificationExecutionRegistration,
  VerificationCaseView,
} from "../core/verification-case.ts";
import type {
  VerificationAnalysis,
  VerificationResultSelection,
  VerificationChoice,
  VerificationAccounting,
  VerificationExecutionSummary,
  VerificationObligation,
} from "../core/verification-lifecycle.ts";
import { verificationContext } from "./verification-context.ts";
import { verificationExecutionContext } from "./verification-execution-read.ts";
import {
  verificationGoverningBasis,
  verificationExecutionBasis,
} from "./verification-governing.ts";
import { verificationSupport, verificationWorkBudget } from "./verification-support.ts";
import { factDigest } from "./fact-digest.ts";
import { boundedEngineeringState } from "./engineering-state.ts";
import type { EngineeringStateReader } from "./engineering-state.ts";
import { verificationEngineeringState } from "./verification-target.ts";
import { verificationBytes } from "../core/verification-case-validation.ts";
import type { Transaction } from "./ports/repository.ts";

async function execution(
  tx: Transaction,
  view: VerificationCaseView,
  registration: VerificationExecutionRegistration,
  work: ReturnType<typeof verificationWorkBudget>,
  state: EngineeringStateReader,
  basisDigest: string,
) {
  const raw = await verificationExecutionContext(tx, view, registration);
  work(raw.receipt);
  if (raw.source) work(raw.source);
  const supportContext = { executionId: registration.executionId, basisDigest };
  const record = await verificationSupport(
      tx,
      view,
      raw.receipt,
      false,
      !!raw.source,
      state,
      work,
      [],
      supportContext,
    ),
    source = raw.source
      ? await verificationSupport(tx, view, raw.source, true, true, state, work, [], supportContext)
      : null;
  const basis = await verificationExecutionBasis(tx, view, raw.data),
    supports = [record, ...(source ? [source] : [])];
  const summary: VerificationExecutionSummary = {
    id: registration.executionId,
    receiptId: raw.receipt.id,
    methodId: raw.data.methodId,
    immutableDigest: await factDigest({ id: raw.receipt.id, data: raw.data }),
    stateDigest: await factDigest({
      current: !!raw.current,
      member: !!raw.membership && canonical(raw.membership) === canonical(raw.recorded),
      support: supports.map((x) => x.digest),
    }),
    current: !!raw.current && !!raw.membership && raw.membership.version === 1,
    eligibleCriterionIds: basis.eligible,
    ...(raw.data.source.kind === "prior_receipt"
      ? { priorSourceSupported: basis.priorSourceSupported }
      : {}),
    results: basis.results.map(({ criterionId, currentCriterionId, outcome }) => ({
      criterionId,
      currentCriterionId,
      outcome,
    })),
    support: {
      changed: supports.some((x) => x.changed && !x.assessed),
      unknown: supports.some((x) => x.unknown),
      assessed: supports.some((x) => x.assessed),
      reviewRequired: supports.some((x) => x.reviewRequired),
      superseded: supports.some((x) => x.superseded),
    },
  };
  return {
    summary,
    raw,
    inputs: supports.flatMap((x) => x.inputs),
    relationships: supports.flatMap((x) => x.relationships),
    absences: supports.flatMap((x) => x.absences),
    reviewIds: supports.flatMap((x) => x.reviewIds),
  };
}
export async function verificationSelectionDigest(
  basisDigest: string,
  executions: VerificationExecutionSummary[],
  selection: Pick<VerificationResultSelection, "selections" | "accounting">,
) {
  const ids = new Set(selection.selections.map((x) => x.executionId));
  return factDigest({
    basisDigest,
    population: executions.map((x) => ({ id: x.id, immutableDigest: x.immutableDigest })),
    selected: executions
      .filter((x) => ids.has(x.id))
      .map((x) => ({ id: x.id, stateDigest: x.stateDigest, eligible: x.eligibleCriterionIds })),
    choices: selection.selections,
    accounting: selection.accounting,
  });
}
export function validateVerificationAccounting(
  view: VerificationCaseView,
  executions: VerificationExecutionSummary[],
  choices: VerificationChoice[],
  accounting: VerificationAccounting[],
) {
  const ids = new Set(executions.map((x) => x.id)),
    selected = new Set(choices.map((x) => x.executionId));
  ensure(
    accounting.length === ids.size && accounting.every((x) => ids.has(x.executionId)),
    "validation",
    "Account explicitly for every controlled execution",
  );
  for (const choice of choices) {
    const execution = executions.find((x) => x.id === choice.executionId),
      method = view.scope.basis.methods.find((x) => x.entityId === choice.methodId);
    ensure(
      execution &&
        method &&
        execution.methodId === method.entityId &&
        method.criterionIds.includes(choice.criterionId) &&
        execution.eligibleCriterionIds.includes(choice.criterionId),
      "validation",
      "Selected result does not belong to this criterion/method semantic basis",
    );
  }
  for (const entry of accounting) {
    ensure(
      (entry.decision === "selected") === selected.has(entry.executionId),
      "validation",
      "Selected execution accounting must match actual choices",
    );
    if (entry.decision !== "superseded") continue;
    const old = executions.find((x) => x.id === entry.executionId)!,
      replacement = executions.find((x) => x.id === entry.replacementId);
    ensure(
      replacement &&
        selected.has(replacement.id) &&
        replacement.methodId === old.methodId &&
        replacement.id !== old.id &&
        old.results.every(
          (result) =>
            result.currentCriterionId === null ||
            replacement.results.some((x) => x.currentCriterionId === result.currentCriterionId),
        ),
      "validation",
      "Supersession requires a selected replacement covering the same method/criterion scope",
    );
  }
}
function executionApplicability(
  selected: VerificationExecutionSummary,
  criterionId: string,
  basis: VerificationAnalysis["basis"],
): VerificationObligation["applicability"] {
  if (!selected.current) return "unavailable";
  if (!selected.eligibleCriterionIds.includes(criterionId)) return "wrong_basis";
  if (basis.state === "unknown" || selected.support.unknown) return "unknown";
  if (basis.state !== "current" || selected.support.changed || selected.support.reviewRequired)
    return "changed";
  if (selected.support.superseded) return "superseded";
  return selected.support.assessed ? "assessed" : "current";
}
function obligation(
  criterionId: string,
  methodId: string,
  selection: VerificationResultSelection | null,
  executions: VerificationExecutionSummary[],
  basis: VerificationAnalysis["basis"],
): VerificationObligation {
  const choice = selection?.selections.find(
      (x) => x.criterionId === criterionId && x.methodId === methodId,
    ),
    selected = executions.find((x) => x.id === choice?.executionId);
  const outcome =
    selected?.results.find((x) => x.currentCriterionId === criterionId)?.outcome ?? null;
  const result: VerificationObligation = {
    criterionId,
    methodId,
    executionId: choice?.executionId ?? null,
    outcome,
    applicability: "unselected",
    reasons: [],
  };
  if (!selected) {
    result.reasons.push("Choose an explicit execution for this obligation");
    return result;
  }
  result.applicability = executionApplicability(selected, criterionId, basis);
  if (!["current", "assessed"].includes(result.applicability))
    result.reasons.push("Selected execution applicability: " + result.applicability);
  if (selected.priorSourceSupported === false)
    result.reasons.push(
      "Controlled prior source has no complete passing coverage for this interpretation; record a performed replacement",
    );
  if (outcome !== "passed") result.reasons.push("Recorded outcome remains " + outcome);
  return result;
}
function verificationBlockers(
  view: VerificationCaseView,
  basis: VerificationAnalysis["basis"],
  selectionState: VerificationAnalysis["selection"]["state"],
  obligations: VerificationObligation[],
) {
  const blockers: string[] = [];
  if (basis.state !== "current") blockers.push("Governing basis is " + basis.state);
  if (view.scope.basis.coverage.kind !== "complete" || !view.scope.basis.coverage.sourceComplete)
    blockers.push("Source coverage is explicitly partial");
  if (view.scope.basis.coverage.unassignedCriterionIds.length)
    blockers.push("Some criteria have no assigned method");
  if (selectionState !== "current") blockers.push("Result selection is " + selectionState);
  if (
    obligations.some(
      (x) => x.outcome !== "passed" || !["current", "assessed"].includes(x.applicability),
    )
  )
    blockers.push("Not every obligation has an applicable passing execution");
  return blockers;
}
export async function analyzeVerification(
  tx: Transaction,
  selection: VerificationSelection,
  expectedVersion?: number,
) {
  const context = await verificationContext(tx, selection, expectedVersion),
    { view, selected, certificate } = context;
  const state = boundedEngineeringState(
    await verificationEngineeringState(tx, view.scope),
    16777216,
    "Verification analysis exceeds its 16 MiB resolved-state read budget",
  );
  const governing = await verificationGoverningBasis(tx, view, state),
    entries = [];
  const work = verificationWorkBudget();
  for (const registration of view.executions)
    entries.push(await execution(tx, view, registration, work, state, governing.digest));
  const executions = entries.map((x) => x.summary),
    basis = { state: governing.state, digest: governing.digest, reasons: governing.reasons };
  const obligations = view.scope.basis.methods.flatMap((method) =>
    method.criterionIds.map((id) => obligation(id, method.entityId, selected, executions, basis)),
  );
  const unassessed = executions
    .filter((x) => !selected?.accounting.some((a) => a.executionId === x.id))
    .map((x) => x.id);
  const digest = selected
    ? await verificationSelectionDigest(basis.digest, executions, selected)
    : null;
  const selectionState = !selected
    ? "none"
    : unassessed.length
      ? "incomplete"
      : digest !== selected.evidenceDigest
        ? "stale"
        : "current";
  const blockers = verificationBlockers(view, basis, selectionState, obligations);
  const ready = blockers.length === 0,
    closed = view.case.state === view.model.definition.states.closed;
  const completion: VerificationAnalysis["completion"] = {
    state: !closed
      ? "open"
      : ready && certificate?.basisDigest === basis.digest
        ? "verified"
        : "needs_reassessment",
    commandId: certificate?.commandId ?? null,
    receiptId: closed ? view.control.receiptId : null,
  };
  const analysis: VerificationAnalysis = {
    view,
    basis,
    executions,
    obligations,
    recordedSelection: selected,
    recordedConclusion: certificate,
    proposalDigest: await factDigest({ basis, executions }),
    selection: {
      state: selectionState,
      evidenceDigest: digest,
      unassessedExecutionIds: unassessed,
    },
    ready,
    blockers,
    completion,
  };
  verificationBytes(analysis, 262144);
  return { analysis, context, governing, entries };
}
