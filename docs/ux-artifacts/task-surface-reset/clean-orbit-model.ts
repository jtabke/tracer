import { integratedProductExample as original } from "../../../examples/integrated-product-example.ts";
import type { ExampleItem, ExampleLink } from "../../../examples/realistic-model.ts";
import type { Schema, RelationshipDefinition } from "../../../src/core/model.ts";
import type { WorkflowConnection } from "../../../src/core/schema-workflow.ts";

const typeOf = new Map(original.items.map(([type, key]) => [key, type]));
const criteria = ["target", "requirement", "interface"];
const selectionTypes = ["design", "requirement", "target", "interface"];
const reviewTypes = [...criteria, "design", "component", "evaluation", "evaluation_configuration"];
function relation(
  source: string[],
  target: string[],
  label: string,
  reverse = false,
): RelationshipDefinition {
  return {
    source,
    target,
    fields: { scope: { type: "string" } },
    workflow: source.flatMap((from) =>
      target.map((to): WorkflowConnection => ({
        source: from,
        target: to,
        direction: reverse ? "reverse" : "forward",
        label,
      })),
    ),
  };
}
export function cleanOrbitSchema(): Schema {
  const entityTypes = structuredClone(original.schema.entityTypes);
  entityTypes.evaluation_configuration = entityTypes.build_configuration;
  delete entityTypes.build_configuration;
  delete entityTypes.evaluation_configuration.fields.manifest;
  delete entityTypes.evaluation.fields.outcome;
  return {
    entityTypes,
    relationshipTypes: {
      has_goal: relation(["product"], ["goal"], "product intent"),
      has_target: relation(["goal"], ["target"], "success criteria"),
      allocated_to_function: relation(["target"], ["function"], "functional responsibility"),
      specified_by_requirement: relation(["function"], ["requirement"], "engineering allocation"),
      contains: relation(["product", "component"], ["component"], "assembly membership"),
      realized_by: relation(["requirement"], ["design"], "direct design contribution"),
      defines: relation(["design"], ["component"], "component design facet"),
      provides: relation(["component"], ["interface"], "contract provider"),
      consumes: relation(["component"], ["interface"], "contract consumer", true),
      depends_on: relation(["design"], ["design"], "direct design prerequisite"),
      considers: relation(
        ["decision"],
        ["concept", "experiment", "finding", "evaluation"],
        "decision input",
        true,
      ),
      explores: relation(["experiment"], ["concept"], "alternative under investigation", true),
      investigated_by: relation(["target"], ["experiment"], "planned user investigation"),
      evaluated_by: relation(criteria, ["evaluation"], "planned evaluation criterion"),
      examines_design: relation(["evaluation"], ["design"], "design under examination", true),
      finding_from: relation(["finding"], ["evaluation"], "recorded evaluation context", true),
      requires_review_of: relation(["change_assessment"], reviewTypes, "recorded review subject"),
      configuration_includes: relation(
        ["evaluation_configuration"],
        selectionTypes,
        "selected native input",
        true,
      ),
      evaluated_configuration: relation(
        ["evaluation"],
        ["evaluation_configuration"],
        "recorded input selection",
        true,
      ),
      release_considers: relation(
        ["release"],
        ["decision", "evaluation_configuration", "finding"],
        "release review input",
        true,
      ),
    },
    coverageExpectations: {
      "design-examination": {
        name: "Designs have a recorded evaluation scope",
        subject: { type: "design" },
        relationshipType: "examines_design",
        direction: "incoming",
        related: { type: "evaluation" },
        minimumDistinctTargets: 1,
      },
      "evaluation-selection": {
        name: "Evaluations identify selected input configurations",
        subject: { type: "evaluation" },
        relationshipType: "evaluated_configuration",
        direction: "outgoing",
        related: { type: "evaluation_configuration" },
        minimumDistinctTargets: 1,
      },
    },
  };
}
/** Initial capture schema only; current authoring uses cleanOrbitSchema without result fields. */
export function orbitReceiptSchema(): Schema {
  const schema = cleanOrbitSchema();
  schema.entityTypes.evaluation.fields.outcome = { type: "string" };
  return schema;
}

