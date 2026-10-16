import { ensure, json, validateFields, TracerError } from "../core/model.ts";
import type { Entity, Relationship, Schema, Kind, TypeDefinition } from "../core/model.ts";
import type { Transaction } from "../persistence/contracts.ts";

function objectFields(kind: Kind, value: Entity | Relationship, definition?: TypeDefinition) {
  try {
    validateFields(definition, value.fields);
  } catch (error) {
    if (!(error instanceof TracerError)) throw error;
    throw new TracerError(error.code, error.message, { ...error.details, kind, id: value.id });
  }
}

export function validateNativeEntity(schema: Schema, entity: Entity) {
  ensure(
    typeof entity.type === "string" && entity.type.trim(),
    "validation",
    "Entity type must be nonempty text",
    { kind: "entity", id: entity.id, path: ["type"] },
  );
  objectFields(
    "entity",
    entity,
    Object.hasOwn(schema.entityTypes, entity.type) ? schema.entityTypes[entity.type] : undefined,
  );
  ensure(
    entity.key === undefined ||
      (typeof entity.key === "string" && json(entity.key) && entity.key.trim()),
    "validation",
    "Key must be nonempty text",
    { kind: "entity", id: entity.id, path: ["key"] },
  );
}
export async function validateNativeRelationship(
  tx: Transaction,
  schema: Schema,
  link: Relationship,
) {
  ensure(
    typeof link.type === "string" &&
      link.type.trim() &&
      typeof link.source === "string" &&
      typeof link.target === "string",
    "validation",
    "Relationship type and endpoints must be text",
  );
  const definition = Object.hasOwn(schema.relationshipTypes, link.type)
    ? schema.relationshipTypes[link.type]
    : undefined;
  objectFields("relationship", link, definition);
  const source = (await tx.get("entity", link.source)) as Entity | undefined;
  const target = (await tx.get("entity", link.target)) as Entity | undefined;
  ensure(source && target, "referential_integrity", "Both endpoints must be active");
  ensure(
    !definition!.source || definition!.source.includes(source.type),
    "validation",
    "Invalid source type",
    { kind: "relationship", id: link.id, path: ["source"] },
  );
  ensure(
    !definition!.target || definition!.target.includes(target.type),
    "validation",
    "Invalid target type",
    { kind: "relationship", id: link.id, path: ["target"] },
  );
}
