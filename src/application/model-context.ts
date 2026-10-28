import type { ApplicationModelPin } from "../core/application-model.ts";
import type { Entity, SchemaObject } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";
import { projectSchema } from "./native-query-support.ts";

/** Common read clocks and native model identity; capability-specific validation stays with its owner. */
export async function modelContext(
  tx: Transaction,
  input: ApplicationModelPin,
  pin: { entity: Entity; schema: SchemaObject },
) {
  const schema = await projectSchema(tx),
    current = await tx.get("entity", input.entityId);
  return {
    schema,
    metadata: {
      pin: input,
      source: {
        id: pin.entity.id,
        type: pin.entity.type,
        version: pin.entity.version,
        currentVersion: current?.version ?? null,
      },
      pinnedSchemaVersion: pin.schema.version,
      context: {
        projectRevision: await tx.headRevision(),
        evidenceRevision: await tx.impactEvidenceRevision(),
        schemaVersion: schema.version,
      },
    },
  };
}
