import { ensure } from "../core/model.ts";
import type { Field, SchemaObject } from "../core/model.ts";
import { applicationModelLimits } from "../core/application-model.ts";
import type { ApplicationModelIssue, ApplicationModelPin } from "../core/application-model.ts";
import {
  parseVerificationModel,
  verificationFieldTypes,
  verificationLimits,
  verificationRoles,
} from "../core/verification-model.ts";
import type {
  VerificationModel,
  VerificationRole,
  ResolvedVerificationModel,
} from "../core/verification-model.ts";
import { pinEntity } from "./native-pins.ts";
import { modelContext } from "./model-context.ts";
import type { Transaction } from "./ports/repository.ts";

function own<T>(values: Record<string, T>, key: string) {
  return Object.hasOwn(values, key) ? values[key] : undefined;
}
function verificationRoleFields(model: VerificationModel, role: VerificationRole) {
  return Object.fromEntries([
    ...Object.entries(verificationFieldTypes[role]).map(([key, type]) => [
      (model[role].fields as Record<string, unknown>)[key] as string,
      type,
    ]),
    ...(role === "requirement"
      ? model.requirement.fields.acceptance.map((field) => [field, "string"])
      : []),
  ]) as Record<string, Field["type"]>;
}
function requiredFields(
  model: VerificationModel,
  role: VerificationRole,
  schema: SchemaObject,
  issues: ApplicationModelIssue[],
): Record<string, Field> | null {
  const definition = own(schema.entityTypes, model[role].type);
  const issue = (message: string, field?: string) =>
    issues.push({ path: [role, ...(field ? ["fields", field] : ["type"])], message });
  if (!definition || Object.keys(definition.fields).length > applicationModelLimits.roleFields) {
    issue("Bound type is absent or exceeds 1000 fields");
    return null;
  }
  const bound = verificationRoleFields(model, role);
  for (const [field, type] of Object.entries(bound))
    if (own(definition.fields, field)?.type !== type)
      issue("Bound field is missing or has an incompatible value type", field);
  const extra = Object.entries(definition.fields).filter(
    ([field, value]) => value.required && !Object.hasOwn(bound, field),
  );
  if (
    extra.length > applicationModelLimits.extraRequiredFields ||
    extra.some(([field]) => field.length > 200)
  ) {
    issue("Additional required fields exceed 50 fields or 200-character names");
    return null;
  }
  return Object.fromEntries(
    extra.map(([field, value]) => [field, { type: value.type, required: true }]),
  );
}
function verificationModelCompatibility(model: VerificationModel, schema: SchemaObject) {
  const issues: ApplicationModelIssue[] = [];
  const required = Object.fromEntries(
    verificationRoles.map((role) => [role, requiredFields(model, role, schema, issues)]),
  ) as ResolvedVerificationModel["requiredFields"];
  const relationships = [
    ["requirementMethod", model.requirement.type, model.method.type],
    ["requirementCase", model.requirement.type, model.case.type],
    ["caseExecution", model.case.type, model.execution.type],
  ] as const;
  for (const [role, source, target] of relationships) {
    const definition = own(schema.relationshipTypes, model.relationships[role]);
    if (
      !definition ||
      definition.reference ||
      Object.keys(definition.fields).length > applicationModelLimits.roleFields ||
      (definition.source !== undefined && !definition.source.includes(source)) ||
      (definition.target !== undefined && !definition.target.includes(target)) ||
      (role !== "requirementMethod" &&
        Object.values(definition.fields).some((field) => field.required))
    )
      issues.push({
        path: ["relationships", role],
        message:
          "Relationship must permit the bound types; owned membership cannot require extra fields",
      });
  }
  return { requiredFields: required, compatibility: { writable: issues.length === 0, issues } };
}

/** Selected native descriptor; original schema validation and current writability stay distinct. */
export async function resolveVerificationModel(
  tx: Transaction,
  selection: ApplicationModelPin,
): Promise<ResolvedVerificationModel> {
  const pin = await pinEntity(tx, selection.entityId, selection.version, true);
  const fields = own(pin.schema.entityTypes, pin.entity.type)?.fields;
  ensure(
    fields &&
      own(fields, selection.field)?.type === "json" &&
      Object.hasOwn(pin.entity.fields, selection.field),
    "validation",
    "Verification descriptor needs a schema-declared native JSON field",
  );
  const definition = parseVerificationModel(pin.entity.fields[selection.field]);
  const original = verificationModelCompatibility(definition, pin.schema);
  ensure(
    original.compatibility.writable,
    "validation",
    "Verification model is incompatible with its governing schema",
    {
      path: original.compatibility.issues[0]?.path,
    },
  );
  const { schema, metadata } = await modelContext(tx, selection, pin);
  const result = {
    ...metadata,
    definition,
    ...verificationModelCompatibility(definition, schema),
  };
  ensure(
    new TextEncoder().encode(JSON.stringify(result)).length <=
      verificationLimits.modelResponseBytes,
    "validation",
    "Resolved verification model exceeds 128 KiB",
  );
  return result;
}
