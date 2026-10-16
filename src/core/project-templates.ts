import type { Schema } from "./model.ts";

function schema(outputs: string[]): Schema {
  const entityTypes: Schema["entityTypes"] = {};
  for (const type of ["intent", "requirement", ...outputs])
    entityTypes[type] = {
      fields: {
        title: { type: "string", required: true },
        statement: { type: "string" },
        notes: { type: "string" },
      },
    };
  return {
    entityTypes,
    relationshipTypes: {
      contributes_to: {
        source: ["requirement"],
        target: ["intent"],
        fields: {},
        workflow: [
          {
            source: "requirement",
            target: "intent",
            direction: "reverse",
            label: "defines requirements",
          },
        ],
      },
      mapped_to: {
        source: ["requirement"],
        target: outputs,
        workflow: outputs.map((target) => ({
          source: "requirement",
          target,
          direction: "forward",
          label: target === "test" ? "acceptance criteria" : "design input",
        })),
        fields: {
          scope: { type: "string", required: true },
          source_version: { type: "number", required: true },
          review: { type: "string", required: true },
        },
      },
      tested_by: {
        source: outputs.filter((type) => type !== "test"),
        target: ["test"],
        fields: {},
        workflow: outputs
          .filter((type) => type !== "test")
          .map((source) => ({
            source,
            target: "test",
            direction: "forward",
            label: source === "code" ? "implementation under test" : "design under test",
          })),
      },
    },
  };
}

/** Starter schemas only; users' stored schemas remain authoritative. No approval policy. */
export const projectTemplates: Record<string, { label: string; schema: Schema }> = {
  software: {
    label: "Software — intents, requirements, code, designs and tests",
    schema: schema(["code", "design", "test"]),
  },
  engineering: {
    label: "Engineering — intents, requirements, designs and tests",
    schema: schema(["design", "test"]),
  },
};

/** Reviewable enrichment only for the known legacy starter shape, never a generic name heuristic. */
export function starterWorkflowProposal(base: Schema): Schema {
  const contributes = base.relationshipTypes.contributes_to;
  const mapped = base.relationshipTypes.mapped_to;
  if (!legacyStarter(base, contributes, mapped)) return base;
  const template =
    projectTemplates[Object.hasOwn(base.entityTypes, "code") ? "software" : "engineering"].schema;
  return {
    ...base,
    relationshipTypes: {
      ...base.relationshipTypes,
      contributes_to: {
        ...contributes,
        workflow: template.relationshipTypes.contributes_to.workflow,
      },
      mapped_to: { ...mapped, workflow: template.relationshipTypes.mapped_to.workflow },
      tested_by: base.relationshipTypes.tested_by ?? template.relationshipTypes.tested_by,
    },
  };
}
function legacyStarter(
  base: Schema,
  contributes: Schema["relationshipTypes"][string] | undefined,
  mapped: Schema["relationshipTypes"][string] | undefined,
) {
  if (!contributes || !mapped) return false;
  if (hasFlow(contributes, mapped)) return false;
  const outputs = Object.hasOwn(base.entityTypes, "code")
    ? ["code", "design", "test"]
    : ["design", "test"];
  return (
    starterTypes(base, outputs) &&
    JSON.stringify(contributes.source) === '["requirement"]' &&
    JSON.stringify(contributes.target) === '["intent"]' &&
    JSON.stringify(mapped.source) === '["requirement"]' &&
    JSON.stringify(mapped.target) === JSON.stringify(outputs)
  );
}

function starterTypes(base: Schema, outputs: string[]) {
  return ["intent", "requirement", ...outputs].every((type) =>
    Object.hasOwn(base.entityTypes, type),
  );
}

function hasFlow(
  contributes: Schema["relationshipTypes"][string],
  mapped: Schema["relationshipTypes"][string],
) {
  return contributes.workflow !== undefined || mapped.workflow !== undefined;
}
