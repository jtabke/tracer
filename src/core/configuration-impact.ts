import type { ConfigurationComparison, ConfigurationPair } from "./configuration-comparison.ts";
import type { ComparedState, Receipt } from "./evidence.ts";
import { comparisonToken } from "./selected-input-state.ts";
import { ensure, knownProperties, record } from "./model.ts";

export type ConfigurationImpactQuery = ConfigurationPair & {
  after?: string;
  limit?: number;
  expectedEvidenceRevision?: number;
};
export type ConfigurationImpactCursor = {
  pairDigest: string;
  evidenceRevision: number;
  sequence: string;
};
export function parseConfigurationImpactCursor(value: string): ConfigurationImpactCursor {
  ensure(typeof value === "string" && value.length <= 512, "validation", "Invalid impact cursor");
  let cursor: unknown;
  try {
    cursor = JSON.parse(value);
  } catch {
    ensure(false, "validation", "Invalid impact cursor");
  }
  ensure(record(cursor), "validation", "Invalid impact cursor");
  knownProperties(cursor, ["pairDigest", "evidenceRevision", "sequence"]);
  ensure(
    typeof cursor.pairDigest === "string" &&
      /^sha256:[a-f0-9]{64}$/.test(cursor.pairDigest) &&
      Number.isSafeInteger(cursor.evidenceRevision) &&
      Number(cursor.evidenceRevision) >= 0 &&
      typeof cursor.sequence === "string" &&
      /^[1-9]\d*$/.test(cursor.sequence) &&
      Number.isSafeInteger(Number(cursor.sequence)),
    "validation",
    "Invalid impact cursor",
  );
  return cursor as ConfigurationImpactCursor;
}

export function configurationDependencyChange(before: ComparedState, after: ComparedState) {
  return before.hasUnknown ||
    after.hasUnknown ||
    before.relationshipInputs === undefined ||
    after.relationshipInputs === undefined
    ? ("unknown" as const)
    : comparisonToken(before) === comparisonToken(after)
      ? ("unchanged" as const)
      : ("changed" as const);
}

export type ConfigurationImpactReceipt = {
  receipt: Receipt;
  inclusion: { entityIds: string[]; relationshipIds: string[] };
  before: ComparedState;
  after: ComparedState;
  /** Correspondence is not a judgment about the result's engineering validity. */
  dependencyChange: "changed" | "unchanged" | "unknown";
  supersession: { count: number; ids: string[] };
};
export type ConfigurationImpact = {
  contract: "configuration_impact";
  version: 1;
  pair: ConfigurationComparison;
  basis: ConfigurationPair & {
    policy: "declared-reference-dependencies-v1";
    pairDigest: string;
  };
  /** Live evidence discovery is separate from immutable product-state comparison. */
  discovery: {
    evidenceRevision: number;
    entityIds: string[];
    relationshipIds: string[];
    population: "matching_declared_dependencies_page";
    after: string | null;
    limit: number;
    excluded: "receipts_without_matching_declared_dependencies";
    digest: string;
  };
  evaluations: { items: ConfigurationImpactReceipt[]; nextAfter?: string };
  completeness: {
    engineeringImpact: "not_assessed";
    undeclaredDependencies: "unknown";
    passage: "not_assessed";
    outcomes: "retained_without_interpretation";
  };
};

export function configurationImpactPopulation(pair: ConfigurationComparison) {
  return {
    entityIds: [
      ...new Set([...pair.before.members, ...pair.after.members].map((x) => x.entity.id)),
    ].sort(),
    relationshipIds: [
      ...new Set(
        [...(pair.before.relationships ?? []), ...(pair.after.relationships ?? [])].map(
          (x) => x.relationship.id,
        ),
      ),
    ].sort(),
  };
}

/** Exact declared-use matching, without interpreting graph reachability as dependency. */
export function configurationReceiptInclusion(
  receipt: Receipt,
  entityIds: string[],
  relationshipIds: string[],
) {
  const entities = new Set(entityIds),
    relationships = new Set(relationshipIds);
  return {
    entityIds: [
      ...new Set(receipt.inputs.filter((x) => entities.has(x.entityId)).map((x) => x.entityId)),
    ].sort(),
    relationshipIds: [
      ...new Set([
        ...receipt.inputs.flatMap((x) =>
          x.links.filter((r) => relationships.has(r.id)).map((r) => r.id),
        ),
        ...(receipt.relationshipInputs ?? [])
          .filter((x) => relationships.has(x.relationship.id))
          .map((x) => x.relationship.id),
      ]),
    ].sort(),
  };
}
