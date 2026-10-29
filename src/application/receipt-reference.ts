import { ensure } from "../core/model.ts";
import type { SchemaObject } from "../core/model.ts";
import type { CapturedRelationship, InputDeclaration } from "../core/evidence.ts";
import type { Configuration } from "../core/configuration.ts";
import type { Transaction } from "./ports/repository.ts";
import { pinEntity } from "./native-pins.ts";
import { selectedReferenceState } from "./reference-state.ts";

function validateReferenceDeclaration(input: InputDeclaration) {
  ensure(
    typeof input.referenceId === "string" &&
      input.referenceId.trim() &&
      (input.facet === "native" || input.facet === "content"),
    "validation",
    "Reference input needs an explicit reference identity and native/content facet",
  );
  ensure(
    input.expectedVersion === undefined &&
      input.expectedPathVersions === undefined &&
      (!input.path || input.path.length === 0),
    "validation",
    "Reference inputs use selected states without current-version guards or paths",
  );
  return input.facet;
}
async function referenceResource(
  tx: Transaction,
  input: InputDeclaration,
  reference: CapturedRelationship,
) {
  const current = await tx.get("entity", input.entityId);
  if (current) return current;
  const explicit =
    reference.relationship.reference!.state.mode === "pinned" ||
    input.observationId !== undefined ||
    input.revision !== undefined;
  return explicit ? reference.target : undefined;
}
async function referenceDefaults(
  tx: Transaction,
  input: InputDeclaration,
  configuration: Configuration | undefined,
  reference: CapturedRelationship,
) {
  const configuredPin = configuration?.members.find((x) => x.entity.id === input.entityId);
  const declaredNative =
    !configuration &&
    input.revision !== undefined &&
    (input.facet === "content" || reference.relationship.reference!.state.mode === "current")
      ? await pinEntity(tx, input.entityId, input.revision, true)
      : null;
  const resource = configuration
    ? configuredPin?.entity
    : (declaredNative?.entity ?? (await referenceResource(tx, input, reference)));
  const defaultPin = configuredPin ?? declaredNative ?? undefined;
  const observation = configuration
    ? (configuration.capture?.content.find((x) => x.entityId === input.entityId)?.observation ??
      null)
    : ((input.observationId !== undefined &&
      reference.relationship.reference!.state.mode === "current"
        ? await tx.getEvidence("observation", input.observationId)
        : await tx.latestEvidence("observation", input.entityId)) ?? null);
  ensure(
    !observation || observation.entityId === input.entityId,
    "validation",
    "Reference observation belongs to another resource",
  );
  return { defaultPin, resource, observation };
}
export async function resolveReceiptReference(
  tx: Transaction,
  input: InputDeclaration,
  schema: SchemaObject,
  configuration: Configuration | undefined,
  relationships: CapturedRelationship[],
) {
  const facet = validateReferenceDeclaration(input);
  const reference = relationships.find((x) => x.relationship.id === input.referenceId);
  ensure(
    reference?.relationship.reference && reference.relationship.target === input.entityId,
    "validation",
    "Input reference must be an explicitly captured qualified relationship to the same resource",
  );
  const { defaultPin, resource, observation } = await referenceDefaults(
    tx,
    input,
    configuration,
    reference,
  );
  const selected = await selectedReferenceState(
    tx,
    reference.relationship,
    resource,
    observation,
    facet,
  );
  ensure(
    selected.entity && selected.selection !== "unavailable",
    "validation",
    selected.reason ?? "Reference-selected input is unavailable",
  );
  if (input.facet === "content") {
    ensure(
      selected.observation &&
        (input.revision === undefined || input.revision === selected.entity.version) &&
        input.fields === undefined &&
        (input.observationId === undefined || input.observationId === selected.observation.id),
      "validation",
      "Reference content input must match its selected observation without annotation fields",
    );
    return {
      value: selected.entity,
      schema: defaultPin?.schema ?? schema,
      observation: selected.observation,
      ...(defaultPin ? { pin: defaultPin } : {}),
    };
  }
  ensure(
    input.observationId === undefined &&
      (input.revision === undefined || input.revision === selected.entity.version),
    "validation",
    "Native reference input has no content observation",
  );
  const pin = await pinEntity(tx, input.entityId, selected.entity.version, true);
  return { value: pin.entity, schema: pin.schema, pin };
}
