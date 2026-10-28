import { ensure } from "./model.ts";
import type { Entity, Relationship, RelationshipDefinition } from "./model.ts";
import { resourceType } from "./references.ts";

/** The same schema permissions govern active endpoints and explicitly selected historical pins. */
export function validateRelationshipEndpoints(
  definition: RelationshipDefinition,
  link: Relationship,
  source: Entity,
  target: Entity,
) {
  ensure(
    (source.resource !== undefined && definition.resourceSource === true) ||
      (source.type !== resourceType &&
        (!definition.source || definition.source.includes(source.type))),
    "validation",
    "Invalid source type",
    { kind: "relationship", id: link.id, path: ["source"] },
  );
  ensure(
    (target.resource !== undefined && definition.resourceTarget === true) ||
      (target.type !== resourceType &&
        (!definition.target || definition.target.includes(target.type))),
    "validation",
    "Invalid target type",
    { kind: "relationship", id: link.id, path: ["target"] },
  );
}
