import { ensure, json, knownProperties, record } from "./model.ts";
import type { Field, Schema } from "./model.ts";
import type { ApplicationModelResolution } from "./application-model.ts";

export type VerificationModel = {
  contract: "requirement_verification";
  version: 1;
  requirement: { type: string; fields: { title: string; statement: string; acceptance: string[] } };
  method: { type: string; fields: { title: string; procedure: string; expected: string } };
  case: {
    type: string;
    fields: {
      title: string;
      state: string;
      model: string;
      basis: string;
      executions: string;
      selection: string;
      conclusion: string;
    };
  };
  execution: { type: string; fields: { title: string; data: string } };
  relationships: { requirementMethod: string; requirementCase: string; caseExecution: string };
  states: { open: string; closed: string };
  outcomes: { passed: string; failed: string; blocked: string; not_run: string };
  policy: { allowAssessedDesignChanges: boolean };
};
export const verificationFieldTypes = {
  requirement: { title: "string", statement: "string" },
  method: { title: "string", procedure: "string", expected: "string" },
  case: {
    title: "string",
    state: "string",
    model: "json",
    basis: "json",
    executions: "json",
    selection: "json",
    conclusion: "json",
  },
  execution: { title: "string", data: "json" },
} as const satisfies Record<string, Record<string, Field["type"]>>;
export type VerificationRole = keyof typeof verificationFieldTypes;
export const verificationRoles = ["requirement", "method", "case", "execution"] as const;
export const verificationLimits = {
  definitionBytes: 65536,
  modelResponseBytes: 131072,
  criteria: 25,
  acceptanceFields: 10,
  methods: 10,
  assignments: 100,
  scopeBytes: 65536,
} as const;
export type ResolvedVerificationModel = ApplicationModelResolution & {
  definition: VerificationModel;
  requiredFields: Record<VerificationRole, Record<string, Field> | null>;
};

function shape(value: unknown, keys: string[], path: string[]) {
  ensure(record(value), "validation", "Verification model needs an object", { path });
  knownProperties(value, keys, path);
  for (const key of keys)
    ensure(Object.hasOwn(value, key), "validation", "Missing verification model property", {
      path: [...path, key],
    });
  return value;
}
function name(value: unknown, path: string[]): asserts value is string {
  ensure(
    typeof value === "string" && value.length > 0 && value.length <= 200 && value.trim() === value,
    "validation",
    "Verification model names must be nonempty text of at most 200 characters",
    { path },
  );
}
function distinct(values: unknown[], path: string[]) {
  ensure(new Set(values).size === values.length, "validation", "Role names must be distinct", {
    path,
  });
}
function names(value: unknown, keys: string[], path: string[]) {
  const result = shape(value, keys, path);
  for (const key of keys) name(result[key], [...path, key]);
  distinct(Object.values(result), path);
}
function role(value: unknown, key: VerificationRole) {
  const binding = shape(value, ["type", "fields"], [key]);
  name(binding.type, [key, "type"]);
  const fields = shape(
    binding.fields,
    [...Object.keys(verificationFieldTypes[key]), ...(key === "requirement" ? ["acceptance"] : [])],
    [key, "fields"],
  );
  const fieldNames: unknown[] = [];
  for (const semantic of Object.keys(verificationFieldTypes[key])) {
    name(fields[semantic], [key, "fields", semantic]);
    fieldNames.push(fields[semantic]);
  }
  if (key === "requirement") {
    ensure(
      Array.isArray(fields.acceptance) &&
        fields.acceptance.length > 0 &&
        fields.acceptance.length <= verificationLimits.acceptanceFields,
      "validation",
      "Select 1–10 acceptance source fields",
    );
    for (const field of fields.acceptance) {
      name(field, [key, "fields", "acceptance"]);
      fieldNames.push(field);
    }
  }
  distinct(fieldNames, [key, "fields"]);
}

/** Fixed engineering semantics with configured vocabulary, never executable project rules. */
export function parseVerificationModel(value: unknown): VerificationModel {
  ensure(json(value), "validation", "Verification model must be JSON data");
  ensure(
    new TextEncoder().encode(JSON.stringify(value)).length <= verificationLimits.definitionBytes,
    "validation",
    "Verification model exceeds 64 KiB",
  );
  const result = shape(
    value,
    ["contract", "version", ...verificationRoles, "relationships", "states", "outcomes", "policy"],
    [],
  );
  ensure(
    result.contract === "requirement_verification" && result.version === 1,
    "validation",
    "Unsupported verification model contract/version",
  );
  for (const key of verificationRoles) role(result[key], key);
  distinct(
    verificationRoles.map((key) => (result[key] as { type: string }).type),
    ["type"],
  );
  names(
    result.relationships,
    ["requirementMethod", "requirementCase", "caseExecution"],
    ["relationships"],
  );
  names(result.states, ["open", "closed"], ["states"]);
  names(result.outcomes, ["passed", "failed", "blocked", "not_run"], ["outcomes"]);
  const policy = shape(result.policy, ["allowAssessedDesignChanges"], ["policy"]);
  ensure(
    typeof policy.allowAssessedDesignChanges === "boolean",
    "validation",
    "Assessed design-change policy must be explicit",
  );
  return result as VerificationModel;
}

/** Explicit installation proposal only. Never merged into a stored project on read. */
export function verificationSchema(value: VerificationModel): Schema {
  const model = parseVerificationModel(value);
  const entityTypes = Object.fromEntries(
    verificationRoles.map((role) => [
      model[role].type,
      {
        fields: Object.fromEntries([
          ...Object.entries(verificationFieldTypes[role]).map(([key, type]) => [
            (model[role].fields as Record<string, unknown>)[key] as string,
            { type, required: true },
          ]),
          ...(role === "requirement"
            ? model.requirement.fields.acceptance.map((field) => [
                field,
                { type: "string", required: true },
              ])
            : []),
        ]),
      },
    ]),
  );
  return {
    entityTypes,
    relationshipTypes: Object.fromEntries(
      [
        [model.relationships.requirementMethod, model.requirement.type, model.method.type],
        [model.relationships.requirementCase, model.requirement.type, model.case.type],
        [model.relationships.caseExecution, model.case.type, model.execution.type],
      ].map(([type, source, target]) => [type, { source: [source], target: [target], fields: {} }]),
    ),
  };
}