export function cleanOrbitItems(): ExampleItem[] {
  return original.items.filter((item) => item[1] !== "DEC-R03").map(cleanItem);
}
function cleanItem(item: ExampleItem): ExampleItem {
  const copy = structuredClone(item);
  if (copy[0] === "build_configuration") normalizeSelection(copy);
  if (["EVAL-R05", "EVAL-R06"].includes(copy[1])) delete copy[4]!.outcome;
  return copy;
}
function normalizeSelection(item: ExampleItem) {
  item[0] = "evaluation_configuration";
  item[4] = { ...item[4] };
  delete item[4].manifest;
  item[4].scope = original.configurations!.find((entry) => entry.key === item[1])!.scope;
  item[3] =
    item[1] === "BUILD-R01"
      ? "Selected baseline design and criterion records for simulated evaluations. Exact native revisions are stored in the immutable capture; this record does not establish an assembled prototype or physical build."
      : "Proposed input selection substitutes the option-B installation design. It differs from the baseline selection but has no assembled prototype, executed evaluation or acceptance.";
}
export const orbitReceiptDefinitions = structuredClone(original.receipts);
export const orbitChanges = structuredClone(original.changes);
export const orbitFollowUp = structuredClone(original.followUpConfiguration!);
export const orbitSelections = original.configurations!.map((selection) => ({
  ...structuredClone(selection),
  members: selectionMembers(selection.key, selection.members),
}));
function selectionMembers(key: string, members: string[]) {
  const receiptInputs = original.receipts
    .filter((receipt) => receipt.inputs.includes(key))
    .flatMap((receipt) => receipt.inputs);
  return [...new Set([...members, ...receiptInputs])].filter((member) => member !== key);
}

