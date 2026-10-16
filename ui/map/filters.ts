import { typeNames } from "./model.ts";
import type { Fixture } from "./types.ts";

// Presentation categories for the fictional study, not engineering containment.
export const itemFilterGroups = [
  {
    label: "Product definition",
    types: [
      "device",
      "user_need",
      "product_requirement",
      "subsystem_requirement",
      "component_requirement",
      "design_output",
    ],
  },
  {
    label: "Verification & validation",
    types: ["verification_protocol", "validation_protocol", "test_run"],
  },
  { label: "Risk & change", types: ["risk", "risk_control", "design_change"] },
  { label: "Evaluation setup", types: ["evaluation_configuration"] },
];

export const connectionFilterGroups = [
  {
    label: "Definition & implementation",
    types: [
      "has_user_need",
      "addressed_by_requirement",
      "allocated_to_subsystem",
      "allocated_to_component",
      "implemented_by",
      "depends_on",
    ],
  },
  {
    label: "Verification & validation",
    types: ["verified_by", "examines_output", "validated_by", "produces_result"],
  },
  {
    label: "Risk & change",
    types: ["controlled_by", "specified_as_requirement", "requires_review_of"],
  },
  { label: "Evaluation context", types: ["includes_input", "evaluated_configuration"] },
];

export const connectionNames: Record<string, string> = {
  has_user_need: "Product needs",
  addressed_by_requirement: "Needs to product requirements",
  allocated_to_subsystem: "Subsystem allocation",
  allocated_to_component: "Component allocation",
  implemented_by: "Design implementation",
  depends_on: "Design dependencies",
  verified_by: "Requirement verification",
  examines_output: "Design output examination",
  validated_by: "Intended-use validation",
  produces_result: "Plan to recorded run",
  controlled_by: "Risk controls",
  specified_as_requirement: "Control requirements",
  requires_review_of: "Change review subjects",
  includes_input: "Evaluation input selection",
  evaluated_configuration: "Run input configuration",
};

export const itemDescriptions: Record<string, string> = {
  design_output: "Drawings, specifications and implementation artifacts",
  test_run: "Recorded executions, separate from plans",
  evaluation_configuration: "Named sets of records used for an evaluation",
};

export function groupedChoices(groups: { label: string; types: string[] }[], types: string[]) {
  const remaining = new Set(types);
  const result = groups
    .map((group) => {
      const members = group.types.filter((type) => remaining.delete(type));
      return { ...group, types: members };
    })
    .filter((group) => group.types.length);
  if (remaining.size) result.push({ label: "Other", types: [...remaining] });
  return result;
}

export function relevantRelationships(schema: Fixture["schema"], types: string[]) {
  const selected = new Set(types);
  return Object.entries(schema.relationshipTypes)
    .filter(([, definition]) => {
      if (definition.workflow?.length)
        return definition.workflow.some(
          (path) => selected.has(path.source) && selected.has(path.target),
        );
      return (
        (definition.source ?? types).some((type) => selected.has(type)) &&
        (definition.target ?? types).some((type) => selected.has(type))
      );
    })
    .map(([type]) => type);
}

function endpointNames(types: string[] | undefined) {
  if (!types) return "Any item type";
  if (!types.length) return "No item types";
  const requirements = ["product_requirement", "subsystem_requirement", "component_requirement"];
  const combined = requirements.every((type) => types.includes(type));
  return [
    ...(combined ? ["Requirements"] : []),
    ...types
      .filter((type) => !combined || !requirements.includes(type))
      .map((type) => typeNames[type] ?? type),
  ].join(", ");
}

export function connectionEndpoints(definition: Fixture["schema"]["relationshipTypes"][string]) {
  // Source/target are the native relationship direction, independent of layout.
  return `${endpointNames(definition.source)} → ${endpointNames(definition.target)}`;
}
