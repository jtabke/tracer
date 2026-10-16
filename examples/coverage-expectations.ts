import type { CoverageExpectation, CoverageExpectations } from "../src/core/coverage.ts";

function rule(
  name: string,
  subjectType: string,
  relationshipType: string,
  relatedType: string,
): CoverageExpectation {
  return {
    name,
    subject: { type: subjectType },
    relationshipType,
    direction: "outgoing",
    related: { type: relatedType },
    minimumDistinctTargets: 1,
  };
}
/** Fictional project-authored structural policies; these names carry no engine semantics. */
export const exampleCoverage: Record<
  "medical" | "technology" | "integrated",
  CoverageExpectations
> = {
  medical: {
    "product-verification": rule(
      "Product requirements have a verification definition",
      "product_requirement",
      "verified_by",
      "verification_protocol",
    ),
    "design-verification": rule(
      "Design outputs are linked to verification definitions",
      "design_output",
      "verified_by",
      "verification_protocol",
    ),
    "verification-record": rule(
      "Verification definitions have a recorded run",
      "verification_protocol",
      "executed_as",
      "test_run",
    ),
  },
  technology: {
    "story-check": rule(
      "Stories have an acceptance scenario",
      "story",
      "checked_by",
      "test_scenario",
    ),
    "implementation-check": rule(
      "Implementations have a check scenario",
      "implementation",
      "checked_by",
      "test_scenario",
    ),
    "scenario-record": rule(
      "Check scenarios have a recorded run",
      "test_scenario",
      "exercised_as",
      "test_run",
    ),
  },
  integrated: {
    "target-evaluation": rule(
      "Product targets have an evaluation definition",
      "target",
      "evaluated_by",
      "evaluation",
    ),
    "design-evaluation": rule(
      "Designs have an evaluation definition",
      "design",
      "evaluated_by",
      "evaluation",
    ),
    "evaluation-configuration": rule(
      "Evaluations identify a build configuration",
      "evaluation",
      "evaluated_configuration",
      "build_configuration",
    ),
  },
};
