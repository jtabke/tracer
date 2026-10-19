import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { decodeRead } from "../src/interfaces/api-endpoints.ts";
import type { ChangeImpactQuery } from "../src/core/impact.ts";

const actor = { actor: "impact-http-qa" };
async function fixture() {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository);
  await tracer.setSchema(
    {
      entityTypes: { item: { fields: { title: { type: "string" } } } },
      relationshipTypes: { dependency: { fields: {} }, references: { fields: {} } },
    },
    0,
    actor,
  );
  const root = await tracer.createEntity(
      { type: "item", fields: { title: "Scoped input" } },
      1,
      actor,
    ),
    output = await tracer.createEntity(
      { type: "item", fields: { title: "Recorded output" } },
      1,
      actor,
    ),
    other = await tracer.createEntity(
      { type: "item", fields: { title: "Other starting context" } },
      1,
      actor,
    );
  const baseline = await tracer.baselines.capture(
    { name: "Exact native snapshot", expectedProjectRevision: (await tracer.timeline()).head },
    actor,
  );
  for (let index = 0; index < 3; index++)
    await tracer.evidence.recordReceipt(
      { outputId: output.id, outcome: "PASS", inputs: [{ entityId: root.id }] },
      actor,
    );
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  const query: ChangeImpactQuery = {
    baselineId: baseline.id,
    rootId: root.id,
    direction: "outgoing",
    relationshipTypes: [],
    limit: 1,
  };
  const get = (value: ChangeImpactQuery) => {
    const params = new URLSearchParams();
    for (const [key, item] of Object.entries(value))
      params.set(key, key === "relationshipTypes" ? JSON.stringify(item) : String(item));
    return fetch(`${server.origin}/api/impact?${params}`);
  };
  return { repository, tracer, root, other, output, baseline, server, query, get };
}

