import { ensure } from "../core/model.ts";
import type { Entity, Relationship, SchemaObject } from "../core/model.ts";
import type { PinnedEntity, PinnedRelationship } from "../core/configuration.ts";
import type { Transaction } from "./ports/repository.ts";

export async function pinEntity(
  tx: Transaction,
  id: string,
  version: number,
  annotationsOnly = false,
): Promise<PinnedEntity> {
  ensure(
    typeof id === "string" && id.length > 0 && Number.isSafeInteger(version) && version > 0,
    "validation",
    "Choose an entity identity and positive exact version",
  );
  const pin = await nativeRevision(tx, "entity", id, version);
  ensure(
    annotationsOnly ||
      (!(await tx.getEvidence("external", id)) && !(pin.snapshot as Entity).resource?.source),
    "validation",
    "Native revision pins do not capture external content; use explicit observations",
  );
  return {
    entity: pin.snapshot as Entity,
    ...pin.provenance,
  };
}

async function nativeRevision(
  tx: Transaction,
  kind: "entity" | "relationship",
  id: string,
  version: number,
) {
  const revision = await tx.getRevision(kind, id, version);
  ensure(revision?.snapshot, "not_found", "Native revision is missing or is a deletion");
  const schemaRevision = await tx.getRevision("schema", "project", revision.schemaVersion);
  ensure(schemaRevision?.snapshot, "storage", "Revision schema is unavailable");
  return {
    snapshot: revision.snapshot,
    provenance: {
      revisionId: revision.revisionId,
      changesetId: revision.changesetId,
      projectRevision: revision.projectRevision,
      schema: schemaRevision.snapshot as SchemaObject,
    },
  };
}

export async function pinRelationship(
  tx: Transaction,
  id: string,
  version: number,
): Promise<PinnedRelationship> {
  ensure(
    typeof id === "string" && id.length > 0 && Number.isSafeInteger(version) && version > 0,
    "validation",
    "Choose a relationship identity and positive exact version",
  );
  const pin = await nativeRevision(tx, "relationship", id, version);
  return { relationship: pin.snapshot as Relationship, ...pin.provenance };
}
