import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { decodeRead } from "../src/interfaces/api-endpoints.ts";
import type { CoverageExpectation, CoverageEvaluation } from "../src/core/coverage.ts";

const actor = { actor: "coverage-http-qa" };
const expectation: CoverageExpectation = {
  name: "Explicit test-link minimum",
  subject: { type: "requirement" },
  relationshipType: "tested_by",
  direction: "outgoing",
  related: { type: "test" },
  minimumDistinctTargets: 1,
};

async function setup() {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository);
  await tracer.setSchema(
    {
      entityTypes: { requirement: { fields: { title: { type: "string" } } }, test: { fields: {} } },
      relationshipTypes: { tested_by: { fields: {}, source: ["requirement"], target: ["test"] } },
    },
    0,
    actor,
  );
  const first = await tracer.createEntity(
      { type: "requirement", fields: { title: "First requirement" } },
      1,
      actor,
    ),
    second = await tracer.createEntity(
      { type: "requirement", fields: { title: "Second requirement" } },
      1,
      actor,
    ),
    target = await tracer.createEntity({ type: "test", fields: {} }, 1, actor);
  await tracer.createRelationship(
    { type: "tested_by", source: first.id, target: target.id, fields: {} },
    1,
    actor,
  );
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  return { repository, tracer, first, second, server };
}

test("coverage HTTP policy is a guarded native schema write; typed structural reads never imply receipt evidence", async () => {
  const { repository, tracer, server } = await setup();
  try {
    const { token } = await (await fetch(server.origin + "/api/session")).json();
    const headers = {
      "Content-Type": "application/json",
      Origin: server.origin,
      "X-Tracer-Token": token,
    };
    const post = (value: unknown, extra = {}) =>
      fetch(server.origin + "/api/coverage-expectations", {
        method: "POST",
        headers: { ...headers, ...extra },
        body: JSON.stringify(value),
      });
    const proposal = { expectations: { tests: expectation }, expectedSchemaVersion: 1 };
    const before = await tracer.history();
    assert.equal((await post(proposal, { Origin: "https://elsewhere.example" })).status, 403);
    assert.equal((await post(proposal, { "X-Tracer-Token": "wrong" })).status, 403);
    assert.equal((await post({ ...proposal, unexpected: true })).status, 400);
    assert.equal(
      (
        await post({
          ...proposal,
          expectations: { tests: { ...expectation, minimumDistinctTargets: 0 } },
        })
      ).status,
      400,
    );
    assert.deepEqual(await tracer.history(), before);
    const response = await post(proposal);
    assert.equal(response.status, 200);
    const schema = await response.json();
    assert.equal(schema.version, 2);
    assert.deepEqual(schema.coverageExpectations, { tests: expectation });
    assert.deepEqual((await tracer.getSchema())?.coverageExpectations, proposal.expectations);
    assert.equal((await post(proposal)).status, 409);
    const history = await tracer.history(),
      head = (await tracer.timeline()).head;
    const query = { expectationId: "tests", expectedProjectRevision: head };
    const coverageResponse = await fetch(
      `${server.origin}/api/coverage?expectationId=tests&expectedProjectRevision=${head}`,
    );
    assert.equal(coverageResponse.status, 200);
    const result = decodeRead("/api/coverage", query, await coverageResponse.json());
    assert.equal(result.context.projectRevision, head);
    assert.deepEqual(result.expectation, expectation);
    assert.deepEqual(result.rows.items.map((row) => row.state).sort(), ["covered", "missing"]);
    assert.deepEqual(result.summary, {
      scope: "page",
      evaluated: 2,
      covered: 1,
      missing: 1,
      unknown: 0,
    });
    assert.throws(() =>
      decodeRead("/api/coverage", query, {
        ...result,
        rows: { items: [{ ...result.rows.items[0], distinctTargets: "1" }] },
      }),
    );
    assert.throws(() =>
      decodeRead("/api/coverage", query, {
        ...result,
        expectation: { ...result.expectation, minimumDistinctTargets: 0 },
      }),
    );
    for (const field of ["projectRevision", "schemaVersion"])
      assert.throws(() =>
        decodeRead("/api/coverage", query, {
          ...result,
          context: { ...result.context, [field]: 0 },
        }),
      );
    assert.throws(() =>
      decodeRead(
        "/api/coverage-expectations",
        {},
        {
          context: result.context,
          expectations: { tests: { ...expectation, minimumDistinctTargets: 0 } },
        },
      ),
    );
    assert.deepEqual(
      (await (await fetch(server.origin + "/api/coverage-expectations")).json()).expectations,
      { tests: expectation },
    );
    assert.deepEqual(await tracer.history(), history);
    assert.equal((await tracer.timeline()).head, head);
    assert.deepEqual((await tracer.evidence.list("receipt")).items, []);
  } finally {
    await server.close();
    repository.close();
  }
});

