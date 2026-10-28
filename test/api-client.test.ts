import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "../src/client.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { encodeQuery, decodeQuery } from "../src/interfaces/api-endpoints.ts";
import type { ReadPath, ReadQuery } from "../src/interfaces/api-contract.ts";

const schema = {
  entityTypes: { item: { fields: { title: { type: "string" as const } } } },
  relationshipTypes: { connects: { fields: {} } },
};
async function fixture(t: TestContext) {
  const repository = new SQLiteRepository(":memory:");
  const secondary = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  const server = await startHeadlessServer(tracer, {
    port: 0,
    provenance: { actor: "trusted-automation", reason: "Headless test" },
    projects: [{ id: "other", title: "Other", tracer: new Tracer(secondary) }],
  });
  t.after(async () => {
    await server.close();
    repository.close();
    secondary.close();
  });
  const client = createClient({ baseUrl: server.origin });
  await client.connect();
  await client.write("/api/schema", { schema, expectedVersion: 0 });
  return { client, server, tracer };
}
async function createItems(client: ReturnType<typeof createClient>) {
  const result = await client.write("/api/changesets", {
    expectedSchemaVersion: 1,
    operations: [
      { op: "entity.create", input: { type: "item", key: "A", fields: { title: "First" } } },
      { op: "entity.create", input: { type: "item", key: "B", fields: { title: "Second" } } },
    ],
  });
  return result.results.map((value) => value.id);
}

test("headless client writes guarded commands without a UI build and retains trusted provenance", async (t) => {
  const { client, server, tracer } = await fixture(t);
  const [source, target] = await createItems(client);
  const before = await client.read("/api/project-snapshot", {});
  await client.write("/api/changesets", {
    expectedSchemaVersion: 1,
    expectedProjectRevision: before.projectRevision,
    operations: [
      { op: "relationship.create", input: { type: "connects", source, target, fields: {} } },
    ],
  });
  const chain = await client.read("/api/chain", {
    type: "item",
    steps: [{ type: "item", relationshipType: "connects" }],
  });
  assert.equal(chain.rows.find((row) => row.cells[0]?.id === source)?.cells[1]?.id, target);
  assert.equal(
    (await client.read("/api/graph", { rootId: source, expanded: [target] })).links.length,
    1,
  );
  assert.deepEqual(
    (await client.read("/api/timeline", {})).items.map((item) => item.actor),
    ["trusted-automation", "trusted-automation", "trusted-automation"],
  );
  const failed = client.write("/api/changesets", {
    expectedSchemaVersion: 1,
    operations: [{ op: "entity.update", id: source, expectedVersion: 9, input: { fields: {} } }],
  });
  await assert.rejects(failed, {
    code: "conflict",
    details: { kind: "entity", id: source, expectedVersion: 9, actualVersion: 1 },
  });
  assert.equal((await tracer.getEntity(source)).version, 1);
  assert.equal((await fetch(server.origin + "/")).status, 404);
});

test("impact JSON arrays and structured working-context queries round-trip through the real server", async (t) => {
  const { client } = await fixture(t);
  const [source, target] = await createItems(client);
  const head = (await client.read("/api/project-snapshot", {})).projectRevision;
  const baseline = await client.write("/api/baselines", {
    name: "Before",
    expectedProjectRevision: head,
  });
  for (const relationshipTypes of [[], ["connects"]]) {
    const impact = await client.read("/api/impact", {
      baselineId: baseline.id,
      rootId: source,
      direction: "both",
      relationshipTypes,
    });
    assert.deepEqual(impact.scope.relationshipTypes, relationshipTypes);
  }
  const result = await client.read("/api/working-context", {
    focusId: target,
    recipe: { routes: [] },
    receipts: { limit: 2 },
  });
  assert.equal(result.focus.id, target);
});

test("headless clients isolate projects, servers and sessions", async (t) => {
  const { client, server } = await fixture(t);
  const other = createClient({ baseUrl: server.origin, project: "other" });
  assert.equal(await other.read("/api/schema", {}), null);
  await assert.rejects(other.write("/api/schema", { schema, expectedVersion: 0 }), {
    code: "usage",
  });
  await other.connect();
  await other.write("/api/schema", {
    schema: { ...schema, entityTypes: { other: { fields: {} } } },
    expectedVersion: 0,
  });
  assert.ok((await client.read("/api/schema", {}))?.entityTypes.item);
  assert.ok((await other.read("/api/schema", {}))?.entityTypes.other);
  const missing = createClient({ baseUrl: server.origin, project: "missing" });
  await assert.rejects(missing.read("/api/schema", {}), { code: "not_found" });
  const second = await fixture(t);
  assert.equal((await second.client.read("/api/project-snapshot", {})).entities.length, 0);
});

