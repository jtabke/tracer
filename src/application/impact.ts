import { receiptScope } from "./impact-receipt-scope.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { ensure } from "../core/model.ts";
import type { ChangeImpact, ChangeImpactQuery, ImpactReceipt } from "../core/impact.ts";
import type { Receipt } from "../core/evidence.ts";
import type { Repository, Transaction } from "./ports/repository.ts";
import { compareCapturedInputs } from "./receipt-comparison.ts";
import { impactLimits, impactNative } from "./impact-native.ts";
import {
  impactContext,
  impactContinuation,
  impactCursor,
  impactQuery,
  validateImpactTypes,
} from "./impact-context.ts";

async function evaluation(
  tx: Transaction,
  receipt: Receipt,
  entityIds: Set<string>,
  relationshipIds: Set<string>,
): Promise<ImpactReceipt> {
  const comparison = await compareCapturedInputs(tx, receipt);
  return {
    receipt,
    comparison,
    scope: receiptScope(comparison, entityIds, relationshipIds),
    supersession: await tx.impactSupersession(receipt.id),
  };
}
export class ChangeImpactService {
  private repository: Repository;
  constructor(repository: Repository) {
    this.repository = repository;
  }
  async get(query: ChangeImpactQuery): Promise<ChangeImpact> {
    query = snapshotInput(query);
    return this.repository.transaction((tx) => readChangeImpact(tx, query), { readOnly: true });
  }
}

/** Transaction-local impact read for guarded application compositions. */
export async function readChangeImpact(
  tx: Transaction,
  query: ChangeImpactQuery,
  excludeOutputId?: string,
): Promise<ChangeImpact> {
  const { scope, limit } = impactQuery(query);
  const context = await impactContext(tx, query),
    after = impactContinuation(scope, context, query.after);
  ensure(
    query.expectedProjectRevision === undefined ||
      query.expectedProjectRevision === context.projectRevision,
    "conflict",
    "Project changed before impact investigation",
  );
  validateImpactTypes(scope, context);
  const native = await impactNative(tx, scope, context.baseline.projectRevision);
  const entityIds = new Set(native.entities.map((entity) => entity.id)),
    relationshipIds = new Set(native.relationships.map((link) => link.id));
  const page = await tx.impactReceipts({
    entityIds: [...entityIds],
    relationshipIds: [...relationshipIds],
    after,
    limit,
    ...(excludeOutputId === undefined ? {} : { excludeOutputId }),
  });
  ensure(
    page.items.reduce(
      (count, receipt) => count + receipt.inputs.length + (receipt.relationshipInputs?.length ?? 0),
      0,
    ) <= impactLimits.inputs,
    "validation",
    `Impact page exceeds ${impactLimits.inputs} captured inputs; reduce the evaluation page limit`,
  );
  const items: ImpactReceipt[] = [];
  for (const receipt of page.items)
    items.push(await evaluation(tx, receipt, entityIds, relationshipIds));
  return {
    context,
    scope,
    native,
    evaluations: {
      items,
      ...(page.nextAfter === undefined
        ? {}
        : { nextAfter: impactCursor(scope, context, page.nextAfter) }),
    },
    summary: {
      scope: "page",
      evaluated: items.length,
      current: items.filter((item) => item.scope.state === "current").length,
      changed: items.filter((item) => item.scope.state === "changed").length,
      unknown: items.filter((item) => item.scope.state === "unknown").length,
    },
  };
}
