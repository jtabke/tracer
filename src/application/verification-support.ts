import { ensure } from "../core/model.ts";
import type {
  Receipt,
  ComparedState,
  Comparison,
  InputComparison,
  InputDeclaration,
  RelationshipDeclaration,
} from "../core/evidence.ts";
import type { VerificationCaseView } from "../core/verification-case.ts";
import { targetSupportReview } from "./verification-target-review.ts";
import type { TargetSupportContext } from "./verification-target-review.ts";
import {
  compareCapturedInputs,
  compareReceiptState,
  comparisonToken,
  scopedInputState,
  summarizeComparedInputs,
} from "./receipt-comparison.ts";
import { currentEngineeringState } from "./engineering-state.ts";
import type { EngineeringStateReader } from "./engineering-state.ts";
import { verificationReceiptOrigin } from "./verification-receipt-origin.ts";
import type { Transaction } from "./ports/repository.ts";
import { factDigest } from "./fact-digest.ts";

function projectedInput(
  input: InputComparison,
  view: VerificationCaseView,
  prior: boolean,
  source: EngineeringStateReader["kind"] = "current",
): InputComparison | null {
  if (!prior || input.recorded.observation || input.recorded.fields === undefined) return input;
  const definition = view.model.definition,
    basis = view.scope.basis;
  const removed =
    input.entityId === basis.requirement.entityId
      ? [definition.requirement.fields.statement, ...definition.requirement.fields.acceptance]
      : basis.methods.some((x) => x.entityId === input.entityId)
        ? [definition.method.fields.procedure, definition.method.fields.expected]
        : [];
  const fields = input.recorded.fields.filter((x) => !removed.includes(x));
  if (fields.length === input.recorded.fields.length) return input;
  if (!fields.length && !input.recorded.links.length) return null;
  const scoped = { ...input, recorded: { ...input.recorded, fields } },
    state = scopedInputState(
      scoped,
      fields.length > 0,
      new Set(input.recorded.links.map((x) => x.id)),
      source,
    );
  return {
    ...scoped,
    ...state,
    state: state.hasUnknown ? "unknown" : state.hasChanged ? "changed" : "current",
  };
}
function supportComparison(
  full: ComparedState,
  view: VerificationCaseView,
  prior: boolean,
  hasSource: boolean,
  source: EngineeringStateReader["kind"] = "current",
  ownedPrior?: { inputOffset: number; relationshipOffset: number } | null,
): ComparedState {
  const inputRows = prior
    ? full.inputs.slice(ownedPrior?.inputOffset ?? 0)
    : full.inputs.slice(hasSource ? 5 : 4);
  const inputs = inputRows
    .map((x) => projectedInput(x, view, prior, source))
    .filter((x): x is InputComparison => x !== null);
  const relationshipInputs = prior
    ? (full.relationshipInputs ?? []).slice(ownedPrior?.relationshipOffset ?? 0)
    : (full.relationshipInputs ?? []).slice(source === "configuration" ? 2 : 1);
  return summarizeComparedInputs(full.receiptId, inputs, relationshipInputs);
}
function declareInput(
  input: InputComparison,
  inputs: InputDeclaration[],
  absences: { kind: "entity" | "relationship"; id: string }[],
  historical: boolean,
) {
  const current = input.current.entity;
  if (!current) {
    absences.push({ kind: "entity", id: input.entityId });
    return;
  }
  const base = {
    entityId: input.entityId,
    ...(input.referenceUse && input.referenceUse.selection !== "unavailable"
      ? { referenceId: input.referenceUse.relationshipId }
      : {}),
    role: "selected verification support",
    ...(input.recorded.fields?.length ? { fields: input.recorded.fields } : {}),
  };
  if (input.recorded.observation) {
    if (input.current.observation)
      inputs.push({
        ...base,
        facet: "content",
        observationId: input.current.observation.id,
        ...(historical ? { revision: current.version } : {}),
      });
  } else if (input.recorded.fields?.length !== 0)
    inputs.push({ ...base, facet: "native", revision: current.version });
}
function declarations(comparison: ComparedState, historical: boolean) {
  const inputs: InputDeclaration[] = [];
  const relationships: RelationshipDeclaration[] = [];
  const absences: { kind: "entity" | "relationship"; id: string }[] = [];
  for (const input of comparison.inputs) {
    declareInput(input, inputs, absences, historical);
    input.current.links.forEach((link, index) => {
      if (link) relationships.push({ id: link.id, revision: link.version });
      else absences.push({ kind: "relationship", id: input.recorded.links[index].id });
    });
  }
  for (const link of comparison.relationshipInputs ?? []) {
    if (link.current) relationships.push({ id: link.id, revision: link.current.version });
    else absences.push({ kind: "relationship", id: link.id });
  }
  return { inputs, relationships, absences };
}
type SupportState = ReturnType<typeof declarations> & {
  digest: string;
  changed: boolean;
  unknown: boolean;
  assessed: boolean;
  reviewRequired: boolean;
  reviewIds: string[];
  superseded: boolean;
};
async function mergeSupport(local: SupportState, original: SupportState): Promise<SupportState> {
  const unresolved = (local.changed && !local.assessed) || (original.changed && !original.assessed);
  const unknown = local.unknown || original.unknown;
  return {
    inputs: [...local.inputs, ...original.inputs],
    relationships: [...local.relationships, ...original.relationships],
    absences: [...local.absences, ...original.absences],
    digest: await factDigest({ interpretation: local.digest, original: original.digest }),
    changed: local.changed || original.changed,
    unknown,
    assessed: !unknown && !unresolved && (local.assessed || original.assessed),
    reviewRequired: local.reviewRequired || original.reviewRequired,
    reviewIds: [...local.reviewIds, ...original.reviewIds],
    superseded: local.superseded || original.superseded,
  };
}
async function compareSupport(
  tx: Transaction,
  view: VerificationCaseView,
  receipt: Receipt,
  prior: boolean,
  hasSource: boolean,
  state: EngineeringStateReader,
  budget: ReturnType<typeof verificationWorkBudget>,
  context?: TargetSupportContext,
) {
  const full: ComparedState & { review: Comparison["review"] } =
    state.kind === "current"
      ? await compareReceiptState(tx, receipt)
      : {
          ...(await compareCapturedInputs(tx, receipt, state)),
          review: { state: "unreviewed" as const },
        };
  const origin = prior ? await verificationReceiptOrigin(tx, receipt) : null;
  const comparison = supportComparison(
    full,
    view,
    prior,
    hasSource,
    state.kind,
    state.kind === "configuration" ? origin : null,
  );
  ensure(
    state.kind !== "configuration" || context,
    "validation",
    "Target support needs its controlled execution context",
  );
  const qualified =
    state.kind === "configuration"
      ? await targetSupportReview(tx, view, comparison, context!, budget.account)
      : null;
  const review = qualified?.review ?? full.review;
  if (state.kind === "current" && (review.decision || review.previous))
    budget.account(review.decision ?? review.previous);
  if (context?.layers && qualified) {
    context.layers.push({
      receiptId: receipt.id,
      nextSourceReceiptId:
        origin?.data.source.kind === "prior_receipt" ? origin.data.source.receiptId : null,
      comparison,
      ...qualified,
    });
  }
  return { comparison, review, origin };
}
export async function verificationSupport(
  tx: Transaction,
  view: VerificationCaseView,
  receipt: Receipt,
  prior: boolean,
  hasSource: boolean,
  state: EngineeringStateReader = currentEngineeringState(tx),
  work?: ReturnType<typeof verificationWorkBudget>,
  lineage: string[] = [],
  context?: TargetSupportContext,
): Promise<SupportState> {
  ensure(
    lineage.length < 25 && !lineage.includes(receipt.id),
    "validation",
    "Verification support source chain exceeds 25 receipts or repeats an identity",
  );
  const budget = work ?? verificationWorkBudget();
  if (!work) budget(receipt);
  const { comparison, review, origin } = await compareSupport(
    tx,
    view,
    receipt,
    prior,
    hasSource,
    state,
    budget,
    context,
  );
  const supersession = await tx.impactSupersession(receipt.id),
    reviewRequired = review.state === "needs_reevaluation";
  const assessed =
    comparison.hasChanged &&
    !comparison.hasUnknown &&
    view.model.definition.policy.allowAssessedDesignChanges &&
    review.state === "accepted";
  const digest = await factDigest({
    token: comparisonToken(comparison),
    ...(view.scope.target ? { target: view.scope.target } : {}),
    reviewRequired,
    reviewId: assessed ? review.decision?.id : null,
    superseded: supersession.count,
  });
  const local: SupportState = {
    ...declarations(comparison, state.kind === "configuration"),
    digest,
    changed: comparison.hasChanged,
    unknown: comparison.hasUnknown,
    assessed,
    reviewRequired,
    reviewIds: assessed ? [review.decision!.id] : [],
    superseded: supersession.count > 0,
  };
  if (origin?.data.source.kind !== "prior_receipt") return local;
  const source = await tx.getEvidence("receipt", origin.data.source.receiptId);
  ensure(source, "storage", "Controlled verification support source is missing");
  budget(source);
  const original = await verificationSupport(
    tx,
    view,
    source,
    true,
    true,
    state,
    budget,
    [...lineage, receipt.id],
    context,
  );
  return mergeSupport(local, original);
}
export function verificationWorkBudget() {
  let bytes = 0,
    inputs = 0,
    links = 0;
  const account = (value: unknown) => {
    bytes += new TextEncoder().encode(JSON.stringify(value)).length;
    ensure(
      bytes <= 16777216 && inputs <= 10000 && links <= 20000,
      "validation",
      "Verification analysis work budget exceeded; no partial accounting returned",
    );
  };
  return Object.assign(
    (receipt: Receipt) => {
      inputs += receipt.inputs.length + (receipt.relationshipInputs?.length ?? 0);
      links += receipt.inputs.reduce((n, x) => n + x.links.length, 0);
      account(receipt);
    },
    { account },
  );
}
