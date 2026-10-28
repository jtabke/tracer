import { validateRelationshipEndpoints } from "../core/relationship-endpoints.ts";
import { ensure, record } from "../core/model.ts";
import type {
  ConfigurationInput,
  PinnedEntity,
  PinnedRelationship,
} from "../core/configuration.ts";
import type { Transaction } from "./ports/repository.ts";
import { pinRelationship } from "./native-pins.ts";

/** Capture only deliberate links within the selected member set; never infer a complete BOM. */
export async function captureRelationships(
  tx: Transaction,
  declarations: ConfigurationInput["relationships"],
  members: PinnedEntity[],
) {
  if (declarations === undefined) return undefined;
  ensure(
    Array.isArray(declarations) && declarations.length <= 200,
    "validation",
    "Configuration allows at most 200 explicit relationships",
  );
  const selected = new Map(members.map((pin) => [pin.entity.id, pin.entity]));
  const seen = new Set<string>(),
    pins: PinnedRelationship[] = [];
  for (const declaration of declarations) {
    ensure(
      record(declaration) &&
        Object.keys(declaration).every((key) => ["relationshipId", "version"].includes(key)),
      "validation",
      "Invalid configuration relationship",
    );
    ensure(
      !seen.has(declaration.relationshipId),
      "validation",
      "Declare each configuration relationship once",
    );
    seen.add(declaration.relationshipId);
    const pin = await pinRelationship(tx, declaration.relationshipId, declaration.version);
    const { relationship, schema } = pin;
    ensure(
      selected.has(relationship.source) && selected.has(relationship.target),
      "validation",
      "Configuration relationship endpoints must be captured members",
    );
    const definition = Object.hasOwn(schema.relationshipTypes, relationship.type)
      ? schema.relationshipTypes[relationship.type]
      : undefined;
    ensure(definition, "validation", "Captured relationship type is unavailable in its schema");
    validateRelationshipEndpoints(
      definition,
      relationship,
      selected.get(relationship.source)!,
      selected.get(relationship.target)!,
    );
    pins.push(pin);
  }
  return pins;
}