test("impact HTTP is a strictly scoped read with typed immutable capture/current results and no implicit writes", async () => {
  const { repository, tracer, root, server, query, get } = await fixture();
  try {
    const head = (await tracer.timeline()).head,
      before = await tracer.history(),
      captures = await tracer.evidence.list("receipt");
    const response = await get({ ...query, expectedProjectRevision: head });
    assert.equal(response.status, 200);
    const result = decodeRead("/api/impact", query, await response.json());
    assert.equal(result.context.projectRevision, head);
    assert.ok(Number.isSafeInteger(result.context.evidenceRevision));
    assert.deepEqual(result.scope, {
      rootId: root.id,
      direction: "outgoing",
      relationshipTypes: [],
      depth: 2,
    });
    assert.deepEqual(result.summary, {
      scope: "page",
      evaluated: 1,
      current: 1,
      changed: 0,
      unknown: 0,
    });
    assert.equal(result.evaluations.items[0].receipt.outcome, "PASS");
    assert.equal(result.native.entities[0].state, "unchanged");
    assert.ok(result.evaluations.nextAfter);
    for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      for (const field of ["evaluated", "current", "changed", "unknown"])
        assert.throws(() =>
          decodeRead("/api/impact", query, {
            ...result,
            summary: { ...result.summary, [field]: invalid },
          }),
        );
      assert.throws(() =>
        decodeRead("/api/impact", query, {
          ...result,
          context: { ...result.context, evidenceRevision: invalid },
        }),
      );
      assert.throws(() =>
        decodeRead("/api/impact", query, {
          ...result,
          evaluations: {
            ...result.evaluations,
            items: result.evaluations.items.map((item) => ({
              ...item,
              supersession: { ...item.supersession, count: invalid },
            })),
          },
        }),
      );
      assert.throws(() =>
        decodeRead("/api/impact", query, {
          ...result,
          native: {
            ...result.native,
            before: {
              ...result.native.before,
              paths: result.native.before.paths.map((path) => ({ ...path, depth: invalid })),
            },
          },
        }),
      );
    }
    assert.throws(() =>
      decodeRead("/api/impact", query, {
        ...result,
        context: { ...result.context, projectRevision: 0 },
      }),
    );
    assert.throws(() =>
      decodeRead("/api/impact", query, {
        ...result,
        scope: { ...result.scope, depth: 0 },
      }),
    );
    assert.throws(() =>
      decodeRead("/api/impact", query, { ...result, summary: { ...result.summary, current: "1" } }),
    );
    assert.throws(() =>
      decodeRead("/api/impact", query, {
        ...result,
        evaluations: {
          items: [
            {
              ...result.evaluations.items[0],
              scope: { ...result.evaluations.items[0].scope, state: "verified" },
            },
          ],
        },
      }),
    );
    const base = `baselineId=${query.baselineId}&rootId=${root.id}&direction=outgoing&relationshipTypes=%5B%5D`;
    for (const suffix of [
      "&limit=0",
      "&limit=26",
      "&depth=0",
      "&depth=7",
      "&depth=1&depth=2",
      "&limit=1&limit=2",
      "&rootId=x",
      "&relationshipTypes=%5B%5D",
      "&unexpected=true",
      "&expectedProjectRevision=0",
      "&after=bad",
    ])
      assert.equal((await fetch(`${server.origin}/api/impact?${base}${suffix}`)).status, 400);
    for (const raw of [
      "",
      `baselineId=${query.baselineId}&rootId=${root.id}&direction=outgoing`,
      base.replace("direction=outgoing", "direction=sideways"),
      base.replace("relationshipTypes=%5B%5D", "relationshipTypes=not-json"),
      base.replace("relationshipTypes=%5B%5D", "relationshipTypes=%7B%7D"),
      base.replace(
        "relationshipTypes=%5B%5D",
        `relationshipTypes=${encodeURIComponent(JSON.stringify(["dependency", "dependency"]))}`,
      ),
    ])
      assert.equal((await fetch(`${server.origin}/api/impact?${raw}`)).status, 400);
    assert.equal((await get({ ...query, baselineId: "missing" })).status, 404);
    assert.equal(
      (await get({ ...query, rootId: "00000000-0000-4000-8000-999999999999" })).status,
      404,
    );
    assert.deepEqual(await tracer.history(), before);
    assert.equal((await tracer.timeline()).head, head);
    assert.deepEqual(await tracer.evidence.list("receipt"), captures);
    assert.deepEqual((await tracer.evidence.list("review")).items, []);
    const { token } = await (await fetch(server.origin + "/api/session")).json();
    assert.equal(
      (
        await fetch(server.origin + "/api/impact", {
          method: "POST",
          headers: {
            Origin: server.origin,
            "X-Tracer-Token": token,
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      404,
    );
    assert.deepEqual(await tracer.history(), before);
    assert.deepEqual(await tracer.evidence.list("receipt"), captures);
  } finally {
    await server.close();
    repository.close();
  }
});

test("impact HTTP cursors bind exact native/evidence snapshot and scope while permitting changed page size and sorted filter order", async () => {
  const { repository, tracer, root, other, output, baseline, server, query, get } = await fixture();
  try {
    const firstResponse = await get({ ...query, relationshipTypes: ["references", "dependency"] });
    assert.equal(firstResponse.status, 200);
    const first = decodeRead("/api/impact", query, await firstResponse.json()),
      after = first.evaluations.nextAfter!;
    const continuation = await get({
      ...query,
      relationshipTypes: ["dependency", "references"],
      after,
      limit: 25,
    });
    assert.equal(continuation.status, 200);
    const continued = decodeRead("/api/impact", query, await continuation.json());
    assert.equal(continued.evaluations.items.length, 2);
    assert.equal(continued.evaluations.nextAfter, undefined);
    assert.deepEqual(continued.context, first.context);
    const secondBaseline = await tracer.baselines.capture(
      {
        name: "Another metadata identity",
        expectedProjectRevision: (await tracer.timeline()).head,
      },
      actor,
    );
    for (const changed of [
      { rootId: other.id },
      { baselineId: secondBaseline.id },
      { direction: "incoming" as const },
      { depth: 3 },
      { relationshipTypes: ["dependency"] },
    ])
      assert.equal(
        (
          await get({
            ...query,
            relationshipTypes: ["dependency", "references"],
            after,
            ...changed,
          })
        ).status,
        400,
      );
    const nativeHead = (await tracer.timeline()).head;
    await tracer.evidence.recordReceipt(
      { outputId: output.id, outcome: "New evidence only", inputs: [{ entityId: root.id }] },
      actor,
    );
    assert.equal((await tracer.timeline()).head, nativeHead);
    assert.equal(
      (await get({ ...query, relationshipTypes: ["dependency", "references"], after })).status,
      409,
    );
    const fresh = decodeRead("/api/impact", query, await (await get(query)).json());
    assert.ok(fresh.context.evidenceRevision > first.context.evidenceRevision);
    await tracer.removeEntity(root.id, 1, 1, actor, true);
    assert.equal((await get({ ...query, expectedProjectRevision: nativeHead })).status, 409);
    assert.equal((await get({ ...query, after: fresh.evaluations.nextAfter })).status, 409);
    const deletedResponse = await get({ ...query, limit: 25 });
    assert.equal(deletedResponse.status, 200);
    const deleted = decodeRead("/api/impact", query, await deletedResponse.json());
    assert.equal(deleted.context.baseline.id, baseline.id);
    assert.equal(deleted.native.entities[0].state, "removed");
    assert.equal(deleted.native.entities[0].after, null);
    assert.equal(deleted.summary.unknown, 4);
    assert.ok(
      deleted.evaluations.items.every(
        (item) => item.scope.hasUnknown && item.receipt.outcome.length > 0,
      ),
    );
  } finally {
    await server.close();
    repository.close();
  }
});
