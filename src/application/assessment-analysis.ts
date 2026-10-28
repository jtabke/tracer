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
import { candidateBasis, candidateKey, resolveSupport, factDigest } from "./assessment-facts.ts";
import { discoverAssessmentScope } from "./assessment-scope.ts";

async function supportingState(tx: Transaction, support: ResolvedSupport[]) {
  let changed = false,
    unknown = false;
  for (const previous of support) {
    const current = await resolveSupport(tx, previous.reference);
    changed ||= previous.digest !== current.digest;
    unknown ||= current.hasUnknown;
  }
  return { changed, unknown };
}
async function obligation(
  tx: Transaction,
  view: ChangeAssessmentView,
  subject: AssessmentObligation["subject"],
  disposition: DispositionView | undefined,
): Promise<AssessmentObligation> {
  const basis = await candidateBasis(tx, view.scope, subject);
  const result: AssessmentObligation = {
    subject,
    label: await candidateLabel(tx, subject),
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
  const support = await supportingState(tx, disposition.data.support);
  for (const action of disposition.actions) {
    result.openActions += Number(action.state === "open");
    result.waivedActions += Number(action.state === "waived");
    if (action.state === "open") continue;
    const captured = disposition.data.actionSupport.find((item) => item.id === action.id);
    ensure(captured, "storage", "Action supporting basis is unavailable");
    const state = await supportingState(tx, captured.support);
    support.changed ||= state.changed;
    support.unknown ||= state.unknown;
  }
  result.hasUnknown ||= support.unknown;
  const exception =
    disposition.decision === "acknowledge_unknown" && view.model.definition.policy.allowUnknown;
  const replaced =
    subject.kind === "receipt" &&
    disposition.decision === "reverify" &&
    disposition.actions.some((action) => action.kind === "reverify" && action.state === "done");
  result.state = obligationState(
    disposition.data.basis.digest !== basis.digest || support.changed,
    result.openActions,
    !exception && (support.unknown || (basis.hasUnknown && !replaced)),
  );
  return result;
}
async function candidateLabel(tx: Transaction, subject: CandidateKey) {
  const value =
    subject.kind === "receipt"
      ? (await tx.getEvidence("receipt", subject.id))?.output
      : await tx.get(subject.kind, subject.id);
  if (!value) return `Removed ${subject.kind} ${subject.id.slice(0, 8)}`;
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
      view.model.compatibility.writable,
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