test("request validation rejects malformed and extra fields without engineering writes", async (t) => {
  const { client, tracer } = await fixture(t);
  const before = await tracer.exportProject();
  const invalid = [
    { expectedSchemaVersion: 1, operations: "bad" },
    { expectedSchemaVersion: 1, operations: [], actor: "spoofed" },
    {
      expectedSchemaVersion: 1,
      operations: [{ op: "entity.create", input: { type: "item", fields: {}, extra: true } }],
    },
  ];
  for (const input of invalid)
    await assert.rejects(client.write("/api/changesets", input as never), { code: "validation" });
  await assert.rejects(
    client.write("/api/schema", {
      schema,
      expectedVersion: 1,
      provenance: { actor: "spoofed" },
    } as never),
    { code: "validation" },
  );
  assert.deepEqual(await tracer.exportProject(), before);
});

test("transport failures, cancellation and malformed responses do not replay writes", async () => {
  let calls = 0;
  const client = createClient({
    baseUrl: "http://localhost:4317",
    headers: { Authorization: "Bearer example" },
    fetch: async (_url, init) => {
      calls++;
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer example");
      throw new Error("connection lost");
    },
  });
  await assert.rejects(client.read("/api/schema", {}), { code: "read_failed" });
  await assert.rejects(client.write("/api/schema", { schema, expectedVersion: 0 }), {
    code: "outcome_unknown",
  });
  assert.equal(calls, 2);
  const malformed = createClient({ fetch: async () => new Response("{}") });
  await assert.rejects(malformed.read("/api/schema", {}), { code: "read_failed" });
  await assert.rejects(malformed.write("/api/schema", { schema, expectedVersion: 0 }), {
    code: "outcome_unknown",
  });
  const signal = AbortSignal.abort();
  const cancelled = createClient({
    fetch: async (_url, init) => {
      assert.equal(init?.signal, signal);
      throw signal.reason;
    },
  });
  await assert.rejects(cancelled.write("/api/schema", { schema, expectedVersion: 0 }, { signal }), {
    code: "outcome_unknown",
  });
});

test("every read endpoint has a paired query codec", () => {
  const queries: { [K in ReadPath]: ReadQuery<K> } = {
    "/api/configuration-capture-context": {},
    "/api/verification-analysis": { caseId: "case", openingCommandId: "opening" },
    "/api/verification-case": { caseId: "case", openingCommandId: "opening" },
    "/api/verification-case-locate": { caseId: "case" },
    "/api/verification-execution": {
      caseId: "case",
      openingCommandId: "opening",
      executionId: "execution",
    },
    "/api/verification-model": { entityId: "missing", version: 1, field: "definition" },
    "/api/assessment-locate": { assessmentId: "assessment" },
    "/api/assessment-analysis": { assessmentId: "assessment", openingCommandId: "open-command" },
    "/api/assessment-disposition": {
      assessmentId: "assessment",
      openingCommandId: "open-command",
      kind: "entity",
      id: "candidate",
    },
    "/api/change-assessment": { assessmentId: "assessment", openingCommandId: "open-command" },
    "/api/reference": { id: "reference" },
    "/api/capabilities": {},
    "/api/evaluation-outcome": { commandId: "missing" },
    "/api/application-model": { entityId: "missing", version: 1, field: "definition" },
    "/api/changeset-outcome": { commandId: "job-1" },
    "/api/next-work": { requirementType: "item" },
    "/api/project-export": {},
    "/api/projects": {},
    "/api/project-snapshot": {},
    "/api/working-context": { focusId: "focus", recipe: { routes: [] }, receipts: { limit: 2 } },
    "/api/impact": {
      baselineId: "baseline",
      rootId: "focus",
      direction: "incoming",
      relationshipTypes: ["connects", "other"],
      depth: 2,
    },
    "/api/coverage-expectations": {},
    "/api/coverage": { expectationId: "policy", expectedProjectRevision: 3 },
    "/api/baselines": { limit: 2 },
    "/api/baseline": { id: "baseline" },
    "/api/baseline-contents": { baselineId: "baseline", kind: "entity", limit: 2 },
    "/api/session": {},
    "/api/schema": {},
    "/api/demo-guide": {},
    "/api/saved-views": {},
    "/api/configurations": { subject: "focus" },
    "/api/configuration": { id: "config" },
    "/api/native-pin": { id: "focus", version: 2 },
    "/api/entities": { search: "a & b", limit: 2 },
    "/api/relationships": { source: "focus" },
    "/api/history": { kind: "entity", limit: 2 },
    "/api/timeline": { before: 3 },
    "/api/evidence": { kind: "receipt" },
    "/api/receipt": { receiptId: "receipt" },
    "/api/comparison": { receiptId: "receipt" },
    "/api/table": { type: "item", focusId: "focus" },
    "/api/matrix": { sourceType: "item", targetType: "item", relationshipType: "connects" },
    "/api/graph": { rootId: "focus", expanded: ["first", "second"], depth: 2 },
    "/api/work": { field: "title", value: "Example" },
    "/api/family": { rootId: "focus", direction: "incoming" },
    "/api/connections": { id: "focus", limit: 2 },
    "/api/chain": {
      type: "item",
      steps: [{ type: "item", relationshipType: "connects", direction: "outgoing" }],
    },
    "/api/model-connections": { type: "connects" },
  };
  for (const path of Object.keys(queries) as ReadPath[])
    assert.deepEqual(
      decodeQuery(path, new URL(encodeQuery(path, queries[path]), "http://localhost")),
      queries[path],
      path,
    );
});

