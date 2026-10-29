import { canonical } from "../core/evidence.ts";
import { ensure, json, knownProperties, record } from "../core/model.ts";
import {
  configurationReceiptInclusion,
  configurationDependencyChange,
  configurationImpactPopulation,
  parseConfigurationImpactCursor,
} from "../core/configuration-impact.ts";
import type {
  ConfigurationImpact,
  ConfigurationImpactReceipt,
  ConfigurationImpactQuery,
} from "../core/configuration-impact.ts";
import type { Transaction } from "./ports/repository.ts";
import { compareConfigurations } from "./configuration-comparison.ts";
import { validateConfigurationPair } from "./configuration-comparison.ts";
import { configurationEngineeringState, boundedEngineeringState } from "./engineering-state.ts";
import { referenceEngineeringState } from "./reference-engineering-state.ts";
import { compareCapturedInputs } from "./receipt-comparison.ts";
import { factDigest } from "./fact-digest.ts";
import { validateReceiptDependencyPopulation } from "./configuration-applicability.ts";

export function validateConfigurationImpactQuery(input: ConfigurationImpactQuery) {
  ensure(record(input) && json(input), "validation", "Choose an impact pair and page");
  knownProperties(input, ["beforeId", "afterId", "after", "limit", "expectedEvidenceRevision"]);
  validateConfigurationPair({ beforeId: input.beforeId, afterId: input.afterId });
  const limit = input.limit ?? 5;
  ensure(
    Number.isSafeInteger(limit) && limit >= 1 && limit <= 25,
    "validation",
    "Impact page limit must be 1–25",
  );
  if (input.after !== undefined) parseConfigurationImpactCursor(input.after);
  ensure(
    input.expectedEvidenceRevision === undefined ||
      (Number.isSafeInteger(input.expectedEvidenceRevision) && input.expectedEvidenceRevision >= 0),
    "validation",
    "Invalid impact evidence watermark",
  );
}

/** Read-only live discovery over a fixed pair. No observer IO or live product substitution. */
export async function readConfigurationImpact(
  tx: Transaction,
  input: ConfigurationImpactQuery,
): Promise<ConfigurationImpact> {
  const selection = { beforeId: input.beforeId, afterId: input.afterId };
  const pair = await compareConfigurations(tx, selection);
  const evidenceRevision = await tx.impactEvidenceRevision();
  const cursor = input.after === undefined ? null : parseConfigurationImpactCursor(input.after);
  ensure(
    input.expectedEvidenceRevision === undefined ||
      input.expectedEvidenceRevision === evidenceRevision,
    "conflict",
    "Evidence changed; explicitly restart impact discovery",
  );
  ensure(
    !cursor ||
      (cursor.pairDigest === pair.basis.digest && cursor.evidenceRevision === evidenceRevision),
    "conflict",
    "Impact cursor belongs to another pair or evidence population; explicitly restart discovery",
  );
  const limit = input.limit ?? 5;
  const { entityIds, relationshipIds } = configurationImpactPopulation(pair);
  const readers = [];
  for (const id of [input.beforeId, input.afterId])
    readers.push(
      boundedEngineeringState(
        referenceEngineeringState(tx, await configurationEngineeringState(tx, id)),
        8388608,
        "Pair impact exceeds its 8 MiB selected-read budget",
      ),
    );
  const evaluations: ConfigurationImpactReceipt[] = [];
  const population = [];
  let bytes = 0;
  const page = await tx.impactReceipts({
    entityIds,
    relationshipIds,
    after: cursor?.sequence,
    limit,
  });
  for (const receipt of page.items) {
    validateReceiptDependencyPopulation(receipt);
    bytes += new TextEncoder().encode(canonical(receipt)).length;
    ensure(
      bytes <= 4194304,
      "validation",
      "Pair impact exceeds its 4 MiB receipt population budget",
    );
    const receiptDigest = await factDigest(receipt);
    const before = await compareCapturedInputs(tx, receipt, readers[0]);
    const next = await compareCapturedInputs(tx, receipt, readers[1]);
    const inclusion = configurationReceiptInclusion(receipt, entityIds, relationshipIds);
    ensure(
      inclusion.entityIds.length + inclusion.relationshipIds.length > 0,
      "storage",
      "Impact index returned an unrelated receipt",
    );
    const supersession = await tx.impactSupersession(receipt.id);
    population.push({ receiptId: receipt.id, receiptDigest, supersession });
    evaluations.push({
      receipt,
      inclusion,
      before,
      after: next,
      dependencyChange: configurationDependencyChange(before, next),
      supersession,
    });
  }
  const result: ConfigurationImpact = {
    contract: "configuration_impact",
    version: 1,
    pair,
    basis: {
      ...selection,
      policy: "declared-reference-dependencies-v1",
      pairDigest: pair.basis.digest,
    },
    discovery: {
      evidenceRevision,
      entityIds,
      relationshipIds,
      population: "matching_declared_dependencies_page",
      after: input.after ?? null,
      limit,
      excluded: "receipts_without_matching_declared_dependencies",
      digest: await factDigest({ after: input.after ?? null, limit, population }),
    },
    evaluations: {
      items: evaluations,
      ...(page.nextAfter
        ? {
            nextAfter: JSON.stringify({
              pairDigest: pair.basis.digest,
              evidenceRevision,
              sequence: page.nextAfter,
            }),
          }
        : {}),
    },
    completeness: {
      engineeringImpact: "not_assessed",
      undeclaredDependencies: "unknown",
      passage: "not_assessed",
      outcomes: "retained_without_interpretation",
    },
  };
  ensure(
    new TextEncoder().encode(JSON.stringify(result)).length <= 8388608,
    "validation",
    "Pair impact exceeds 8 MiB; narrow the captured scope",
  );
  return result;
}
