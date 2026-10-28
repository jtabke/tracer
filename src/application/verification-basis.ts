import { ensure, json, knownProperties, record } from "../core/model.ts";
import type { Entity } from "../core/model.ts";
import type {
  PrepareVerificationBasis,
  VerificationBasis,
  VerificationMethodSelection,
} from "../core/verification-basis.ts";
import { validateVerificationCriteria, verificationText } from "../core/verification-criteria.ts";
import { verificationLimits } from "../core/verification-model.ts";
import type { VerificationModel } from "../core/verification-model.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { pinEntity, pinRelationship } from "./native-pins.ts";
import { prepareModelPin } from "./application-models.ts";
import { resolveVerificationModel } from "./verification-models.ts";
import type { Transaction } from "./ports/repository.ts";

function exactPin(value: unknown) {
  ensure(record(value), "validation", "Select a native identity/version");
  knownProperties(value, ["entityId", "version"]);
  verificationText(value.entityId, 200);
  ensure(
    Number.isSafeInteger(value.version) && Number(value.version) > 0,
    "validation",
    "Select a positive native version",
  );
}
export function prepareVerificationBasis(input: PrepareVerificationBasis) {
  input = snapshotInput(input);
  ensure(record(input) && json(input), "validation", "Invalid verification basis selection");
  ensure(
    new TextEncoder().encode(JSON.stringify(input)).length <= verificationLimits.scopeBytes,
    "validation",
    "Verification basis selection exceeds 64 KiB",
  );
  knownProperties(input, ["model", "requirement", "coverage", "criteria", "methods"]);
  input.model = prepareModelPin(input.model);
  exactPin(input.requirement);
  ensure(record(input.coverage), "validation", "Declare complete or partial source coverage");
  knownProperties(input.coverage, ["kind", "rationale"]);
  ensure(
    ["complete", "partial"].includes(input.coverage.kind),
    "validation",
    "Declare complete or partial source coverage",
  );
  verificationText(input.coverage.rationale);
  ensure(
    Array.isArray(input.methods) &&
      input.methods.length > 0 &&
      input.methods.length <= verificationLimits.methods,
    "validation",
    "Select 1–10 exact verification methods",
  );
  const ids = new Set<string>();
  let assignments = 0;
  for (const method of input.methods) {
    validateMethodSelection(method);
    ensure(
      !ids.has(method.entityId),
      "validation",
      "A method identity can have only one selected version",
    );
    ids.add(method.entityId);
    assignments += method.criterionIds.length;
  }
  ensure(
    assignments <= verificationLimits.assignments,
    "validation",
    "Verification basis exceeds 100 assignments",
  );
  return input;
}
function validateMethodSelection(value: unknown): asserts value is VerificationMethodSelection {
  ensure(record(value), "validation", "Select an exact method and criterion assignments");
  knownProperties(value, ["entityId", "version", "relationship", "criterionIds"]);
  exactPin({ entityId: value.entityId, version: value.version });
  ensure(record(value.relationship), "validation", "Select the requirement-to-method connection");
  knownProperties(value.relationship, ["id", "version"]);
  exactPin({ entityId: value.relationship.id, version: value.relationship.version });
  ensure(
    Array.isArray(value.criterionIds) &&
      value.criterionIds.length > 0 &&
      value.criterionIds.length <= verificationLimits.criteria,
    "validation",
    "Method needs 1–25 criterion assignments",
  );
  for (const id of value.criterionIds) verificationText(id, 200);
  ensure(
    new Set(value.criterionIds).size === value.criterionIds.length,
    "validation",
    "Method assignments must be unique",
  );
}
function textField(entity: Entity, field: string) {
  const text = Object.hasOwn(entity.fields, field) ? entity.fields[field] : undefined;
  verificationText(text, verificationLimits.scopeBytes);
  return text;
}
async function methods(
  tx: Transaction,
  input: PrepareVerificationBasis,
  definition: VerificationModel,
  criteria: Set<string>,
) {
  const result: VerificationBasis["methods"] = [];
  for (const selected of input.methods) {
    ensure(
      selected.criterionIds.every((id) => criteria.has(id)),
      "validation",
      "Method refers to a criterion outside the selected population",
    );
    const { entity } = await pinEntity(tx, selected.entityId, selected.version, true);
    const { relationship } = await pinRelationship(
      tx,
      selected.relationship.id,
      selected.relationship.version,
    );
    ensure(
      entity.type === definition.method.type &&
        relationship.type === definition.relationships.requirementMethod &&
        relationship.source === input.requirement.entityId &&
        relationship.target === entity.id,
      "validation",
      "Method/connection does not belong to this requirement and configured verification model",
    );
    const fields = definition.method.fields;
    result.push({
      entityId: entity.id,
      version: entity.version,
      title: textField(entity, fields.title),
      procedure: textField(entity, fields.procedure),
      expected: textField(entity, fields.expected),
      relationship,
      criterionIds: selected.criterionIds,
    });
  }
  return result;
}

/** Transaction-local exact native basis. No observation IO, writes, outcome or approval inference. */
export async function resolveVerificationBasis(
  tx: Transaction,
  input: PrepareVerificationBasis,
): Promise<VerificationBasis> {
  const model = await resolveVerificationModel(tx, input.model);
  const { entity } = await pinEntity(
    tx,
    input.requirement.entityId,
    input.requirement.version,
    true,
  );
  const definition = model.definition;
  ensure(
    entity.type === definition.requirement.type,
    "validation",
    "Requirement type does not match the verification model",
  );
  const fields = definition.requirement.fields;
  const acceptance = Object.fromEntries(
    fields.acceptance.map((field) => [field, textField(entity, field)]),
  );
  const { criteria, sourceComplete } = validateVerificationCriteria(input.criteria, acceptance);
  ensure(
    input.coverage.kind !== "complete" || sourceComplete,
    "validation",
    "Complete verification basis omits acceptance source text",
  );
  const selectedMethods = await methods(tx, input, definition, new Set(criteria.map((x) => x.id)));
  const assigned = new Set(selectedMethods.flatMap((method) => method.criterionIds));
  const result: VerificationBasis = {
    contract: "verification_basis",
    version: 1,
    model: input.model,
    at: model.context,
    requirement: {
      entityId: entity.id,
      version: entity.version,
      title: textField(entity, fields.title),
      statement: textField(entity, fields.statement),
      acceptance,
    },
    coverage: {
      ...input.coverage,
      sourceComplete,
      unassignedCriterionIds: criteria.filter((x) => !assigned.has(x.id)).map((x) => x.id),
    },
    criteria,
    methods: selectedMethods,
  };
  ensure(
    new TextEncoder().encode(JSON.stringify(result)).length <= verificationLimits.scopeBytes,
    "validation",
    "Resolved verification basis exceeds 64 KiB",
  );
  return result;
}
