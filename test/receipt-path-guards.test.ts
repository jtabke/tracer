import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import type { InputDeclaration } from "../src/core/evidence.ts";

test("selected dependency paths reject changed link versions atomically while legacy paths remain valid", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository),
    actor = { actor: "path-guards" };
  try {
    await tracer.setSchema(
      {
        entityTypes: { item: { fields: { title: { type: "string" } } } },
        relationshipTypes: { depends_on: { fields: { rationale: { type: "string" } } } },
      },
      0,
      actor,
    );
    const create = (key: string) =>
      tracer.createEntity({ type: "item", key, fields: { title: key } }, 1, actor);
    const output = await create("OUT"),
      intermediate = await create("MID"),
      input = await create("INPUT");
    const first = await tracer.createRelationship(
      {
        type: "depends_on",
        source: output.id,
        target: intermediate.id,
        fields: { rationale: "Chosen rationale" },
      },
      1,
      actor,
    );
    const second = await tracer.createRelationship(
      { type: "depends_on", source: intermediate.id, target: input.id, fields: {} },
      1,
      actor,
    );
    const declaration: InputDeclaration = {
      entityId: input.id,
      expectedVersion: 1,
      path: [first.id, second.id],
      expectedPathVersions: [1, 1],
    };
    const record = (value: InputDeclaration) =>
      tracer.evidence.recordReceipt(
        {
          outputId: output.id,
          expectedOutputVersion: 1,
          outcome: "Explicit selected path",
          inputs: [value],
        },
        actor,
      );
    await tracer.updateRelationship(
      first.id,
      1,
      {
        type: first.type,
        source: first.source,
        target: first.target,
        fields: { rationale: "Changed after selection" },
      },
      1,
      actor,
    );
    const history = await tracer.history(),
      before = await tracer.evidence.list("receipt");
    await assert.rejects(record(declaration), { code: "conflict" });
    for (const expectedPathVersions of [[], [2], [2, 1, 1], [0, 1], [2, 1.5]]) {
      await assert.rejects(record({ ...declaration, expectedPathVersions }), {
        code: "validation",
      });
    }
    await assert.rejects(record({ entityId: input.id, expectedPathVersions: [2] }), {
      code: "validation",
    });
    await assert.rejects(record({ entityId: input.id, revision: 1, expectedPathVersions: [] }), {
      code: "validation",
    });
    assert.deepEqual(await tracer.evidence.list("receipt"), before);
    assert.deepEqual(await tracer.history(), history);
    const guarded = await record({ ...declaration, expectedPathVersions: [2, 1] });
    assert.deepEqual(
      guarded.inputs[0].links.map((link) => [link.id, link.version]),
      [
        [first.id, 2],
        [second.id, 1],
      ],
    );
    assert.equal(guarded.inputs[0].links[0].fields.rationale, "Changed after selection");
    assert.equal(guarded.inputs[0].expectedPathVersions, undefined);
    const legacy = await record({ entityId: input.id, path: [first.id, second.id] });
    assert.deepEqual(legacy.inputs[0].links, guarded.inputs[0].links);
    assert.deepEqual(await tracer.history(), history);
  } finally {
    repository.close();
  }
});
