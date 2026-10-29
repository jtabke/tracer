import { ensure, knownProperties, record } from "../core/model.ts";
import type { AssessmentScopeQuery } from "../core/change-assessment.ts";
import { isPairAssessmentQuery } from "../core/change-assessment.ts";
import { impactQuery, impactTraversalScope } from "./impact-context.ts";
import { validateConfigurationPair } from "./configuration-comparison.ts";

export function prepareAssessmentQuery(query: AssessmentScopeQuery) {
  ensure(record(query), "validation", "Select an assessment discovery scope");
  if (isPairAssessmentQuery(query)) {
    knownProperties(query, [
      "source",
      "beforeId",
      "afterId",
      "policy",
      "rootId",
      "direction",
      "relationshipTypes",
      "depth",
    ]);
    ensure(
      query.policy === "scoped-reference-dependencies-v1",
      "validation",
      "Unsupported pair assessment policy",
    );
    validateConfigurationPair({ beforeId: query.beforeId, afterId: query.afterId });
    impactTraversalScope(query);
  } else {
    knownProperties(query, ["baselineId", "rootId", "direction", "relationshipTypes", "depth"]);
    impactQuery(query);
  }
}
