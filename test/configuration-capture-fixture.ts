import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Tracer } from "../src/index.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import type { ExactConfigurationInput } from "../src/core/configuration.ts";
export const configurationActor = {
  actor: "exact-configuration-test",
  reason: "Explicit synthetic configuration fixture",
};
export async function configurationCaptureFixture() {
  const directory = mkdtempSync(join(tmpdir(), "tracer-exact-configuration-")),
    database = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(database);
  const observer = async () => ({
    availability: "available" as const,
    hash: "sha256:" + "a".repeat(64),
  });
  let tracer = new Tracer(repository, undefined, observer);
  const schema = {
    entityTypes: {
      item: { fields: { title: { type: "string" as const }, value: { type: "json" as const } } },
    },
    relationshipTypes: { depends: { fields: {} } },
  };
  await tracer.setSchema(schema, 0, configurationActor);
  const root = await tracer.createEntity(
      { type: "item", fields: { title: "Assembly", value: 0 } },
      1,
      configurationActor,
    ),
    part = await tracer.createEntity(
      { type: "item", fields: { title: "Part", value: 1 } },
      1,
      configurationActor,
    ),
    material = await tracer.createEntity(
      {
        type: "item",
        fields: { title: "Specification annotations", value: 1 },
        resource: {
          label: "Specification",
          source: { system: "file", externalId: "/synthetic/specification.txt" },
        },
      },
      1,
      configurationActor,
    ),
    link = await tracer.createRelationship(
      { type: "depends", source: root.id, target: part.id, fields: {} },
      1,
      configurationActor,
    ),
    observation = await tracer.evidence.observe(
      { entityId: material.id, locator: { system: "file", path: "/synthetic/specification.txt" } },
      configurationActor,
    );
  return {
    database,
    schema,
    root,
    part,
    material,
    link,
    observation,
    get repository() {
      return repository;
    },
    get tracer() {
      return tracer;
    },
    async input(id = randomUUID()): Promise<ExactConfigurationInput> {
      const context = await tracer.configurations.captureContext();
      return {
        id,
        name: "Exact candidate",
        subjectId: root.id,
        expectedSubjectVersion: 1,
        members: [root, part, material].map((x) => ({ entityId: x.id, version: 1 })),
        relationships: [{ relationshipId: link.id, version: 1 }],
        content: [{ entityId: material.id, observationId: observation.id }],
        scope: {
          purpose: "Synthetic explicit assembly scope",
          coverage: "complete",
          rationale:
            "Declare native membership and topology; observed content is separate from annotations and is not retained bytes.",
        },
        expectedSchemaVersion: context.schema.version,
        expectedProjectRevision: context.projectRevision,
        expectedEvidenceRevision: context.evidenceRevision,
      };
    },
    reopen() {
      repository.close();
      repository = new SQLiteRepository(database);
      tracer = new Tracer(repository, undefined, observer);
    },
    close() {
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
