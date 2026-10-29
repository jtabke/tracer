import { canonical } from "../../core/evidence.ts";
import { ensure } from "../../core/model.ts";
import {
  configurationDependencyChange,
  configurationReceiptInclusion,
  configurationImpactPopulation,
  parseConfigurationImpactCursor,
} from "../../core/configuration-impact.ts";
import type {
  ConfigurationImpact,
  ConfigurationImpactQuery,
  ConfigurationImpactReceipt,
} from "../../core/configuration-impact.ts";
import { configurationComparison } from "./configuration-comparison.ts";
import { validateSelectedComparison } from "./selected-comparison.ts";
import { comparedState, receipt } from "../api-models.ts";
import { array, integer, literal, object, text, page, nullable } from "../decode.ts";

const decode = object({
  contract: literal("configuration_impact"),
  version: literal(1),
  basis: object({
    beforeId: text,
    afterId: text,
    policy: literal("declared-reference-dependencies-v1"),
    pairDigest: text,
  }),
  discovery: object({
    evidenceRevision: integer(),
    entityIds: array(text),
    relationshipIds: array(text),
    population: literal("matching_declared_dependencies_page"),
    after: nullable(text),
    limit: integer(1),
    excluded: literal("receipts_without_matching_declared_dependencies"),
    digest: text,
  }),
  evaluations: page(
    object({
      receipt,
      inclusion: object({ entityIds: array(text), relationshipIds: array(text) }),
      before: comparedState,
      after: comparedState,
      dependencyChange: literal("changed", "unchanged", "unknown"),
      supersession: object({ count: integer(), ids: array(text) }),
    }),
  ),
  completeness: object({
    engineeringImpact: literal("not_assessed"),
    undeclaredDependencies: literal("unknown"),
    passage: literal("not_assessed"),
    outcomes: literal("retained_without_interpretation"),
  }),
});
function validateReceipt(
  row: ConfigurationImpactReceipt,
  entityIds: string[],
  relationshipIds: string[],
) {
  const inclusion = configurationReceiptInclusion(row.receipt, entityIds, relationshipIds);
  ensure(
    inclusion.entityIds.length + inclusion.relationshipIds.length > 0 &&
      canonical(inclusion) === canonical(row.inclusion),
    "validation",
    "Invalid impact inclusion",
  );
  for (const comparison of [row.before, row.after]) {
    validateSelectedComparison(comparison, true);
    ensure(
      comparison.receiptId === row.receipt.id &&
        canonical(comparison.inputs.map((x) => x.recorded)) === canonical(row.receipt.inputs) &&
        canonical(comparison.relationshipInputs?.map((x) => x.recorded)) ===
          canonical(row.receipt.relationshipInputs),
      "validation",
      "Impact omits declared receipt dependencies",
    );
  }
  ensure(
    row.dependencyChange === configurationDependencyChange(row.before, row.after),
    "validation",
    "Impact misstates dependency changes",
  );
  ensure(
    row.supersession.count >= row.supersession.ids.length && row.supersession.ids.length <= 3,
    "validation",
    "Invalid impact supersession",
  );
}
function validatePage(result: ConfigurationImpact, query: ConfigurationImpactQuery) {
  ensure(
    result.discovery.after === (query.after ?? null) &&
      result.discovery.limit === (query.limit ?? 5) &&
      result.discovery.limit <= 25 &&
      result.evaluations.items.length <= result.discovery.limit,
    "validation",
    "Impact belongs to another selected page",
  );
  ensure(
    query.expectedEvidenceRevision === undefined ||
      result.discovery.evidenceRevision === query.expectedEvidenceRevision,
    "validation",
    "Impact evidence watermark mismatch",
  );
  const previous = query.after === undefined ? null : parseConfigurationImpactCursor(query.after);
  for (const token of [query.after, result.evaluations.nextAfter]) {
    if (token === undefined) continue;
    const cursor = parseConfigurationImpactCursor(token);
    ensure(
      cursor.pairDigest === result.basis.pairDigest &&
        cursor.evidenceRevision === result.discovery.evidenceRevision,
      "validation",
      "Impact cursor belongs to another context",
    );
  }
  if (result.evaluations.nextAfter) {
    const next = parseConfigurationImpactCursor(result.evaluations.nextAfter);
    ensure(
      result.evaluations.items.length === result.discovery.limit &&
        Number(next.sequence) > Number(previous?.sequence ?? 0),
      "validation",
      "Invalid impact page continuation",
    );
  }
}
export function configurationImpact(
  value: unknown,
  query: ConfigurationImpactQuery,
): ConfigurationImpact {
  const decoded = decode(value);
  const pair = configurationComparison((value as Record<string, unknown>).pair, query);
  const result = { ...decoded, pair };
  ensure(
    result.basis.beforeId === query.beforeId &&
      result.basis.afterId === query.afterId &&
      result.basis.pairDigest === pair.basis.digest,
    "validation",
    "Impact belongs to another selected pair",
  );
  const { entityIds, relationshipIds } = configurationImpactPopulation(pair);
  ensure(
    canonical(entityIds) === canonical(result.discovery.entityIds) &&
      canonical(relationshipIds) === canonical(result.discovery.relationshipIds),
    "validation",
    "Impact discovery does not match selected membership",
  );
  ensure(
    new Set(result.evaluations.items.map((x) => x.receipt.id)).size ===
      result.evaluations.items.length,
    "validation",
    "Invalid impact population",
  );
  validatePage(result, query);
  for (const row of result.evaluations.items) validateReceipt(row, entityIds, relationshipIds);
  ensure(
    /^sha256:[a-f0-9]{64}$/.test(result.discovery.digest),
    "validation",
    "Invalid impact discovery digest",
  );
  return result;
}
