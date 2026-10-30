import type { Entity, SchemaObject } from "../../src/core/model.ts";
import { record } from "../../src/core/model.ts";
import { applicationModelChoices } from "../application-choices.tsx";

export type VerificationSubjectRequest = {
  requirement: Entity;
  projectRevision: number;
  sequence: number;
};
export type VerificationReturnContext = { key: string; revision: number; perspective: string };

export function requirementRequestChanged(
  requested: Pick<Entity, "id" | "version" | "type"> | undefined,
  current: Pick<Entity, "id" | "version" | "type"> | undefined,
) {
  return Boolean(
    requested &&
    (!current ||
      requested.id !== current.id ||
      requested.version !== current.version ||
      requested.type !== current.type),
  );
}

/** Catalogue eligibility only; model resolution and preparation still authorize the exact scope. */
export function canPrepareVerification(
  subject: Pick<Entity, "type">,
  entities: Entity[],
  schema: SchemaObject | null,
) {
  return applicationModelChoices(entities, schema, "requirement_verification").some(({ pin }) => {
    const definition = entities.find((entity) => entity.id === pin.entityId)?.fields[pin.field];
    return (
      record(definition) &&
      record(definition.requirement) &&
      definition.requirement.type === subject.type
    );
  });
}
