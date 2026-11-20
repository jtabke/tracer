export const titleCase = (text: unknown) => String(text).replaceAll("_", " ");
const labels: Record<string, string> = {
  product_requirement: "Product requirement",
  subsystem_requirement: "Subsystem requirement",
  component_requirement: "Component requirement",
  verification_protocol: "Verification plan",
  validation_protocol: "Validation plan",
  design_output: "Design output",
  user_need: "User need",
  test_run: "Recorded run",
};
export const typeName = (type: string) =>
  type === "@resource" ? "Resource" : (labels[type] ?? titleCase(type));

const relationshipLabels: Record<string, readonly [string, string]> = {
  decomposes_into: ["Decomposes into", "Decomposed from"],
  verified_by: ["Verified by", "Verification criteria for"],
  validated_by: ["Validated by", "Validation criteria for"],
  realized_by: ["Realized by", "Realizes"],
  specified_by: ["Specified by", "Specifies"],
  references: ["References", "Referenced by"],
  depends_on: ["Depends on", "Required by"],
  contains: ["Contains", "Contained in"],
  executed_as: ["Executed as", "Execution of"],
  examines_output: ["Examines output", "Examined by"],
};

// Presentation labels do not change the canonical relationship's type or endpoints.
export function relationshipLabel(type: string, outgoing: boolean) {
  return (
    relationshipLabels[type]?.[outgoing ? 0 : 1] ??
    `${outgoing ? "Outgoing" : "Incoming"} · ${titleCase(type)}`
  );
}
export const MAX_VISIBLE = 50;
