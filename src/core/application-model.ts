import { ensure, json, knownProperties, record } from "./model.ts";
import type { Field, Schema } from "./model.ts";

export type ApplicationModelPin = { entityId: string; version: number; field: string };
const assessmentDecisions = [
  "no_action",
  "revise",
  "reverify",
  "investigate",
  "acknowledge_unknown",
] as const;
export type AssessmentDecision = (typeof assessmentDecisions)[number];
export type ChangeAssessmentModel = {
  contract: "change_assessment";
  version: 1;
  assessment: {
    type: string;
    fields: { title: string; state: string; model: string; scope: string; closure: string };
  };
  disposition: {
    type: string;
    fields: {
      title: string;
      candidate: string;
      decision: string;
      rationale: string;
      actions: string;
    };
  };
  relationships: { member: string };
  states: { open: string; closed: string };
  decisions: Record<AssessmentDecision, string>;
  policy: { allowUnknown: boolean };
};
export const applicationModelFieldTypes = {
  assessment: { title: "string", state: "string", model: "json", scope: "json", closure: "json" },
  disposition: {
    title: "string",
    candidate: "json",
    decision: "string",
    rationale: "string",
    actions: "json",
  },
} as const satisfies {
  [R in "assessment" | "disposition"]: Record<
    keyof ChangeAssessmentModel[R]["fields"],
    Field["type"]
  >;
};
export type ApplicationModelIssue = { path: string[]; message: string };
export type ResolvedApplicationModel = {
  pin: ApplicationModelPin;
  definition: ChangeAssessmentModel;
  source: { id: string; type: string; version: number; currentVersion: number | null };
  context: { projectRevision: number; evidenceRevision: number; schemaVersion: number };
  pinnedSchemaVersion: number;
  compatibility: { writable: boolean; issues: ApplicationModelIssue[] };
  requiredFields: {
    assessment: Record<string, Field> | null;
    disposition: Record<string, Field> | null;
  };
};
export const applicationModelLimits = {
  definitionBytes: 65536,
  responseBytes: 131072,
  roleFields: 1000,
  extraRequiredFields: 50,
} as const;
function shape(value: unknown, keys: readonly string[], path: string[]) {
  ensure(record(value), "validation", "Application model needs an object", { path });
  knownProperties(value, [...keys], path);
  for (const key of keys)
    ensure(Object.hasOwn(value, key), "validation", "Missing application model property", {
      path: [...path, key],
    });
  return value;
}
function label(value: unknown, path: string[]) {
  ensure(
    typeof value === "string" &&
      value.length > 0 &&
      value.length <= 200 &&
      value.trim() === value &&
      json(value),
    "validation",
    "Application model names must be nonempty JSON-safe text of at most 200 characters",
    { path },
  );
}
function labels(value: unknown, keys: readonly string[], path: string[]) {
  const result = shape(value, keys, path);
  for (const key of keys) label(result[key], [...path, key]);
  ensure(
    new Set(Object.values(result)).size === keys.length,
    "validation",
    "Application model role names must be distinct",
    { path },
  );
}
function role(value: unknown, name: keyof typeof applicationModelFieldTypes) {
  const result = shape(value, ["type", "fields"], [name]);
  label(result.type, [name, "type"]);
  labels(result.fields, Object.keys(applicationModelFieldTypes[name]), [name, "fields"]);
}
/** Validate only the bounded application descriptor, never arbitrary engineering rules. */
export function parseChangeAssessmentModel(value: unknown): ChangeAssessmentModel {
  ensure(json(value), "validation", "Application model must be JSON data");
  ensure(
    new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      applicationModelLimits.definitionBytes,
    "validation",
    "Application model exceeds 64 KiB",
    { path: ["definition"] },
  );
  const result = shape(
    value,
    [
      "contract",
      "version",
      "assessment",
      "disposition",
      "relationships",
      "states",
      "decisions",
      "policy",
    ],
    [],
  );
  ensure(
    result.contract === "change_assessment" && result.version === 1,
    "validation",
    "Unsupported application model contract/version",
    { path: ["contract"] },
  );
  role(result.assessment, "assessment");
  role(result.disposition, "disposition");
  const assessment = result.assessment as ChangeAssessmentModel["assessment"],
    disposition = result.disposition as ChangeAssessmentModel["disposition"];
  ensure(
    assessment.type !== disposition.type,
    "validation",
    "Assessment and disposition types must be distinct",
    { path: ["disposition", "type"] },
  );
  labels(result.relationships, ["member"], ["relationships"]);
  labels(result.states, ["open", "closed"], ["states"]);
  labels(result.decisions, assessmentDecisions, ["decisions"]);
  const policy = shape(result.policy, ["allowUnknown"], ["policy"]);
  ensure(
    typeof policy.allowUnknown === "boolean",
    "validation",
    "Unknown-state policy must be explicit",
    { path: ["policy", "allowUnknown"] },
  );
  return result as ChangeAssessmentModel;
}

/** A fresh schema fragment for model-owned roles; callers explicitly merge it with their project. */
export function changeAssessmentSchema(value: ChangeAssessmentModel): Schema {
  const model = parseChangeAssessmentModel(value);
  return {
    entityTypes: Object.fromEntries(
      (["assessment", "disposition"] as const).map((role) => [
        model[role].type,
        {
          fields: Object.fromEntries(
            Object.entries(applicationModelFieldTypes[role]).map(([name, type]) => [
              (model[role].fields as Record<string, string>)[name],
              { type, required: true },
            ]),
          ),
        },
      ]),
    ),
    relationshipTypes: {
      [model.relationships.member]: {
        source: [model.assessment.type],
        target: [model.disposition.type],
        fields: {},
      },
    },
  };
}
