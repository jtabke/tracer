import type { Schema } from "./model.ts";
import type { WorkflowConnection } from "./schema-workflow.ts";
import { validWorkflow } from "./schema-workflow.ts";
import { starterWorkflowProposal } from "./project-templates.ts";

const path = (
  source: string,
  target: string,
  label: string,
  direction: "forward" | "reverse" = "forward",
  feedback = false,
): WorkflowConnection => ({ source, target, direction, label, ...(feedback ? { feedback } : {}) });
const requirements = ["product_requirement", "subsystem_requirement", "component_requirement"];

/** Example-owned flow recipes. No global meaning is assigned to arbitrary relationship names. */
const exampleWorkflows: Record<
  string,
  { types: string[]; routes: Record<string, WorkflowConnection[]> }
> = {
  medical: {
    types: [
      "device",
      "user_need",
      ...requirements,
      "design_output",
      "verification_protocol",
      "validation_protocol",
      "test_run",
      "risk",
      "risk_control",
      "dhf_record",
      "design_change",
    ],
    routes: {
      decomposes_into: [
        path("device", "user_need", "intended use"),
        path("user_need", "product_requirement", "measurable design inputs"),
        path("product_requirement", "subsystem_requirement", "allocated requirements"),
        path("subsystem_requirement", "component_requirement", "component requirements"),
      ],
      realized_by: requirements.map((source) => path(source, "design_output", "design input")),
      verified_by: [
        ...requirements.map((source) =>
          path(source, "verification_protocol", "acceptance criteria"),
        ),
        path("design_output", "verification_protocol", "design under test"),
      ],
      validated_by: [path("user_need", "validation_protocol", "intended-use criteria")],
      executed_as: [
        path("verification_protocol", "test_run", "verification execution"),
        path("validation_protocol", "test_run", "validation execution"),
      ],
      mitigated_by: [path("risk", "risk_control", "risk control")],
      specified_by: [path("risk_control", "product_requirement", "control requirements")],
      depends_on: [path("design_output", "design_output", "design dependency", "forward", true)],
      contains: [path("device", "dhf_record", "design history")],
      references: [
        path("dhf_record", "test_run", "recorded evidence", "reverse"),
        path("dhf_record", "design_output", "design records", "reverse"),
      ],
      affects: [
        path("design_change", "product_requirement", "reconsider inputs", "forward", true),
        path("design_change", "design_output", "revise design", "forward", true),
      ],
    },
  },
  technology: {
    types: [
      "application",
      "outcome",
      "capability",
      "story",
      "component",
      "contract",
      "decision",
      "implementation",
      "test_scenario",
      "test_run",
      "release",
      "incident",
    ],
    routes: {
      breaks_down_into: [
        path("application", "outcome", "product outcomes"),
        path("outcome", "capability", "capabilities"),
        path("capability", "story", "acceptance stories"),
      ],
      implemented_by: [path("story", "implementation", "implementation input")],
      checked_by: [
        path("story", "test_scenario", "acceptance criteria"),
        path("implementation", "test_scenario", "implementation under test"),
        path("contract", "test_scenario", "interface criteria"),
      ],
      exercised_as: [path("test_scenario", "test_run", "test execution")],
      changes: [path("implementation", "component", "component change")],
      provides: [path("component", "contract", "provided interface")],
      consumes: [path("component", "contract", "consumed interface", "reverse", true)],
      guides: [path("decision", "implementation", "engineering decision")],
      includes: [path("release", "implementation", "release content", "reverse")],
      evaluated_by: [path("release", "test_run", "release evidence", "reverse")],
      reveals: [path("incident", "story", "feedback to acceptance", "forward", true)],
      motivates: [path("incident", "decision", "review feedback", "forward", true)],
    },
  },
  integrated: {
    types: [
      "product",
      "goal",
      "target",
      "function",
      "requirement",
      "component",
      "interface",
      "design",
      "concept",
      "experiment",
      "decision",
      "build_configuration",
      "evaluation",
      "finding",
      "change_assessment",
      "release",
    ],
    routes: {
      breaks_down_into: [
        path("product", "goal", "product intent"),
        path("goal", "target", "measurable targets"),
        path("target", "function", "functional allocation"),
        path("function", "requirement", "engineering requirements"),
      ],
      contains: [path("product", "component", "product architecture")],
      realized_by: [path("requirement", "design", "design input")],
      defines: [path("design", "component", "component definition")],
      provides: [path("component", "interface", "provided interface")],
      consumes: [path("component", "interface", "interface input", "reverse", true)],
      depends_on: [path("design", "design", "design dependency", "forward", true)],
      considers: [
        path("decision", "concept", "alternative", "reverse"),
        path("decision", "experiment", "experiment input", "reverse"),
        path("decision", "finding", "finding input", "reverse", true),
        path("decision", "evaluation", "evaluation input", "reverse", true),
      ],
      explores: [path("experiment", "concept", "concept under investigation", "reverse")],
      evaluated_by: [
        path("target", "evaluation", "target acceptance criteria"),
        path("requirement", "evaluation", "requirement acceptance criteria"),
        path("design", "evaluation", "design under test"),
        path("interface", "evaluation", "interface criteria"),
      ],
      finding_from: [path("finding", "evaluation", "observed finding", "reverse")],
      assessment_references: [
        path("change_assessment", "evaluation", "assessment evidence", "reverse"),
        path("change_assessment", "requirement", "reviewed requirements", "reverse"),
      ],
      configuration_includes: [
        path("build_configuration", "design", "configured design", "reverse"),
        path("build_configuration", "requirement", "configuration inputs", "reverse"),
      ],
      evaluated_configuration: [
        path("evaluation", "build_configuration", "configuration under test", "reverse"),
      ],
      release_considers: [
        path("release", "decision", "release judgment", "reverse"),
        path("release", "build_configuration", "release configuration", "reverse"),
        path("release", "finding", "release findings", "reverse"),
      ],
    },
  },
};

export function exampleWorkflow(schema: Schema, name: string): Schema {
  const preset = exampleWorkflows[name];
  return {
    ...schema,
    relationshipTypes: Object.fromEntries(
      Object.entries(schema.relationshipTypes).map(([name, definition]) => [
        name,
        { ...definition, ...(preset.routes[name] ? { workflow: preset.routes[name] } : {}) },
      ]),
    ),
  };
}

/** A staged proposal for recognizable examples. Existing authored workflows are never replaced. */
export function workflowProposal(schema: Schema): Schema {
  if (
    Object.values(schema.relationshipTypes).some((definition) => definition.workflow !== undefined)
  )
    return schema;
  const starter = starterWorkflowProposal(schema);
  if (starter !== schema) return starter;
  for (const [name, preset] of Object.entries(exampleWorkflows)) {
    if (matchesExample(schema, preset)) return exampleWorkflow(schema, name);
  }
  return schema;
}
function matchesExample(schema: Schema, preset: (typeof exampleWorkflows)[string]) {
  if (!preset.types.every((name) => Object.hasOwn(schema.entityTypes, name))) return false;
  return Object.entries(preset.routes).every(
    ([name, routes]) =>
      Object.hasOwn(schema.relationshipTypes, name) &&
      validWorkflow(routes, schema.entityTypes, schema.relationshipTypes[name]),
  );
}
