import { ensure, record } from "../core/model.ts";
import type {
  ConfigurationInput,
  PinnedEntity,
  PinnedRelationship,
} from "../core/configuration.ts";
import type { Transaction } from "../persistence/contracts.ts";
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
  const memberTypes = new Map(members.map((pin) => [pin.entity.id, pin.entity.type]));
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
      memberTypes.has(relationship.source) && memberTypes.has(relationship.target),
      "validation",
      "Configuration relationship endpoints must be captured members",
    );
    const definition = schema.relationshipTypes[relationship.type];
    ensure(
      definition &&
        compatible(definition.source, memberTypes.get(relationship.source)!) &&
        compatible(definition.target, memberTypes.get(relationship.target)!),
      "validation",
      "Captured members do not satisfy the relationship revision's endpoint types",
    );
    pins.push(pin);
  }
  return pins;
}
function compatible(allowed: string[] | undefined, type: string) {
  return allowed === undefined || allowed.includes(type);
}
