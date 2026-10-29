import { ensure } from "../core/model.ts";
import type { Entity, Relationship } from "../core/model.ts";
import type { Observation } from "../core/evidence.ts";
import type { Configuration } from "../core/configuration.ts";
import { readConfiguration } from "./configuration-read.ts";
import type { Transaction } from "./ports/repository.ts";
import { factDigest } from "./fact-digest.ts";

/** Product-state reads only. Control records, commands and evidence populations remain on tx. */
export type EngineeringStateReader = {
  getEntity(id: string): Promise<Entity | undefined>;
  getRelationship(id: string): Promise<Relationship | undefined>;
  getObservation(entityId: string): Promise<Observation | null>;
} & ({ kind: "current" } | { kind: "configuration"; configuration: Configuration; digest: string });

export function currentEngineeringState(tx: Transaction): EngineeringStateReader {
  return {
    kind: "current",
    getEntity: (id) => tx.get("entity", id),
    getRelationship: (id) => tx.get("relationship", id),
    getObservation: async (id) => (await tx.latestEvidence("observation", id)) ?? null,
  };
}
export async function configurationEngineeringState(
  tx: Transaction,
  id: string,
): Promise<EngineeringStateReader & { kind: "configuration" }> {
  const configuration = await readConfiguration(tx, id);
  ensure(
    configuration.capture,
    "validation",
    "Selected-state applicability requires a controlled configuration; legacy scope/content is unknown",
  );
  const entities = new Map(configuration.members.map((pin) => [pin.entity.id, pin.entity]));
  const relationships = new Map(
    configuration.relationships!.map((pin) => [pin.relationship.id, pin.relationship]),
  );
  const observations = new Map(
    configuration.capture.content.map((state) => [state.entityId, state.observation]),
  );
  return {
    kind: "configuration",
    configuration,
    digest: await factDigest(configuration),
    getEntity: async (id) => entities.get(id),
    getRelationship: async (id) => relationships.get(id),
    getObservation: async (id) => observations.get(id) ?? null,
  };
}
