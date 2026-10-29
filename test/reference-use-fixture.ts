import { randomUUID } from "node:crypto";
import { Tracer } from "../src/index.ts";
import type { InputDeclaration, Relationship, ReferenceState } from "../src/index.ts";
import { verificationFixture, verificationActor as actor } from "./verification-fixture.ts";
function useState(index: number, external: boolean, id: string | undefined): ReferenceState {
  if (index === 3) return { mode: "current" };
  if (external) return { mode: "pinned", observationId: id! };
  return { mode: "pinned", revision: index === 1 ? 2 : 1 };
}

export async function referenceUseFixture(
  domain: "engineering" | "research" = "engineering",
  external = true,
) {
  const f = await verificationFixture(domain);
  try {
    await f.tracer.setSchema(
      {
        ...f.schema,
        relationshipTypes: {
          ...f.schema.relationshipTypes,
          contextual_reference: { resourceTarget: true, reference: true, fields: {} },
        },
      },
      1,
      actor,
    );
    const originalResource = await f.tracer.createEntity(
      {
        type: "@resource",
        fields: external ? {} : { text: "B" },
        resource: {
          label: "One resource with independent contextual uses",
          ...(external
            ? { source: { system: "file" as const, externalId: "/synthetic/reference-use" } }
            : {}),
        },
      },
      2,
      actor,
    );
    let hash = "b";
    const observing = new Tracer(f.repository, undefined, async () => ({
      availability: "available",
      hash: "sha256:" + hash.repeat(64),
    }));
    const observe = () =>
      observing.evidence.observe(
        {
          entityId: originalResource.id,
          locator: { system: "file", path: "/synthetic/reference-use" },
        },
        actor,
      );
    const B = external ? await observe() : null;
    hash = "c";
    const C = external ? await observe() : null;
    const resource = external
      ? originalResource
      : await f.tracer.updateEntity(originalResource.id, 1, { fields: { text: "C" } }, 2, actor);
    const refs: Relationship[] = [];
    for (const [index, selected] of [B, C, B, null].entries())
      refs.push(
        await f.tracer.createRelationship(
          {
            type: "contextual_reference",
            source: f.requirement.id,
            target: resource.id,
            fields: {},
            reference: {
              role: "definition source",
              explanation: "Synthetic independently selected use",
              selector: { kind: "fragment", value: `section-${index}` },
              state: useState(index, external, selected?.id),
            },
          },
          2,
          actor,
        ),
      );
    const input = (index: number): InputDeclaration => ({
      entityId: resource.id,
      referenceId: refs[index].id,
      ...(external
        ? { facet: "content", observationId: (index === 0 || index === 2 ? B : C)!.id }
        : { facet: "native", revision: index === 0 || index === 2 ? 1 : 2, fields: ["text"] }),
    });
    const relationships = (indices = [0, 1, 2, 3]) =>
      indices.map((index) => ({ id: refs[index].id, revision: refs[index].version }));
    const capture = async (omitted: number[] = [], unknownDefault = false) => {
      const ctx = await f.tracer.configurations.captureContext();
      return f.tracer.configurations.captureExact(
        {
          id: randomUUID(),
          name: "Default C and separately selected reference uses",
          subjectId: f.requirement.id,
          expectedSubjectVersion: 1,
          members: [f.requirement, f.method, f.profile, resource].map((e) => ({
            entityId: e.id,
            version: e.version,
          })),
          relationships: [
            f.relationship,
            ...refs.filter((_, index) => !omitted.includes(index)),
          ].map((link) => ({ relationshipId: link.id, version: link.version })),
          content: external
            ? [
                {
                  entityId: resource.id,
                  observationId: unknownDefault ? null : C!.id,
                  ...(unknownDefault
                    ? { reason: "Default unavailable, independent pinned use remains explicit" }
                    : {}),
                },
              ]
            : [],
          scope: {
            purpose: "Explicit resource and use selections",
            coverage: omitted.length ? "partial" : "complete",
            rationale: "Synthetic contract fixture, no physical or representative-user validation",
          },
          expectedSchemaVersion: ctx.schema.version,
          expectedProjectRevision: ctx.projectRevision,
          expectedEvidenceRevision: ctx.evidenceRevision,
        },
        actor,
      );
    };
    return {
      f,
      external,
      resource,
      refs,
      B,
      C,
      input,
      relationships,
      capture,
      changeSource: async () => {
        hash = "d";
        return external
          ? observe()
          : f.tracer.updateEntity(resource.id, 2, { fields: { text: "D" } }, 2, actor);
      },
    };
  } catch (error) {
    f.close();
    throw error;
  }
}
