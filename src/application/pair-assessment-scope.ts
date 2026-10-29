import { ensure } from "../core/model.ts";
import type {
  AssessmentScope,
  OpenChangeAssessment,
  AssessmentPairQuery,
} from "../core/change-assessment.ts";
import { changeAssessmentLimits } from "../core/change-assessment.ts";
import type { Transaction } from "./ports/repository.ts";
import { compareConfigurations } from "./configuration-comparison.ts";
import { configurationImpactGraph } from "./configuration-impact-graph.ts";
import { impactNativeFromGraphs } from "./impact-graph.ts";
import { impactTraversalScope } from "./impact-context.ts";
import { configurationEngineeringState, boundedEngineeringState } from "./engineering-state.ts";
import { referenceEngineeringState } from "./reference-engineering-state.ts";
import { compareCapturedInputs } from "./receipt-comparison.ts";
import { receiptScope } from "./impact-receipt-scope.ts";
import { nativeCandidates, receiptCandidate } from "./assessment-candidates.ts";
import { validateReceiptDependencyPopulation } from "./configuration-applicability.ts";

export async function discoverPairAssessmentScope(
  tx: Transaction,
  request: Pick<OpenChangeAssessment, "assessmentId" | "purpose"> & { query: AssessmentPairQuery },
): Promise<AssessmentScope> {
  const pair = await compareConfigurations(tx, {
    beforeId: request.query.beforeId,
    afterId: request.query.afterId,
  });
  ensure(
    pair.before.capture && pair.after.capture,
    "validation",
    "Pair assessment requires controlled configurations",
  );
  ensure(
    pair.comparability.state !== "incompatible",
    "validation",
    "Pair assessment requires a common selected engineering subject",
  );
  const scope = impactTraversalScope(request.query);
  const schemas = [
    pair.before.capture.context.schema,
    pair.after.capture.context.schema,
    ...pair.before.relationships!.map((x) => x.schema),
    ...pair.after.relationships!.map((x) => x.schema),
  ];
  ensure(
    scope.relationshipTypes.every((type) =>
      schemas.some((schema) => Object.hasOwn(schema.relationshipTypes, type)),
    ),
    "validation",
    "Pair investigation relationship type is not declared in selected schemas",
  );
  const native = await impactNativeFromGraphs(
    configurationImpactGraph(pair.before),
    configurationImpactGraph(pair.after),
    scope,
  );
  ensure(
    native.entities.length + native.relationships.length <= changeAssessmentLimits.candidates,
    "validation",
    "Assessment exceeds 25 candidates; narrow the selected investigation scope",
  );
  const selected = boundedEngineeringState(
    referenceEngineeringState(tx, await configurationEngineeringState(tx, request.query.afterId)),
    8388608,
    "Pair assessment discovery exceeds 8 MiB selected reads; narrow the scope",
  );
  const candidates = await nativeCandidates(native, (id) => selected.getObservation(id));
  const entityIds = new Set(native.entities.map((x) => x.id)),
    relationshipIds = new Set(native.relationships.map((x) => x.id));
  const receipts = [];
  let after: string | undefined;
  let bytes = 0;
  do {
    const page = await tx.impactReceipts({
      entityIds: [...entityIds],
      relationshipIds: [...relationshipIds],
      after,
      limit: 1,
      excludeOutputId: request.assessmentId,
    });
    for (const receipt of page.items) {
      ensure(
        candidates.length + receipts.length < changeAssessmentLimits.candidates,
        "validation",
        "Assessment exceeds 25 candidates; narrow the selected investigation scope",
      );
      validateReceiptDependencyPopulation(receipt);
      bytes += new TextEncoder().encode(JSON.stringify(receipt)).length;
      ensure(
        bytes <= 4194304,
        "validation",
        "Pair assessment receipt discovery exceeds 4 MiB; narrow the scope",
      );
      const comparison = await compareCapturedInputs(tx, receipt, selected);
      receipts.push(
        receiptCandidate(
          {
            receipt,
            comparison,
            scope: receiptScope(comparison, entityIds, relationshipIds, "configuration"),
            supersession: await tx.impactSupersession(receipt.id),
          },
          entityIds,
        ),
      );
    }
    after = page.nextAfter;
  } while (after);
  const result: AssessmentScope = {
    contract: "change_assessment_scope",
    version: 2,
    purpose: request.purpose,
    query: {
      source: "configuration_pair",
      beforeId: request.query.beforeId,
      afterId: request.query.afterId,
      policy: request.query.policy,
      ...scope,
    },
    basis: {
      projectRevision: await tx.headRevision(),
      evidenceRevision: await tx.impactEvidenceRevision(),
      schemaVersion: (await tx.get("schema", "project"))!.version,
      pair: pair.basis,
    },
    discovery: {
      complete: true,
      interpretation: "selected_configuration_pair",
      excludedReceiptOutputId: request.assessmentId,
      before: native.before,
      after: native.after,
      comparability: pair.comparability,
    },
    candidates: [...candidates, ...receipts],
  };
  ensure(
    new TextEncoder().encode(JSON.stringify(result)).length <= changeAssessmentLimits.scopeBytes,
    "validation",
    "Assessment scope exceeds 64 KiB; narrow the selected investigation scope",
  );
  return result;
}