test("coverage HTTP pages bind current revision or exact baseline policy, and reject mixed query/cursor scopes", async () => {
  const { repository, tracer, first, server } = await setup();
  try {
    await tracer.coverage.set(
      { expectations: { tests: expectation, another: expectation }, expectedSchemaVersion: 1 },
      actor,
    );
    const head = (await tracer.timeline()).head;
    const baseline = await tracer.baselines.capture(
      { name: "Coverage snapshot", expectedProjectRevision: head },
      actor,
    );
    const get = (query: string) => fetch(`${server.origin}/api/coverage${query}`);
    const response = await get("?expectationId=tests&limit=1");
    const current: CoverageEvaluation = await response.json();
    assert.ok(current.rows.nextAfter);
    const historical: CoverageEvaluation = await (
      await get(`?expectationId=tests&baselineId=${baseline.id}&limit=1`)
    ).json();
    assert.ok(historical.rows.nextAfter);
    for (const query of [
      "",
      "?expectationId=",
      "?expectationId=tests&expectationId=another",
      "?expectationId=tests&limit=0",
      "?expectationId=tests&limit=101",
      "?expectationId=tests&sourceType=requirement",
      "?expectationId=tests&after=bad",
      `?expectationId=another&after=${encodeURIComponent(current.rows.nextAfter)}`,
      `?expectationId=tests&baselineId=${baseline.id}&after=${encodeURIComponent(current.rows.nextAfter)}`,
      `?expectationId=tests&baselineId=${baseline.id}&expectedProjectRevision=${head}`,
    ])
      assert.equal((await get(query)).status, 400);
    assert.equal((await get("?expectationId=missing")).status, 404);
    assert.equal((await get("?expectationId=tests&baselineId=missing")).status, 404);
    assert.equal((await fetch(server.origin + "/api/coverage-expectations?limit=1")).status, 400);
    assert.equal(
      (await fetch(server.origin + "/api/coverage-expectations?baselineId=x&baselineId=y")).status,
      400,
    );
    await tracer.updateEntity(first.id, 1, { fields: { title: "Later requirement" } }, 2, actor);
    const before = await tracer.history();
    assert.equal((await get(`?expectationId=tests&expectedProjectRevision=${head}`)).status, 409);
    assert.equal(
      (await get(`?expectationId=tests&after=${encodeURIComponent(current.rows.nextAfter)}`))
        .status,
      409,
    );
    const continued = await get(
      `?expectationId=tests&baselineId=${baseline.id}&after=${encodeURIComponent(historical.rows.nextAfter)}`,
    );
    assert.equal(continued.status, 200);
    const last: CoverageEvaluation = await continued.json();
    assert.equal(last.rows.items.length, 1);
    assert.equal(last.rows.nextAfter, undefined);
    assert.deepEqual(last.context, historical.context);
    assert.deepEqual(
      (
        await (
          await fetch(`${server.origin}/api/coverage-expectations?baselineId=${baseline.id}`)
        ).json()
      ).expectations,
      { tests: expectation, another: expectation },
    );
    assert.deepEqual(await tracer.history(), before);
  } finally {
    await server.close();
    repository.close();
  }
});