const hierarchy: Record<string, string> = {
  product: "has_goal",
  goal: "has_target",
  target: "allocated_to_function",
  function: "specified_by_requirement",
};
export function cleanOrbitLinks(): ExampleLink[] {
  const links = original.links.filter(keepLink).map(mapLink);
  links.push([
    "depends_on",
    "DES-02",
    "DES-03",
    "The blower installation's selected duct interface must remain compatible with CLEAN-03 brush/duct geometry. This is a drawing-interface prerequisite, not a pickup result.",
  ]);
  links.push([
    "investigated_by",
    "TGT-05",
    "EXP-R03",
    "Planned representative-user tasks investigate pending/confirmed schedule comprehension. No users have been observed; interrupted-delivery checks are a separate engineering activity.",
  ]);
  for (const selection of orbitSelections)
    for (const member of selection.members)
      links.push([
        "configuration_includes",
        selection.key,
        member,
        "Selected current identity; the associated immutable capture owns the exact recorded native revision. No physical BOM completeness is asserted.",
      ]);
  return links;
}
function keepLink([type, source, target]: ExampleLink) {
  if (type === "configuration_includes") return false;
  return !unsupported.has(`${type}/${source}/${target}`);
}
const unsupported = new Set([
  "defines/DES-01/PART-05",
  "consumes/PART-06/IF-01",
  "evaluated_by/TGT-05/EVAL-R06",
]);
function mapLink([type, source, target, oldScope]: ExampleLink): ExampleLink {
  if (type === "breaks_down_into")
    return [hierarchy[typeOf.get(source)!], source, target, oldScope];
  if (type === "evaluated_by" && typeOf.get(source) === "design")
    return ["examines_design", target, source, articleScope(source, target)];
  const name = relationshipName(type);
  return [name, source, target, exactScope(type, source, target, oldScope)];
}
function relationshipName(type: string) {
  return type === "assessment_references" ? "requires_review_of" : type;
}
function exactScope(type: string, source: string, target: string, oldScope?: string) {
  return linkScopes[type]?.[`${source}/${target}`] ?? oldScope;
}
function articleScope(design: string, evaluation: string) {
  return `Planned examination of ${design} within ${evaluation}'s declared setup. Only an immutable receipt's explicit inputs identify the revisions actually recorded; this link does not establish execution.`;
}
const linkScopes: Record<string, Record<string, string>> = {
  realized_by: {
    "REQ-R01/DES-01":
      "Control duty-profile contribution to the blower envelope and commanded flow; no envelope conformance or pickup success is established.",
    "REQ-R01/DES-02":
      "Selected blower installation and duct-interface contribution to airflow; not a firmware duty limit or demonstrated pickup result.",
    "REQ-R02/DES-03":
      "Brush geometry, air path and seal design contribution to the integrated pickup task.",
    "REQ-R03/DES-01":
      "Commanded blower duty contributes to the shared energy allocation; not a whole-product runtime guarantee.",
    "REQ-R03/DES-04":
      "Pack use and energy-allocation assumptions contribute to the product duty budget.",
    "REQ-R04/DES-01":
      "Firmware duty/temperature behavior contributes derating control; the driver thermal path is a separate design contribution.",
    "REQ-R04/DES-05":
      "Driver switching, monitoring and thermal path contribute to the temperature-limit/derating allocation.",
    "REQ-R05/DES-01":
      "Blower-command timing contribution; navigation task scheduling is defined separately and no timing evaluation is recorded.",
    "REQ-R05/DES-06":
      "Control-task scheduling contribution to actuator command timing; no timing evaluation is recorded.",
    "REQ-R06/DES-04":
      "Shared-rail supply and transient-response contribution to controller power retention.",
    "REQ-R06/DES-05":
      "Driver loading and switching contribution to shared-rail transients; no standalone supply-retention proof.",
    "REQ-R07/DES-06": "Route recovery and incomplete-cleaning state contribution.",
    "REQ-R08/DES-07":
      "Local schedule revision persistence and acknowledgment-state contribution across app/robot delivery.",
    "REQ-R09/DES-03":
      "Bin release, filter/brush access and seal-location contribution to service access.",
    "REQ-R10/DES-01":
      "Commanded speed-profile contribution to whole-robot acoustic setup; no acoustic result exists.",
    "REQ-R10/DES-02":
      "Blower mounting/installation contribution to whole-robot acoustics; not a motor-only sound result.",
    "REQ-R10/DES-08":
      "Acoustic mounting and operating-profile plan; its inclusion does not establish an executed acoustic evaluation.",
  },
  evaluated_by: {
    "TGT-01/EVAL-R01":
      "Planned criterion: debris mass collected in the defined two-pass hard-floor task against the 90% target; no motor-only inference.",
    "REQ-R01/EVAL-R01":
      "Planned criterion scope: pickup behavior under the selected baseline blower profile. The weighing method does not separately establish firmware duty-envelope conformance.",
    "REQ-R02/EVAL-R01":
      "Planned criterion: integrated brush/duct contribution in the defined pickup configuration; the aggregate task does not isolate suction from geometry.",
    "TGT-02/EVAL-R02":
      "Planned criterion scope: energy use under the declared cleaning profile as a runtime input. A power trace does not alone prove a 60-minute completed session.",
    "REQ-R03/EVAL-R02":
      "Planned criterion: whole-product power allocation under the declared duty/usable-energy assumptions. The captured result predates the control-profile edit.",
    "REQ-R04/EVAL-R03":
      "Planned criterion: driver-temperature indication and derating in the selected sustained-load scenario. Combined high-suction thermal behavior is outside captured coverage.",
    "REQ-R06/EVAL-R04":
      "Planned criterion: shared-rail controller-supply retention during the defined combined blower-start/traction transient; no complete fault-space claim.",
    "IF-01/EVAL-R04":
      "Planned criterion: supply/transient behavior at the shared power contract in the defined combined-load scenario, separate from any claim that firmware physically consumes the rail.",
    "TGT-03/EVAL-R05":
      "Planned criterion: whole-robot sound level under the stated setup against the 65 dBA draft target. Setup and execution remain open.",
    "REQ-R10/EVAL-R05":
      "Planned criterion: blower, mounting and speed profile evaluated together. No acoustic receipt exists.",
    "REQ-R08/EVAL-R06":
      "Planned criterion: interrupted delivery, restart and revision-conflict behavior of local persistence/acknowledgment. User comprehension is investigated separately by EXP-R03.",
    "IF-03/EVAL-R06":
      "Planned criterion: schedule-version and acknowledgment behavior in the declared delivery checks. No execution or user-comprehension result exists.",
  },
  depends_on: {
    "DES-01/DES-04":
      "Blower duty allocation depends on the pack/shared-rail energy and transient assumptions in PWR-04; this is design context, not a software-as-physical-consumer link.",
    "DES-01/DES-05":
      "Blower switching commands and temperature/derating behavior depend on the driver monitoring and thermal assumptions in DRV-05.",
    "DES-01/DES-06":
      "Blower command timing depends on the coordinated control-task schedule described by the navigation scheduling design.",
  },
  provides: {
    "PART-04/IF-01":
      "Battery/power assembly provides the physical actuator rail and its declared transient supply conditions.",
    "PART-06/IF-02":
      "Firmware provides the command/duty side of the bidirectional command-monitoring contract; temperature feedback returns from the driver. This role does not imply one-way signaling.",
    "PART-06/IF-03":
      "Robot firmware provides schedule version/persistence/acknowledgment service to the companion app.",
  },
  consumes: {
    "PART-05/IF-01":
      "Driver board consumes the physical actuator rail under the declared load/transient contract.",
    "PART-05/IF-02":
      "Driver board accepts firmware commands and returns monitoring feedback within the shared contract; consumer role does not erase reverse feedback.",
    "PART-07/IF-03":
      "Companion app uses robot schedule revision/acknowledgment behavior; local proposal is distinct from robot confirmation.",
  },
  finding_from: {
    "FIND-R01/EVAL-R01":
      "Recorded review of the simulated pickup shortfall, not a conclusion selecting a corrective concept.",
    "FIND-R02/EVAL-R02":
      "Recorded review that the immutable energy evidence uses control design v1; current drift does not automatically invalidate it.",
    "FIND-R03/EVAL-R04":
      "Recorded review of the simulated shared-rail reset scenario; no accepted corrective design is recorded.",
    "FIND-R04/EVAL-R05":
      "Review finding of absent acoustic execution, not an observed sound measurement or failed acoustic test.",
  },
};

