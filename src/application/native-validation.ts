import { nativePages } from "./native-query-support.ts";
import { validateRelationshipEndpoints } from "../core/relationship-endpoints.ts";
import { resourceType, validateResource, validateReference } from "../core/references.ts";
import { ensure, json, record, validateFields, TracerError } from "../core/model.ts";
import type { Entity, Relationship, Schema, Kind, TypeDefinition } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";

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
  if (entity.resource !== undefined) validateResource(entity.resource);
  ensure(
    entity.type !== resourceType || entity.resource !== undefined,
    "validation",
    "Resource-only identity requires its descriptor",
  );
  objectFields(
    "entity",
    entity,
    entity.type === resourceType
      ? {
          fields: Object.fromEntries(
            Object.keys(record(entity.fields) ? entity.fields : {}).map((key) => [
              key,
              { type: "json" as const },
            ]),
          ),
        }
      : Object.hasOwn(schema.entityTypes, entity.type)
        ? schema.entityTypes[entity.type]
        : undefined,
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
  endpoints?: ReadonlyMap<string, Entity>,
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
  const source = endpoints ? endpoints.get(link.source) : await tx.get("entity", link.source);
  const target = endpoints ? endpoints.get(link.target) : await tx.get("entity", link.target);
  ensure(source && target, "referential_integrity", "Both endpoints must be active");
  validateRelationshipEndpoints(definition!, link, source, target);
  await validateReferenceTarget(tx, link, definition!, target);
}

/** One consistent population per preview or commit. Never share an endpoint cache across transactions. */
export async function validateSchemaPopulation(
  tx: Transaction,
  schema: Schema,
  onIssue: (error: unknown, kind: "entity" | "relationship", id: string) => void = (error) => {
    throw error;
  },
) {
  const endpoints = new Map<string, Entity>();
  const checked = { entities: 0, relationships: 0 };
  for await (const page of nativePages(tx, "entity")) {
    for (const entity of page as Entity[]) {
      endpoints.set(entity.id, entity);
      checked.entities++;
      try {
        validateNativeEntity(schema, entity);
      } catch (error) {
        onIssue(error, "entity", entity.id);
      }
    }
  }
  for await (const page of nativePages(tx, "relationship")) {
    for (const link of page as Relationship[]) {
      checked.relationships++;
      try {
        await validateNativeRelationship(tx, schema, link, endpoints);
      } catch (error) {
        onIssue(error, "relationship", link.id);
      }
    }
  }
  return checked;
}

async function validateReferenceTarget(
  tx: Transaction,
  link: Relationship,
  definition: import("../core/model.ts").RelationshipDefinition,
  target: Entity,
) {
  ensure(
    definition.reference === true ? link.reference !== undefined : link.reference === undefined,
    "validation",
    "Reference qualification requires an explicitly reference-capable relationship",
  );
  if (!link.reference) return;
  validateReference(link.reference);
  ensure(target.resource !== undefined, "validation", "Reference target needs resource capability");
  const state = link.reference.state;
  if (state.mode === "current") return;
  if ("observationId" in state) {
    const observation = await tx.getEvidence("observation", state.observationId);
    ensure(
      target.resource.source &&
        observation?.entityId === target.id &&
        observation.availability === "available" &&
        observation.hash,
      "validation",
      "Pin needs an available observation of this resource",
    );
  } else {
    const revision = await tx.getRevision("entity", target.id, state.revision);
    ensure(
      !target.resource.source && revision?.snapshot,
      "validation",
      "Pin needs an existing native content revision",
    );
  }
}
