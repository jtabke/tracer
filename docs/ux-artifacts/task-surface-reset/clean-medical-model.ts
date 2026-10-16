import { medicalDeviceExample } from "../../../examples/medical-device-example.ts";
import type { ExampleItem, ExampleLink } from "../../../examples/realistic-model.ts";
import type { Schema, RelationshipDefinition } from "../../../src/core/model.ts";
import type { WorkflowConnection } from "../../../src/core/schema-workflow.ts";

/** Fresh study model, never a migration of the earlier Aster repository. */
export const configurationKey = "EVAL-CONFIG-01";
const requirements = ["product_requirement", "subsystem_requirement", "component_requirement"];
const coreTypes = [
  "device",
  "user_need",
  ...requirements,
  "design_output",
  "verification_protocol",
  "validation_protocol",
  "test_run",
  "risk",
  "risk_control",
  "design_change",
];
const reviewTypes = [
  ...requirements,
  "design_output",
  "verification_protocol",
  "test_run",
  "risk",
  "evaluation_configuration",
];
const inputTypes = [...requirements, "design_output", "verification_protocol"];
const route = (
  source: string,
  target: string,
  label: string,
  direction: "forward" | "reverse" = "forward",
): WorkflowConnection => ({ source, target, direction, label });
function relation(
  source: string[],
  target: string[],
  workflow: WorkflowConnection[],
): RelationshipDefinition {
  return { source, target, fields: { scope: { type: "string" } }, workflow };
}
function single(source: string, target: string, label: string): RelationshipDefinition {
  return relation([source], [target], [route(source, target, label)]);
}
function fan(source: string[], target: string, label: string): RelationshipDefinition {
  return relation(
    source,
    [target],
    source.map((type) => route(type, target, label)),
  );
}
function fanOut(source: string, target: string[], label: string): RelationshipDefinition {
  return relation(
    [source],
    target,
    target.map((type) => route(source, type, label)),
  );
}

export function cleanMedicalSchema(): Schema {
  const entityTypes = Object.fromEntries(
    coreTypes.map((type) => [type, structuredClone(medicalDeviceExample.schema.entityTypes[type])]),
  );
  delete entityTypes.test_run.fields.build;
  Object.assign(entityTypes.design_change.fields, {
    scope: { type: "string" },
    rationale: { type: "string" },
  });
  entityTypes.evaluation_configuration = {
    fields: {
      title: { type: "string", required: true },
      statement: { type: "string", required: true },
      scope: { type: "string", required: true },
      status: { type: "string" },
      owner: { type: "string" },
    },
  };
  return {
    entityTypes,
    relationshipTypes: {
      has_user_need: single("device", "user_need", "intended-use needs"),
      addressed_by_requirement: single("user_need", "product_requirement", "product design inputs"),
      allocated_to_subsystem: single(
        "product_requirement",
        "subsystem_requirement",
        "subsystem allocation",
      ),
      allocated_to_component: single(
        "subsystem_requirement",
        "component_requirement",
        "component allocation",
      ),
      implemented_by: fan(requirements, "design_output", "design contribution"),
      verified_by: fan(requirements, "verification_protocol", "verification criteria"),
      examines_output: relation(
        ["verification_protocol"],
        ["design_output"],
        [route("verification_protocol", "design_output", "planned output examination", "reverse")],
      ),
      validated_by: single("user_need", "validation_protocol", "intended-use validation plan"),
      produces_result: fan(
        ["verification_protocol", "validation_protocol"],
        "test_run",
        "recorded evaluation result",
      ),
      controlled_by: single("risk", "risk_control", "proposed risk control"),
      specified_as_requirement: single(
        "risk_control",
        "product_requirement",
        "control design input",
      ),
      depends_on: single("design_output", "design_output", "design dependency"),
      requires_review_of: fanOut("design_change", reviewTypes, "recorded review subject"),
      includes_input: fanOut("evaluation_configuration", inputTypes, "selected native input"),
      evaluated_configuration: single(
        "test_run",
        "evaluation_configuration",
        "recorded input configuration",
      ),
    },
    coverageExpectations: {
      "product-verification": coverage(
        "Product inputs have a verification definition",
        "product_requirement",
        "verified_by",
        "verification_protocol",
      ),
      "design-examination": coverage(
        "Design outputs have a planned examination",
        "design_output",
        "examines_output",
        "verification_protocol",
        "incoming",
      ),
      "verification-result": coverage(
        "Verification definitions have a recorded result",
        "verification_protocol",
        "produces_result",
        "test_run",
      ),
    },
  };
}
function coverage(
  name: string,
  type: string,
  relationshipType: string,
  related: string,
  direction: "incoming" | "outgoing" = "outgoing",
) {
  return {
    name,
    subject: { type },
    relationshipType,
    direction,
    related: { type: related },
    minimumDistinctTargets: 1,
  };
}

