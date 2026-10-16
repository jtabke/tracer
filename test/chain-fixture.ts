import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";

export async function chainFixture() {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository),
    actor = { actor: "chain-test" };
  const fields = { title: { type: "string" as const, required: true } };
  await tracer.setSchema(
    {
      entityTypes: { need: { fields }, requirement: { fields }, output: { fields } },
      relationshipTypes: {
        derives: { source: ["need"], target: ["requirement"], fields: {} },
        verifies: { source: ["requirement"], target: ["output"], fields: {} },
      },
    },
    0,
    actor,
  );
  const items = [];
  for (const [type, key] of [
    ["need", "N1"],
    ["need", "N2"],
    ["need", "N3"],
    ["requirement", "R1"],
    ["requirement", "R2"],
    ["output", "O1"],
    ["output", "O2"],
  ])
    items.push(
      await tracer.createEntity({ type, key, fields: { title: key + " details" } }, 1, actor),
    );
  const [n1, n2, n3, r1, r2, o1, o2] = items;
  for (const [type, source, target] of [
    ["derives", n1.id, r1.id],
    ["derives", n1.id, r2.id],
    ["derives", n2.id, r1.id],
    ["verifies", r1.id, o1.id],
    ["verifies", r1.id, o2.id],
  ])
    await tracer.createRelationship({ type, source, target, fields: {} }, 1, actor);
  return { repository, tracer, n1, n2, n3, r1, r2, o1, o2 };
}
