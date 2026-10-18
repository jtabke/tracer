import type { Schema } from "./model.ts";
import type { ChainView } from "./presentation.ts";

/** Optional engineering vocabulary; structural policies never claim execution or satisfaction. */
export function engineeringStarter(base: Schema): Schema {
  const result = structuredClone(base);
  Object.assign(result.entityTypes.requirement.fields, {
    acceptance: { type: "string" },
    subsystem: { type: "string" },
  });
  Object.assign(result.entityTypes.design.fields, {
    subsystem: { type: "string" },
    build: { type: "string" },
  });
  Object.assign(result.entityTypes.test.fields, {
    method: { type: "string" },
    expected_result: { type: "string" },
    build: { type: "string" },
  });
  // Linking a plan should not require inventing review/version metadata.
  for (const field of Object.values(result.relationshipTypes.mapped_to.fields))
    field.required = false;
  result.coverageExpectations = {
    requirement_intent: {
      name: "Requirements trace to an intent",
      subject: { type: "requirement" },
      relationshipType: "contributes_to",
      direction: "outgoing",
      related: { type: "intent" },
      minimumDistinctTargets: 1,
    },
    requirement_design: {
      name: "Requirements have a design allocation",
      subject: { type: "requirement" },
      relationshipType: "mapped_to",
      direction: "outgoing",
      related: { type: "design" },
      minimumDistinctTargets: 1,
    },
    requirement_verification: {
      name: "Requirements have a verification plan",
      subject: { type: "requirement" },
      relationshipType: "mapped_to",
      direction: "outgoing",
      related: { type: "test" },
      minimumDistinctTargets: 1,
    },
    design_verification: {
      name: "Designs identify a test plan",
      subject: { type: "design" },
      relationshipType: "tested_by",
      direction: "outgoing",
      related: { type: "test" },
      minimumDistinctTargets: 1,
    },
  };
  return result;
}

export const engineeringViews: { name: string; definition: ChainView }[] = [
  {
    name: "Requirements → design → verification",
    definition: {
      kind: "chain",
      type: "requirement",
      steps: [
        { relationshipType: "mapped_to", type: "design", direction: "outgoing" },
        { relationshipType: "tested_by", type: "test", direction: "outgoing" },
      ],
    },
  },
  {
    name: "Requirement acceptance → verification",
    definition: {
      kind: "chain",
      type: "requirement",
      steps: [{ relationshipType: "mapped_to", type: "test", direction: "outgoing" }],
    },
  },
  {
    name: "Requirements → intent",
    definition: {
      kind: "chain",
      type: "requirement",
      steps: [{ relationshipType: "contributes_to", type: "intent", direction: "outgoing" }],
    },
  },
];
