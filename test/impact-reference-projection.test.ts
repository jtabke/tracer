import test from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";

test("impact incident projections preserve complete qualified relationships in both current and historical scope", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const t = new Tracer(repository),
      actor = { actor: "impact-reference-projection" };
    await t.setSchema(
      {
        entityTypes: { item: { fields: {} } },
        relationshipTypes: {
          cites: {
            source: ["item"],
            target: [],
            resourceTarget: true,
            reference: true,
            fields: { context: { type: "json" } },
          },
        },
      },
      0,
      actor,
    );
    const source = await t.createEntity({ type: "item", fields: {} }, 1, actor);
    const target = await t.createEntity(
      { type: "@resource", fields: {}, resource: { label: "Reusable definition" } },
      1,
      actor,
    );
    const link = await t.createRelationship(
      {
        type: "cites",
        source: source.id,
        target: target.id,
        fields: { context: { units: "W", retained: [false, 0, null] } },
        reference: {
          role: "definition",
          explanation: "Defines the power threshold",
          selector: { kind: "future-selector", value: { quote: "Power < 20 W" } },
          state: { mode: "pinned", revision: 1 },
        },
      },
      1,
      actor,
    );
    const revision = (await t.timeline()).head;
    await repository.transaction(async (tx) => {
      for (const [id, direction] of [
        [source.id, "outgoing"],
        [target.id, "incoming"],
        [source.id, "both"],
      ] as const) {
        const query = { id, direction, relationshipTypes: ["cites"], limit: 10 };
        assert.deepEqual((await tx.impactIncident(query)).items, [link]);
        assert.deepEqual((await tx.impactIncident({ ...query, atRevision: revision })).items, [
          link,
        ]);
      }
    });
  } finally {
    repository.close();
  }
});
