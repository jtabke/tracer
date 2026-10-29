import type { Entity, Relationship } from "../core/model.ts";
import { ensure, TracerError } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";
import type {
  AssessmentAnalysis,
  AssessmentObligation,
  ChangeAssessmentView,
  DispositionView,
  ResolvedSupport,
  AssessmentSelection,
  CandidateKey,
} from "../core/change-assessment.ts";
import { assessmentContext } from "./assessment-context.ts";
import { assessmentDispositions } from "./assessment-dispositions.ts";
import { candidateBasis, candidateKey, factDigest } from "./assessment-facts.ts";
import { assessmentSupportResolver } from "./assessment-support.ts";
import type { AssessmentSupportResolver } from "./assessment-support.ts";
import { discoverAssessmentScope } from "./assessment-scope.ts";
import { pairAssessmentState } from "./pair-assessment-facts.ts";
import type { PairAssessmentState } from "./pair-assessment-facts.ts";

async function supportingState(resolver: AssessmentSupportResolver, support: ResolvedSupport[]) {
  let changed = false,
    unknown = false;
  for (const previous of support) {
    const current = await resolver.resolve(previous.reference);
    changed ||=
      previous.digest !== current.digest ||
      (current.applicability !== undefined && current.applicability !== "applicable");
    unknown ||= current.hasUnknown;
  }
  return { changed, unknown };
}
async function obligation(
  tx: Transaction,
  view: ChangeAssessmentView,
  subject: AssessmentObligation["subject"],
  disposition: DispositionView | undefined,
  selected?: PairAssessmentState,
  resolver = assessmentSupportResolver(tx, view.scope),
): Promise<AssessmentObligation> {
  const basis = await candidateBasis(tx, view.scope, subject, selected);
  const result: AssessmentObligation = {
    subject,
    label: await candidateLabel(tx, subject, selected),
    currentDigest: basis.digest,
    hasUnknown: basis.hasUnknown,
    disposition: null,
    state: "undisposed",
    openActions: 0,
    waivedActions: 0,
  };
  if (!disposition) return result;
  result.disposition = {
    id: disposition.id,
    version: disposition.version,
    membershipId: disposition.membershipId,
    decision: disposition.decision,
    rationalePreview: disposition.rationale.slice(0, 200),
  };
  const support = await supportingState(resolver, disposition.data.support);
  for (const action of disposition.actions) {
    result.openActions += Number(action.state === "open");
    result.waivedActions += Number(action.state === "waived");
    if (action.state === "open") continue;
    const captured = disposition.data.actionSupport.find((item) => item.id === action.id);
    ensure(captured, "storage", "Action supporting basis is unavailable");
    const state = await supportingState(resolver, captured.support);
    support.changed ||= state.changed;
    support.unknown ||= state.unknown;
    if (
      view.scope.version === 2 &&
      action.kind === "reverify" &&
      action.state === "done" &&
      !(await resolver.verifies(subject, action.support))
    )
      support.changed = true;
  }
  result.hasUnknown ||= support.unknown;
  const exception =
    disposition.decision === "acknowledge_unknown" && view.model.definition.policy.allowUnknown;
  const replaced =
    (subject.kind === "receipt" || view.scope.version === 2) &&
    disposition.decision === "reverify" &&
    disposition.actions.some((action) => action.kind === "reverify" && action.state === "done");
  result.state = obligationState(
    disposition.data.basis.digest !== basis.digest || support.changed,
    result.openActions,
    !exception && (support.unknown || (basis.hasUnknown && !replaced)),
  );
  return result;
}
async function candidateLabel(
  tx: Transaction,
  subject: CandidateKey,
  selected?: PairAssessmentState,
) {
  if (subject.kind === "receipt") {
    const receipt = await tx.getEvidence("receipt", subject.id);
    return receipt
      ? `${receipt.outcome.slice(0, 120)} · ${candidateObjectLabel(receipt.output)}`.slice(0, 200)
      : `Removed receipt ${subject.id.slice(0, 8)}`;
  }
  const value = selected
    ? subject.kind === "entity"
      ? ((await selected.after.getEntity(subject.id)) ??
        (await selected.before.getEntity(subject.id)))
      : ((await selected.after.getRelationship(subject.id)) ??
        (await selected.before.getRelationship(subject.id)))
    : await tx.get(subject.kind, subject.id);
  if (!value) return `Removed ${subject.kind} ${subject.id.slice(0, 8)}`;
  return candidateObjectLabel(value);
}
function candidateObjectLabel(value: Entity | Relationship) {
  const title = typeof value.fields.title === "string" ? value.fields.title : undefined;
  const identity =
    "source" in value ? value.type : (value.key ?? value.resource?.label ?? value.type);
  return (title && title !== identity ? `${identity} · ${title}` : identity).slice(0, 200);
}
function obligationState(
  changed: boolean,
  openActions: number,
  unknown: boolean,
): AssessmentObligation["state"] {
  if (changed) return "stale_basis";
  if (openActions) return "open_actions";
  return unknown ? "unknown" : "accounted";
}
async function discovery(
  tx: Transaction,
  view: ChangeAssessmentView,
): Promise<{ state: AssessmentAnalysis["discovery"]; reason: string | null }> {
  try {
    const current = await discoverAssessmentScope(tx, {
      assessmentId: view.assessment.id,
      purpose: view.scope.purpose,
      query: view.scope.query,
    });
    const retained = new Set((view.scope.retained ?? []).map(candidateKey));
    const prior = view.scope.candidates
      .map(candidateKey)
      .filter((key) => !retained.has(key))
      .sort();
    const latest = current.candidates.map(candidateKey).sort();
    const same =
      prior.length === latest.length && prior.every((value, index) => value === latest[index]);
    return {
      state: same ? "current" : "changed",
      reason: same
        ? null
        : "Selected traversal population changed; explicitly refresh scope while retaining prior obligations",
    };
  } catch (error) {
    if (
      error instanceof TracerError &&
      error.code === "validation" &&
      /exceeds|narrow|population/.test(error.message)
    )
      return { state: "unknown", reason: error.message };
    throw error;
  }
}
export async function analyzeAssessment(
  tx: Transaction,
  selection: AssessmentSelection,
  expectedVersion?: number,
) {
  return analyzeAssessmentContext(tx, await assessmentContext(tx, selection, expectedVersion));
}
export async function analyzeAssessmentContext(
  tx: Transaction,
  context: Awaited<ReturnType<typeof assessmentContext>>,
) {
  const { view } = context;
  const selected = view.scope.version === 2 ? await pairAssessmentState(tx, view.scope) : undefined;
  const resolver = assessmentSupportResolver(tx, view.scope);
  const owned = await assessmentDispositions(tx, view),
    obligations: AssessmentObligation[] = [];
  for (const candidate of view.scope.candidates)
    obligations.push(
      await obligation(
        tx,
        view,
        { kind: candidate.kind, id: candidate.id },
        owned.find(
          (item) => candidateKey(item.disposition.data.subject) === candidateKey(candidate),
        )?.disposition,
        selected,
        resolver,
      ),
    );
  const population = await discovery(tx, view);
  const closed = view.assessment.state === view.model.definition.states.closed;
  const applicable =
    closed &&
    (await closureApplicable(
      context.certificate!,
      owned,
      obligations,
      population.state,
      view.scope.version === 2 || view.model.compatibility.writable,
    ));
  const analysis: AssessmentAnalysis = {
    view,
    obligations,
    discovery: population.state,
    discoveryReason: population.reason,
    completion: {
      state: closed ? (applicable ? "completed" : "needs_reassessment") : "open",
      receiptId: closed ? view.control.receiptId : null,
    },
  };
  return { ...context, owned, analysis };
}
async function closureApplicable(
  certificate: NonNullable<Awaited<ReturnType<typeof assessmentContext>>["certificate"]>,
  owned: Awaited<ReturnType<typeof assessmentDispositions>>,
  obligations: AssessmentObligation[],
  discovery: AssessmentAnalysis["discovery"],
  compatible: boolean,
) {
  if (
    discovery !== "current" ||
    !compatible ||
    obligations.some((item) => item.state !== "accounted")
  )
    return false;
  for (const item of obligations)
    if (
      !certificate.population.some(
        (entry) =>
          candidateKey(entry.subject) === candidateKey(item.subject) &&
          entry.digest === item.currentDigest,
      )
    )
      return false;
  for (const item of owned) {
    const captured = certificate.judgments.find((value) => value.id === item.entity.id);
    if (
      !captured ||
      captured.membershipVersion !== item.member.version ||
      captured.digest !== (await judgmentDigest(item.disposition))
    )
      return false;
  }
  return true;
}
export function judgmentDigest(value: DispositionView) {
  return factDigest({
    id: value.id,
    decision: value.decision,
    rationale: value.rationale,
    actions: value.actions,
    data: value.data,
  });
}
