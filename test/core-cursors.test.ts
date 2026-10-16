import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";

const actor = { actor: "core-cursor-qa" };
const schema = { entityTypes: { item: { fields: {} } }, relationshipTypes: {} };
async function fixture() {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository);
  await tracer.setSchema(schema, 0, actor);
  const first = await tracer.createEntity({ type: "item", fields: {} }, 1, actor),
    second = await tracer.createEntity({ type: "item", fields: {} }, 1, actor);
  return { repository, tracer, first, second };
}
function replace(cursor: string, position: number, value: unknown) {
  const result = JSON.parse(cursor);
  result[position] = value;
  return JSON.stringify(result);
}

test("coverage cursor malformed clocks are validation errors before stale-snapshot or removed-policy errors", async () => {
  const { repository, tracer } = await fixture();
  try {
    await tracer.setSchema({ ...schema, relationshipTypes: { related: { fields: {} } } }, 1, actor);
    await tracer.coverage.set(
      {
        expectedSchemaVersion: 2,
        expectations: {
          rule: {
            name: "Structural rule",
            subject: { type: "item" },
            related: { type: "item" },
            relationshipType: "related",
            direction: "outgoing",
            minimumDistinctTargets: 1,
          },
        },
      },
      actor,
    );
    const page = await tracer.coverage.evaluate({ expectationId: "rule", limit: 1 }),
      cursor = page.rows.nextAfter!;
    assert.ok(cursor);
    for (const position of [2, 3])
      for (const value of [null, "1", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, {}, [], true])
        await assert.rejects(
          tracer.coverage.evaluate({
            expectationId: "rule",
            after: replace(cursor, position, value),
          }),
          { code: "validation" },
        );
    for (const value of [null, "", 0, {}])
      await assert.rejects(
        tracer.coverage.evaluate({ expectationId: "rule", after: replace(cursor, 5, value) }),
        { code: "validation" },
      );
    const before = await tracer.history();
    await assert.rejects(
      tracer.coverage.evaluate({
        expectationId: "rule",
        after: replace(cursor, 2, page.context.projectRevision + 1),
      }),
      { code: "conflict" },
    );
    assert.deepEqual(await tracer.history(), before);
    await tracer.coverage.set({ expectations: {}, expectedSchemaVersion: 3 }, actor);
    const changedHistory = await tracer.history();
    await assert.rejects(tracer.coverage.evaluate({ expectationId: "rule", after: cursor }), {
      code: "conflict",
    });
    await assert.rejects(
      tracer.coverage.evaluate({
        expectationId: "rule",
        after: replace(cursor, 2, "not-a-native-revision"),
      }),
      { code: "validation" },
    );
    await assert.rejects(
      tracer.coverage.evaluate({
        expectationId: "rule",
        expectedProjectRevision: page.context.projectRevision,
        after: replace(cursor, 3, "malformed-schema-clock"),
      }),
      { code: "validation" },
      "malformed cursor takes precedence over stale explicit native guard",
    );
    await assert.rejects(tracer.coverage.evaluate({ expectationId: "rule" }), {
      code: "not_found",
    });
    assert.deepEqual(await tracer.history(), changedHistory);
  } finally {
    repository.close();
  }
});

test("impact validates the complete cursor before stale clocks and reports changed context before a removed current-only selected type", async () => {
  const { repository, tracer, first, second } = await fixture();
  try {
    const baseline = await tracer.baselines.capture(
      { name: "Before current-only type", expectedProjectRevision: (await tracer.timeline()).head },
      actor,
    );
    await tracer.setSchema({ ...schema, relationshipTypes: { late: { fields: {} } } }, 1, actor);
    for (let i = 0; i < 2; i++)
      await tracer.evidence.recordReceipt(
        { outputId: second.id, outcome: "PASS", inputs: [{ entityId: first.id }] },
        actor,
      );
    const query = {
      baselineId: baseline.id,
      rootId: first.id,
      direction: "outgoing" as const,
      relationshipTypes: ["late"],
      limit: 1,
    };
    const page = await tracer.getChangeImpact(query),
      cursor = page.evaluations.nextAfter!;
    assert.ok(cursor);
    for (const position of [2, 3, 4])
      for (const value of [null, "1", -1, 1.5, Number.MAX_SAFE_INTEGER + 1, {}, [], true])
        await assert.rejects(
          tracer.getChangeImpact({ ...query, after: replace(cursor, position, value) }),
          { code: "validation" },
        );
    for (const position of [2, 3])
      await assert.rejects(
        tracer.getChangeImpact({ ...query, after: replace(cursor, position, 0) }),
        { code: "validation" },
      );
    for (const value of [null, 0, "0", "01", "1.0", {}])
      await assert.rejects(tracer.getChangeImpact({ ...query, after: replace(cursor, 5, value) }), {
        code: "validation",
      });
    await tracer.evidence.recordReceipt(
      { outputId: second.id, outcome: "Evidence clock changed", inputs: [{ entityId: first.id }] },
      actor,
    );
    await assert.rejects(tracer.getChangeImpact({ ...query, after: cursor }), { code: "conflict" });
    await assert.rejects(
      tracer.getChangeImpact({ ...query, after: replace(cursor, 5, "01") }),
      { code: "validation" },
      "malformed position is not hidden by stale evidence clock",
    );
    await tracer.setSchema(schema, 2, actor);
    const before = await tracer.history();
    await assert.rejects(
      tracer.getChangeImpact({
        ...query,
        expectedProjectRevision: page.context.projectRevision,
        after: replace(cursor, 5, "01"),
      }),
      { code: "validation" },
      "malformed cursor takes precedence over stale explicit native guard",
    );
    await assert.rejects(tracer.getChangeImpact({ ...query, after: cursor }), { code: "conflict" });
    await assert.rejects(
      tracer.getChangeImpact({ ...query, expectedProjectRevision: page.context.projectRevision }),
      { code: "conflict" },
    );
    await assert.rejects(
      tracer.getChangeImpact(query),
      { code: "validation" },
      "a fresh unguarded unknown selected type remains invalid",
    );
    await assert.rejects(
      tracer.getChangeImpact({ ...query, after: replace(cursor, 2, { invalid: "clock" }) }),
      { code: "validation" },
    );
    assert.deepEqual(await tracer.history(), before);
  } finally {
    repository.close();
  }
});
