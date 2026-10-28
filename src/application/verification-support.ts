import { ensure } from "../core/model.ts";
import type {
  Receipt,
  ComparedState,
  InputComparison,
  InputDeclaration,
  RelationshipDeclaration,
} from "../core/evidence.ts";
import type { VerificationCaseView } from "../core/verification-case.ts";
import { compareReceiptState, comparisonToken, scopedInputState } from "./receipt-comparison.ts";
import type { Transaction } from "./ports/repository.ts";
import { factDigest } from "./fact-digest.ts";

function projectedInput(
  input: InputComparison,
  view: VerificationCaseView,
  prior: boolean,
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
): ComparedState {
  const inputRows = prior ? full.inputs : full.inputs.slice(hasSource ? 5 : 4);
  const inputs = inputRows
    .map((x) => projectedInput(x, view, prior))
    .filter((x): x is InputComparison => x !== null);
  const relationshipInputs = prior
    ? (full.relationshipInputs ?? [])
    : (full.relationshipInputs ?? []).slice(1);
  const all = [...inputs, ...relationshipInputs],
    hasChanged = all.some((x) => x.hasChanged),
    hasUnknown = all.some((x) => x.hasUnknown);
  return {
    receiptId: full.receiptId,
    inputs,
    relationshipInputs,
    hasChanged,
    hasUnknown,
    state: hasUnknown ? "unknown" : hasChanged ? "changed" : "current",
  };
}
function declareInput(
  input: InputComparison,
  inputs: InputDeclaration[],
  absences: { kind: "entity" | "relationship"; id: string }[],
) {
  const current = input.current.entity;
  if (!current) {
    absences.push({ kind: "entity", id: input.entityId });
    return;
  }
  const base = {
    entityId: input.entityId,
    role: "selected verification support",
    ...(input.recorded.fields?.length ? { fields: input.recorded.fields } : {}),
  };
  if (input.recorded.observation) {
    if (input.current.observation)
      inputs.push({ ...base, facet: "content", observationId: input.current.observation.id });
  } else if (input.recorded.fields?.length !== 0)
    inputs.push({ ...base, facet: "native", revision: current.version });
}
function declarations(comparison: ComparedState) {
  const inputs: InputDeclaration[] = [];
  const relationships: RelationshipDeclaration[] = [];
  const absences: { kind: "entity" | "relationship"; id: string }[] = [];
  for (const input of comparison.inputs) {
    declareInput(input, inputs, absences);
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
export async function verificationSupport(
  tx: Transaction,
  view: VerificationCaseView,
  receipt: Receipt,
  prior: boolean,
  hasSource: boolean,
) {
  const full = await compareReceiptState(tx, receipt),
    comparison = supportComparison(full, view, prior, hasSource);
  const supersession = await tx.impactSupersession(receipt.id),
    reviewRequired = full.review.state === "needs_reevaluation";
  const assessed =
    comparison.hasChanged &&
    !comparison.hasUnknown &&
    view.model.definition.policy.allowAssessedDesignChanges &&
    full.review.state === "accepted";
  const digest = await factDigest({
    token: comparisonToken(comparison),
    reviewRequired,
    reviewId: assessed ? full.review.decision?.id : null,
    superseded: supersession.count,
  });
  return {
    ...declarations(comparison),
    digest,
    changed: comparison.hasChanged,
    unknown: comparison.hasUnknown,
    assessed,
    reviewRequired,
    reviewId: assessed ? full.review.decision!.id : null,
    superseded: supersession.count > 0,
  };
}
export function verificationWorkBudget() {
  let bytes = 0,
    inputs = 0,
    links = 0;
  return (receipt: Receipt) => {
    bytes += new TextEncoder().encode(JSON.stringify(receipt)).length;
    inputs += receipt.inputs.length + (receipt.relationshipInputs?.length ?? 0);
    links += receipt.inputs.reduce((n, x) => n + x.links.length, 0);
    ensure(
      bytes <= 16777216 && inputs <= 10000 && links <= 20000,
      "validation",
      "Verification analysis work budget exceeded; no partial accounting returned",
    );
  };
}
