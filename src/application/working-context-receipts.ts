import { ensure } from "../core/model.ts";
import type { Entity } from "../core/model.ts";
import type { Receipt } from "../core/evidence.ts";
import type { WorkingContext, WorkingReceipt, WorkingInputFact } from "../core/working-context.ts";
import type { Transaction, WorkingReceiptCandidate } from "./ports/repository.ts";
import { compareReceiptState } from "./receipt-comparison.ts";
import { workingCursor } from "./working-context-cursors.ts";
import type { PreparedWorkingQuery } from "./working-context-query.ts";
import { receiptOwner } from "./working-context-native.ts";
import type { RoutesProjection } from "./working-context-native.ts";

type Budget = { remaining: number };
async function comparison(
  tx: Transaction,
  candidate: WorkingReceiptCandidate,
  budget: Budget,
): Promise<WorkingReceipt["comparison"]> {
  if (candidate.inputCount > budget.remaining) return null;
  budget.remaining -= candidate.inputCount;
  const receipt = (await tx.getEvidence("receipt", candidate.receipt.id)) as Receipt | undefined;
  ensure(receipt, "referential_integrity", "Working receipt is unavailable");
  return compareReceiptState(tx, receipt);
}
function inputFact(
  candidate: WorkingReceiptCandidate,
  compared: WorkingReceipt["comparison"],
  id: string,
): WorkingInputFact {
  const recorded = candidate.inputs.filter((input) => input.entityId === id);
  if (!recorded.length) return { entityId: id, declared: false, comparison: null };
  const versions = new Set(recorded.map((input) => input.capturedVersion));
  const states = compared?.inputs.filter((input) => input.entityId === id);
  return {
    entityId: id,
    declared: true,
    ...(versions.size === 1 ? { capturedVersion: recorded[0].capturedVersion } : {}),
    comparison: inputState(states),
  };
}
function inputState(states: NonNullable<WorkingReceipt["comparison"]>["inputs"] | undefined) {
  if (!states?.length) return null;
  const hasUnknown = states.some((s) => s.hasUnknown),
    hasChanged = states.some((s) => s.hasChanged);
  return {
    state: hasUnknown
      ? ("unknown" as const)
      : hasChanged
        ? ("changed" as const)
        : ("current" as const),
    hasChanged,
    hasUnknown,
  };
}

function directOutputs(
  candidate: WorkingReceiptCandidate,
  query: PreparedWorkingQuery,
  rows: Entity[],
) {
  const output = candidate.receipt.output.id;
  if (output === query.focusId) return [output];
  return rows.some((row) => row.id === output) ? [output] : [];
}
function receiptMatches(
  candidate: WorkingReceiptCandidate,
  query: PreparedWorkingQuery,
  rows: Entity[],
  routes: RoutesProjection,
): WorkingReceipt["matches"] {
  const matches = {
    routes: routes.matches
      .filter((match) => match.outputs.has(candidate.receipt.output.id))
      .map(({ rowId, routeKey }) => ({ rowId, routeKey })),
    inputIds: [...new Set(candidate.inputs.map((input) => input.entityId))],
    outputIds: directOutputs(candidate, query, rows),
  };
  ensure(
    matches.routes.length + matches.inputIds.length + matches.outputIds.length > 0,
    "referential_integrity",
    "Receipt lookup does not match its captured inputs or selected output",
  );
  return matches;
}
async function projectedReceipt(
  tx: Transaction,
  candidate: WorkingReceiptCandidate,
  budget: Budget,
  query: PreparedWorkingQuery,
  rows: Entity[],
  routes: RoutesProjection,
): Promise<WorkingReceipt> {
  const matches = receiptMatches(candidate, query, rows, routes);
  const compared = await comparison(tx, candidate, budget);
  return {
    receipt: candidate.receipt,
    inputCount: candidate.inputCount,
    matches,
    comparison: compared,
    ...(compared === null ? { comparisonUnavailable: "input_budget" as const } : {}),
    focus: inputFact(candidate, compared, query.focusId),
    rows: rows.map((row) => inputFact(candidate, compared, row.id)),
    supersession: await tx.impactSupersession(candidate.receipt.id),
  };
}
export async function workingReceipts(
  tx: Transaction,
  query: PreparedWorkingQuery,
  context: WorkingContext["context"],
  rows: Entity[],
  routes: RoutesProjection,
): Promise<WorkingContext["receipts"]> {
  const owner = receiptOwner(query, rows);
  const page = await tx.workingReceipts({
    outputIds: [...routes.outputs],
    inputIds: [...new Set([query.focusId, ...rows.map((row) => row.id)])],
    relationshipIds: [],
    after: query.receiptAfter?.position,
    limit: query.receiptLimit,
  });
  const budget = { remaining: 200 },
    items: WorkingReceipt[] = [];
  for (const candidate of page.items)
    items.push(await projectedReceipt(tx, candidate, budget, query, rows, routes));
  return {
    scope: "focus-and-loaded-rows",
    total: page.total,
    page: {
      items,
      ...(page.nextAfter
        ? { nextAfter: workingCursor("receipts", query.scope, owner, context, page.nextAfter) }
        : {}),
    },
  };
}
