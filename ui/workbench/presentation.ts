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
export const typeName = (type: string) => labels[type] ?? titleCase(type);
export const MAX_VISIBLE = 50;