export const orbitActivityUpdates: Record<
  string,
  { title: string; statement: string; method: string; purpose: string }
> = {
  "EVAL-R01": {
    title: "Baseline pickup evaluation",
    statement:
      "Evaluate the selected blower, brush and duct configuration against the defined hard-floor debris task.",
    method:
      "Defined two-pass task and debris-mass weighing; conditions and configuration must be identified.",
    purpose:
      "Assess integrated pickup performance; a single component result does not establish it.",
  },
  "EVAL-R02": {
    title: "Whole-product energy evaluation",
    statement:
      "Assess whole-product power over the declared cleaning duty profile against its energy-allocation assumptions.",
    method: "Whole-product power trace under the selected profile and usable-energy assumptions.",
    purpose:
      "Evaluate the energy allocation; separate old captured inputs from the current proposed control profile.",
  },
  "EVAL-R03": {
    title: "Driver thermal evaluation",
    statement:
      "Investigate driver temperature and derating under the selected sustained-load condition.",
    method:
      "Selected load/temperature record; combined high-suction conditions need separate coverage.",
    purpose: "Assess the selected thermal/derating scenario, not every operating combination.",
  },
  "EVAL-R04": {
    title: "Shared power-interface evaluation",
    statement:
      "Evaluate shared-rail behavior during the declared combined blower-start and traction transient.",
    method: "Combined-load transient record at the selected power interface and configuration.",
    purpose: "Assess controller-supply retention in the declared scenario.",
  },
  "EVAL-R05": {
    title: "Whole-robot acoustic evaluation",
    statement:
      "Define the whole-robot acoustic setup and selected blower/mounting/speed profile; no run is recorded.",
    method:
      "Draft setup requires operating mode, distance, room and microphone conditions before execution.",
    purpose: "Evaluate the acoustic target using the whole robot; no motor-only proxy.",
  },
  "EVAL-R06": {
    title: "Schedule delivery evaluation",
    statement:
      "Define interrupted-delivery, restart and revision-conflict checks for local/remote schedule behavior; no execution is recorded.",
    method: "Draft delivery-interruption, restart and revision-conflict scenarios.",
    purpose:
      "Assess engineering delivery behavior; representative-user comprehension remains EXP-R03 work.",
  },
};
