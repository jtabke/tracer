import { ensure, record } from "../core/model.ts";
import type { SchemaObject } from "../core/model.ts";
import type { InputDeclaration } from "../core/evidence.ts";
import type { Configuration } from "../core/configuration.ts";
import type { Transaction } from "./ports/repository.ts";
import { pinEntity } from "./native-pins.ts";

/** Current guards, historical selectors and immutable configuration membership are exclusive. */
export async function resolveReceiptInput(
  tx: Transaction,
  declaration: InputDeclaration,
  schema: SchemaObject,
  configuration?: Configuration,
) {
  ensure(
    record(declaration) &&
      Object.keys(declaration).every((key) =>
        [
          "entityId",
          "facet",
          "role",
          "expectedVersion",
          "revision",
          "observationId",
          "fields",
          "path",
          "expectedPathVersions",
        ].includes(key),
      ),
    "validation",
    "Invalid input declaration",
  );
  ensure(
    declaration.facet === undefined || ["native", "content"].includes(declaration.facet),
    "validation",
    "Invalid input facet",
  );
  ensure(
    declaration.role === undefined ||
      (typeof declaration.role === "string" && declaration.role.trim()),
    "validation",
    "Invalid input usage role",
  );
  if (configuration || declaration.revision !== undefined) {
    ensure(
      declaration.expectedVersion === undefined &&
        (!configuration || declaration.revision === undefined) &&
        declaration.observationId === undefined &&
        declaration.expectedPathVersions === undefined &&
        (!declaration.path || declaration.path.length === 0),
      "validation",
      "Pinned native inputs use direct dependencies, without current guards, observations or live paths",
    );
    const pin = configuration
      ? configuration.members.find((member) => member.entity.id === declaration.entityId)
      : await pinEntity(
          tx,
          declaration.entityId,
          declaration.revision!,
          declaration.facet === "native",
        );
    ensure(pin, "validation", "Input is not a member of the selected configuration");
    return { value: pin.entity, schema: pin.schema, pin };
  }
  ensure(
    typeof declaration.entityId === "string" && declaration.entityId.length > 0,
    "validation",
    "Entity ID is required",
  );
  const value = await tx.get("entity", declaration.entityId);
  ensure(value, "not_found", "Active entity not found: " + declaration.entityId);
  ensure(
    declaration.expectedVersion === undefined || declaration.expectedVersion === value.version,
    "conflict",
    "Input changed before receipt capture: " + value.id,
  );
  return { value, schema };
}