const changeScope =
  "Review mechanical flow, deflation control, BP signal quality, Stop timing, passive release, risk controls and the recorded baseline inputs.";
const changeRationale =
  "The simulated RUN-06 passive-release finding motivates investigation. No corrected design, executed comparison or approval is recorded.";
export function cleanMedicalItems(): ExampleItem[] {
  const items = medicalDeviceExample.items
    .filter(([type]) => coreTypes.includes(type))
    .map(cleanItem);
  items.push([
    "evaluation_configuration",
    configurationKey,
    "Recorded verification input configuration",
    "Selected native requirements, protocols and design outputs used by the simulated reports. The separate immutable capture records exact revisions and selected connection revisions; this is not an assembled physical build.",
    {
      scope:
        "A selected 29-member native input set, including this configuration record. It is not a complete device BOM, clinical study or approved baseline.",
      status: "recorded native inputs",
    },
  ]);
  return items;
}
function cleanItem(item: ExampleItem): ExampleItem {
  const copy = structuredClone(item);
  if (copy[0] === "test_run" && copy[4]) delete copy[4].build;
  if (copy[1] === "CHG-02") enrichChange(copy);
  return copy;
}
function enrichChange(item: ExampleItem) {
  item[3] += " " + changeScope + " " + changeRationale;
  item[4] = { ...item[4], scope: changeScope, rationale: changeRationale };
}

const relationshipNames: Record<string, string> = {
  realized_by: "implemented_by",
  verified_by: "verified_by",
  validated_by: "validated_by",
  executed_as: "produces_result",
  mitigated_by: "controlled_by",
  specified_by: "specified_as_requirement",
  depends_on: "depends_on",
  affects: "requires_review_of",
};
const hierarchyNames: Record<string, string> = {
  device: "has_user_need",
  user_need: "addressed_by_requirement",
  product_requirement: "allocated_to_subsystem",
  subsystem_requirement: "allocated_to_component",
};
const itemTypes = new Map(medicalDeviceExample.items.map(([type, key]) => [key, type]));
export function cleanMedicalLinks(): ExampleLink[] {
  // Historical baseline topology. medical-link-cleanup.ts corrects current links after capture.
  const links = medicalDeviceExample.links.filter(keepLink).map(mapLink);
  links.push([
    "requires_review_of",
    "CHG-02",
    configurationKey,
    "Recorded assessment subject; no impact conclusion or approval is inferred.",
  ]);
  for (const member of selectedInputKeys())
    links.push([
      "includes_input",
      configurationKey,
      member,
      "Current identity membership. Exact selected revisions are held by the separate immutable capture.",
    ]);
  for (const receipt of medicalDeviceExample.receipts)
    links.push([
      "evaluated_configuration",
      receipt.output,
      configurationKey,
      "The result records selected native inputs through its immutable capture association; no physical build is asserted.",
    ]);
  return links;
}
function keepLink([type]: ExampleLink) {
  return type === "decomposes_into" || Object.hasOwn(relationshipNames, type);
}
function mapLink([type, source, target, scope]: ExampleLink): ExampleLink {
  if (type === "decomposes_into")
    return [hierarchyNames[itemTypes.get(source)!], source, target, scope];
  if (type === "verified_by" && itemTypes.get(source) === "design_output")
    return ["examines_output", target, source, scope];
  return [relationshipNames[type], source, target, scope];
}
export function selectedInputKeys(): string[] {
  return [
    ...new Set([
      ...Array.from({ length: 9 }, (_, index) => `OUT-${String(index + 1).padStart(2, "0")}`),
      ...medicalDeviceExample.receipts.flatMap((receipt) => receipt.inputs),
    ]),
  ];
}
export const cleanMedicalReceipts = medicalDeviceExample.receipts.map((receipt) => ({
  ...structuredClone(receipt),
  inputs: [...receipt.inputs, configurationKey],
}));
export const cleanMedicalChanges = structuredClone(medicalDeviceExample.changes);
