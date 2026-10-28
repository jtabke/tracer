import { ensure, knownProperties, record } from "../core/model.ts";
import type { Field, SchemaObject } from "../core/model.ts";
import {
  applicationModelLimits,
  applicationModelFieldTypes,
  parseChangeAssessmentModel,
} from "../core/application-model.ts";
import type {
  ApplicationModelPin,
  ChangeAssessmentModel,
  ApplicationModelIssue,
  ResolvedApplicationModel,
} from "../core/application-model.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import type { Repository, Transaction } from "./ports/repository.ts";
import { pinEntity } from "./native-pins.ts";
import { modelContext } from "./model-context.ts";

function own<T>(values: Record<string, T>, name: string): T | undefined {
  return Object.hasOwn(values, name) ? values[name] : undefined;
}
export function prepareModelPin(input: ApplicationModelPin) {
  input = snapshotInput(input);
  ensure(record(input), "validation", "Select an exact application model pin");
  knownProperties(input, ["entityId", "version", "field"]);
  for (const key of ["entityId", "field"] as const)
    ensure(
      typeof input[key] === "string" &&
        input[key].length > 0 &&
        input[key].length <= 200 &&
        input[key].trim() === input[key],
      "validation",
      "Select a model identity and descriptor field",
      { path: [key] },
    );
  ensure(
    Number.isSafeInteger(input.version) && input.version > 0,
    "validation",
    "Select a positive exact model version",
    { path: ["version"] },
  );
  return input;
}
function roleCompatibility(
  model: ChangeAssessmentModel,
  schema: SchemaObject,
  role: "assessment" | "disposition",
  issues: ApplicationModelIssue[],
) {
  const binding = model[role],
    definition = own(schema.entityTypes, binding.type),
    extra: Record<string, Field> = Object.create(null);
  const issue = (message: string, field?: string) =>
    issues.push({ path: [role, ...(field ? ["fields", field] : ["type"])], message });
  if (!definition) {
    issue("Bound record type is not declared");
    return null;
  }
  const fields = Object.entries(definition.fields);
  if (fields.length > applicationModelLimits.roleFields) {
    issue("Bound record type exceeds 1000 fields");
    return null;
  }
  for (const [name, field] of Object.entries(binding.fields))
    if (own(definition.fields, field)?.type !== own(applicationModelFieldTypes[role], name))
      issue("Bound field is missing or has an incompatible value type", name);
  const controlled = new Set(Object.values(binding.fields));
  for (const [name, field] of fields)
    if (field.required && !controlled.has(name)) {
      if (name.length > 200) {
        issue("Additional required field name exceeds 200 characters");
        return null;
      }
      extra[name] = { type: field.type, required: true };
    }
  if (Object.keys(extra).length > applicationModelLimits.extraRequiredFields) {
    issue("Bound record type exceeds 50 additional required fields");
    return null;
  }
  return { ...extra };
}
function modelCompatibility(model: ChangeAssessmentModel, schema: SchemaObject) {
  const issues: ApplicationModelIssue[] = [];
  const requiredFields = {
    assessment: roleCompatibility(model, schema, "assessment", issues),
    disposition: roleCompatibility(model, schema, "disposition", issues),
  };
  const member = own(schema.relationshipTypes, model.relationships.member);
  const valid =
    member &&
    !member.reference &&
    Object.keys(member.fields).length <= applicationModelLimits.roleFields &&
    (member.source === undefined || member.source.includes(model.assessment.type)) &&
    (member.target === undefined || member.target.includes(model.disposition.type)) &&
    !Object.values(member.fields).some((field) => field.required);
  if (!valid)
    issues.push({
      path: ["relationships", "member"],
      message:
        "Membership needs a non-reference relationship permitting the bound types without required metadata",
    });
  return { requiredFields, compatibility: { writable: issues.length === 0, issues } };
}
/** Resolve explicit native annotations; external bytes and current profile edits are not model definitions. */
export async function resolveApplicationModel(
  tx: Transaction,
  input: ApplicationModelPin,
): Promise<ResolvedApplicationModel> {
  const pin = await pinEntity(tx, input.entityId, input.version, true),
    fields = own(pin.schema.entityTypes, pin.entity.type)?.fields;
  ensure(
    fields &&
      own(fields, input.field)?.type === "json" &&
      Object.hasOwn(pin.entity.fields, input.field),
    "validation",
    "Model descriptor needs a schema-declared JSON field",
    { path: ["field"] },
  );
  const definition = parseChangeAssessmentModel(pin.entity.fields[input.field]);
  const historical = modelCompatibility(definition, pin.schema);
  ensure(
    historical.compatibility.writable,
    "validation",
    "Application model is incompatible with its governing schema",
    { path: historical.compatibility.issues[0]?.path },
  );
  const { schema, metadata } = await modelContext(tx, input, pin);
  const result = {
    ...metadata,
    definition,
    ...modelCompatibility(definition, schema),
  };
  ensure(
    new TextEncoder().encode(JSON.stringify(result)).byteLength <=
      applicationModelLimits.responseBytes,
    "validation",
    "Resolved application model exceeds 128 KiB",
  );
  return result;
}
export class ApplicationModels {
  private repository: Repository;
  constructor(repository: Repository) {
    this.repository = repository;
  }
  async resolve(input: ApplicationModelPin): Promise<ResolvedApplicationModel> {
    input = prepareModelPin(input);
    return this.repository.transaction((tx) => resolveApplicationModel(tx, input));
  }
}