test("headless evidence, saved views, captures and export share the native API boundary", async (t) => {
  const { client } = await fixture(t);
  const [source, target] = await createItems(client);
  await client.write("/api/external", {
    entityId: source,
    system: "file",
    externalId: "fixture",
    ownership: "external",
  });
  const observation = await client.write("/api/observations", {
    entityId: source,
    locator: { system: "file", path: "unavailable-in-headless-fixture" },
  });
  assert.equal(observation.availability, "unknown");
  const receipt = await client.write("/api/receipts", {
    outputId: target,
    expectedOutputVersion: 1,
    outcome: "Recorded",
    inputs: [{ entityId: source, expectedVersion: 1, observationId: observation.id }],
  });
  assert.equal(receipt.actor, "trusted-automation");
  const comparison = await client.read("/api/comparison", { receiptId: receipt.id });
  const review = await client.write("/api/reviews", {
    receiptId: receipt.id,
    decision: "acknowledged",
    rationale: "Reviewed recorded inputs",
    expectedComparison: comparison.token,
  });
  assert.equal(review.actor, "trusted-automation");
  assert.equal((await client.read("/api/receipt", { receiptId: receipt.id })).id, receipt.id);
  assert.equal(
    (await client.read("/api/evidence", { kind: "receipt" })).items[0].outcome,
    "Recorded",
  );
  const configuration = await client.write("/api/configurations", {
    name: "Captured",
    subjectId: target,
    expectedSubjectVersion: 1,
    members: [{ entityId: target, version: 1 }],
    relationships: [],
  });
  assert.equal(
    (await client.read("/api/configuration", { id: configuration.id })).members[0].entity.id,
    target,
  );
  const view = await client.write("/api/saved-views", {
    name: "Items",
    expectedVersion: 0,
    expectedSchemaVersion: 1,
    definition: { kind: "chain", type: "item", steps: [] },
  });
  assert.equal((await client.read("/api/saved-views", {}))[0].id, view.id);
  await client.write("/api/saved-views/remove", { id: view.id, expectedVersion: view.version });
  assert.deepEqual(await client.read("/api/saved-views", {}), []);
  const pin = await client.read("/api/native-pin", { id: target, version: 1 });
  assert.equal(pin.entity.id, target);
  await client.write("/api/coverage-expectations", { expectations: {}, expectedSchemaVersion: 1 });
  assert.deepEqual((await client.read("/api/coverage-expectations", {})).expectations, {});
  const exported = await client.read("/api/project-export", {});
  assert.deepEqual(exported, await client.read("/api/project-export", {}));
});

test("read decoding retains the invoked query even if the caller mutates it", async (t) => {
  const native = await fixture(t);
  const [source, target] = await createItems(native.client);
  const receipt = await native.client.write("/api/receipts", {
    outputId: target,
    outcome: "Recorded",
    inputs: [{ entityId: source }],
  });
  let complete!: (response: Response) => void;
  const client = createClient({
    fetch: async () =>
      new Promise<Response>((resolve) => {
        complete = resolve;
      }),
  });
  const query: { kind: "receipt" | "review" } = { kind: "receipt" };
  const pending = client.read("/api/evidence", query);
  query.kind = "review";
  complete(new Response(JSON.stringify({ items: [receipt] })));
  assert.deepEqual(await pending, { items: [receipt] });
  const cyclic = { recipe: {} };
  cyclic.recipe = cyclic;
  assert.throws(() => client.read("/api/working-context", cyclic as never), { code: "validation" });
});

test("a lost response after commit reports uncertainty and never duplicates the command", async (t) => {
  const { client, server } = await fixture(t);
  let writes = 0;
  const uncertain = createClient({
    baseUrl: server.origin,
    fetch: async (url, init) => {
      const response = await fetch(url, init);
      if (init?.method === "POST") {
        writes++;
        assert.equal(response.status, 200);
        await response.json();
        throw new Error("response lost after server commit");
      }
      return response;
    },
  });
  await uncertain.connect();
  await assert.rejects(
    uncertain.write("/api/changesets", {
      expectedSchemaVersion: 1,
      operations: [
        { op: "entity.create", input: { type: "item", fields: { title: "Saved once" } } },
      ],
    }),
    { code: "outcome_unknown" },
  );
  const inspected = await client.read("/api/project-snapshot", {});
  assert.equal(writes, 1);
  assert.equal(inspected.projectRevision, 2);
  assert.equal(inspected.entities.length, 1);
  assert.equal(inspected.entities[0].fields.title, "Saved once");
});
