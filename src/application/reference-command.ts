import { ensure, type Entity, type Relationship, type SchemaObject } from "../core/model.ts";
import { resourceType, validateResource } from "../core/references.ts";
import type { Resource } from "../core/references.ts";
import type { ReferenceCreate } from "./commands.ts";
import type { Transaction } from "./ports/repository.ts";
import { validateNativeEntity, validateNativeRelationship } from "./native-validation.ts";
import { expectVersion } from "./version-guard.ts";

export async function checkResourceIdentity(tx: Transaction, value: Entity) {
  if (!value.resource) return;
  const source = value.resource.source;
  const binding = (await tx.getEvidence("external", value.id)) as
    import("../core/evidence.ts").ExternalIdentity | undefined;
  ensure(
    !binding || (source?.system === binding.system && source.externalId === binding.externalId),
    "conflict",
    "Resource source differs from immutable external ownership",
  );
  if (!source) return;
  const existing = await tx.findResource(source);
  ensure(
    !existing || existing.id === value.id,
    "conflict",
    "Resource identity already belongs to another object; reuse it",
  );
}
async function resolveTarget(
  tx: Transaction,
  schema: SchemaObject,
  input: ReferenceCreate["input"],
  newId: () => string,
) {
  ensure(
    Boolean(input.target) !== Boolean(input.resource),
    "validation",
    "Select a target or a resource descriptor",
  );
  if (input.target) {
    const target = (await tx.get("entity", input.target)) as Entity | undefined;
    ensure(target, "not_found", "Reference target is unavailable");
    ensure(
      input.targetVersion !== undefined,
      "validation",
      "Selected target needs a captured version",
    );
    expectVersion(target.version, input.targetVersion, false, { kind: "entity", id: target.id });
    return target;
  }
  validateResource(input.resource);
  const resource: Resource = input.resource;
  ensure(
    input.targetVersion === undefined,
    "validation",
    "Resolved resources have no caller-selected target version",
  );
  const existing = resource.source ? await tx.findResource(resource.source) : undefined;
  if (existing?.resource) return existing;
  const target: Entity = existing
    ? { ...existing, resource, version: existing.version + 1 }
    : { id: newId(), version: 1, type: resourceType, fields: {}, resource };
  validateNativeEntity(schema, target);
  await checkResourceIdentity(tx, target);
  await tx.save("entity", target, existing?.version ?? 0);
  return target;
}
export async function createReference(
  tx: Transaction,
  schema: SchemaObject,
  operation: ReferenceCreate,
  newId: () => string,
): Promise<Relationship> {
  const input = operation.input;
  const source = (await tx.get("entity", input.source)) as Entity | undefined;
  ensure(source, "not_found", "Reference source is unavailable");
  expectVersion(source.version, input.sourceVersion, false, { kind: "entity", id: source.id });
  const target = await resolveTarget(tx, schema, input, newId);
  const value: Relationship = {
    id: operation.id ?? newId(),
    version: 1,
    type: input.type,
    source: source.id,
    target: target.id,
    fields: input.fields,
    reference: input.reference,
  };
  ensure(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.id),
    "validation",
    "Reference identity must be a UUID",
  );
  await validateNativeRelationship(tx, schema, value);
  await tx.save("relationship", value, 0);
  return value;
}
