import { ensure, record, knownProperties } from "../core/model.ts";
import type { Entity, SchemaObject } from "../core/model.ts";
import type { InputDeclaration, Observation, RelationshipDeclaration } from "../core/evidence.ts";
import type { Configuration, PinnedEntity } from "../core/configuration.ts";
import type { Transaction } from "./ports/repository.ts";
import { pinEntity } from "./native-pins.ts";

type ResolvedReceiptInput = {
  value: Entity;
  schema: SchemaObject;
  pin?: PinnedEntity;
  observation?: Observation;
};

function configurationObservation(configuration: Configuration, declaration: InputDeclaration) {
  const selected = configuration.capture?.content.find(
    (state) => state.entityId === declaration.entityId,
  );
  if (declaration.facet !== "content") {
    ensure(
      !selected || declaration.facet === "native",
      "validation",
      "Choose an explicit native or content facet for configured material",
    );
    return undefined;
  }
  ensure(
    selected?.observation,
    "validation",
    "Configuration has no selected content observation; undeclared or unknown content cannot become a receipt input",
  );
  ensure(
    declaration.fields === undefined &&
      (declaration.observationId === undefined ||
        declaration.observationId === selected.observation.id),
    "validation",
    "Content inputs use the configuration's exact observation, without annotation fields",
  );
  return selected.observation;
}

function validateReceiptDeclaration(declaration: InputDeclaration) {
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
}

function validatePinnedSelector(
  declaration: InputDeclaration,
  configuration: Configuration | undefined,
) {
  const configuredContent = !!configuration?.capture && declaration.facet === "content";
  ensure(
    declaration.expectedVersion === undefined &&
      (!configuration || declaration.revision === undefined) &&
      (declaration.observationId === undefined || configuredContent) &&
      (declaration.facet !== "content" || configuredContent) &&
      declaration.expectedPathVersions === undefined &&
      (!declaration.path || declaration.path.length === 0),
    "validation",
    "Pinned inputs use direct dependencies and selected states, without current guards or live paths",
  );
}

/** Controlled configurations bind direct relationship inputs to their selected topology. */
export function configurationRelationshipDeclarations(
  configuration: Configuration | undefined,
  declarations: RelationshipDeclaration[] = [],
) {
  if (!configuration?.capture) return declarations;
  ensure(
    Array.isArray(declarations) && declarations.length <= 100,
    "validation",
    "Declare at most 100 relationship inputs",
  );
  return declarations.map((declaration) => {
    ensure(record(declaration), "validation", "Invalid relationship input");
    knownProperties(declaration, ["id", "revision", "expectedVersion", "role"]);
    const pin = configuration.relationships!.find((p) => p.relationship.id === declaration.id);
    ensure(
      pin &&
        declaration.expectedVersion === undefined &&
        (declaration.revision === undefined || declaration.revision === pin.relationship.version),
      "validation",
      "Relationship input must select the configuration's exact topology without current guards",
    );
    return { ...declaration, revision: pin.relationship.version };
  });
}

/** Current guards, historical selectors and immutable configuration membership are exclusive. */
export async function resolveReceiptInput(
  tx: Transaction,
  declaration: InputDeclaration,
  schema: SchemaObject,
  configuration?: Configuration,
): Promise<ResolvedReceiptInput> {
  validateReceiptDeclaration(declaration);
  if (configuration || declaration.revision !== undefined) {
    validatePinnedSelector(declaration, configuration);
    const pin = configuration
      ? configuration.members.find((member) => member.entity.id === declaration.entityId)
      : await pinEntity(
          tx,
          declaration.entityId,
          declaration.revision!,
          declaration.facet === "native",
        );
    ensure(pin, "validation", "Input is not a member of the selected configuration");
    const observation = configuration
      ? configurationObservation(configuration, declaration)
      : undefined;
    return { value: pin.entity, schema: pin.schema, pin, ...(observation ? { observation } : {}) };
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
