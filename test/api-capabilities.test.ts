import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "../src/client.ts";
import type { CompatibilityRequirements } from "../src/client.ts";
import { Tracer } from "../src/index.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { describeApi, readEndpoints, writeEndpoints } from "../src/interfaces/api-endpoints.ts";
import { renderApiReference } from "../src/interfaces/api-reference.ts";
import type { ApiCapabilities } from "../src/client.ts";

const schema = { entityTypes: { item: { fields: {} } }, relationshipTypes: {} };
const input = {
  expectedSchemaVersion: 1,
  operations: [{ op: "entity.create" as const, input: { type: "item", fields: {} } }],
};
async function fixture(t: TestContext) {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  const server = await startHeadlessServer(tracer, { port: 0 });
  t.after(async () => {
    await server.close();
    repository.close();
  });
  return { repository, tracer, server };
}

test("capabilities derive operations/features from dispatch, work without a model and never access storage", async (t) => {
  const { repository, tracer, server } = await fixture(t);
  let transactions = 0;
  const transaction = repository.transaction.bind(repository);
  repository.transaction = (work) => {
    transactions++;
    return transaction(work);
  };
  const client = createClient({ baseUrl: server.origin });
  const capabilities = await client.read("/api/capabilities", {});
  assert.deepEqual(capabilities, describeApi());
  assert.equal(capabilities.contractVersion, 2);
  assert.deepEqual(capabilities.features, [
    "atomic-evaluation-commands",
    "change-assessment-opening",
    "changeset-command-recovery",
    "evidence-revision-guards",
    "native-resources",
    "pinned-application-models",
    "qualified-references",
    "relationship-evaluation-inputs",
  ]);
  assert.deepEqual(
    capabilities.operations.filter((item) => item.method === "GET").map((item) => item.path),
    Object.keys(readEndpoints).sort(),
  );
  assert.deepEqual(
    capabilities.operations.filter((item) => item.method === "POST").map((item) => item.path),
    Object.keys(writeEndpoints).sort(),
  );
  assert.equal(transactions, 0);
  const raw = await fetch(server.origin + "/api/capabilities");
  assert.equal(raw.headers.get("cache-control"), "no-store");
  assert.equal((await fetch(server.origin + "/api/capabilities?extra=1")).status, 400);
  assert.equal(
    (
      await fetch(server.origin + "/api/capabilities", {
        headers: { Origin: "http://elsewhere.invalid" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(server.origin + "/api/capabilities", {
        headers: { "X-Tracer-Project": "missing" },
      })
    ).status,
    404,
  );
  assert.equal(transactions, 0);
  await tracer.setSchema(schema, 0, { actor: "capabilities" });
  await tracer.setSchema(schema, 1, { actor: "capabilities" });
  assert.equal((await tracer.getSchema())!.version, 2);
  assert.deepEqual(await client.read("/api/capabilities", {}), capabilities);
});

test("configured compatibility verifies discovery before session or writes and preserves captured requirements", async (t) => {
  const { tracer, server } = await fixture(t);
  await tracer.setSchema(schema, 0, { actor: "capabilities" });
  const requests: string[] = [];
  const required = {
    features: ["changeset-command-recovery"],
    operations: [{ method: "POST", path: "/api/changesets" }],
    minimumLimits: { maxChangesetOperations: 1000 },
  };
  const client = createClient({
    baseUrl: server.origin,
    require: required,
    fetch: (...args) => {
      requests.push(`${args[1]?.method} ${new URL(String(args[0])).pathname}`);
      return fetch(...args);
    },
  });
  required.features.push("mutation-after-construction");
  assert.throws(() => client.write("/api/changesets", input), { code: "incompatible_api" });
  assert.deepEqual(requests, []);
  await client.connect();
  const result = await client.write("/api/changesets", input);
  assert.equal(result.results.length, 1);
  assert.deepEqual(requests, ["GET /api/capabilities", "GET /api/session", "POST /api/changesets"]);
});

test("advertised limits match authoritative request and command enforcement", async (t) => {
  const { tracer, server } = await fixture(t);
  await tracer.setSchema(schema, 0, { actor: "capabilities" });
  const client = createClient({ baseUrl: server.origin });
  const { limits } = await client.checkCompatibility();
  await client.connect();
  await assert.rejects(
    client.write("/api/changesets", {
      ...input,
      operations: Array.from(
        { length: limits.maxChangesetOperations + 1 },
        () => input.operations[0],
      ),
    }),
    { code: "validation" },
  );
  await assert.rejects(
    client.write("/api/changesets", {
      ...input,
      commandId: "x".repeat(limits.maxCommandIdCharacters + 1),
    }),
    { code: "validation" },
  );
  await assert.rejects(
    client.write("/api/changesets", {
      ...input,
      operations: [
        {
          op: "entity.create",
          input: { type: "item", fields: { oversized: "x".repeat(limits.maxRequestBodyBytes) } },
        },
      ],
    }),
    { code: "usage" },
  );
  assert.equal((await tracer.changesets()).length, 1);
});

test("incompatible contracts, missing features/operations and insufficient limits never send a write", async () => {
  const cases: [Partial<ApiCapabilities>, CompatibilityRequirements][] = [
    [{ contractVersion: 1 }, {}],
    [{ contractVersion: 3 }, {}],
    [{ api: "another-api" }, {}],
    [{ features: [] }, { features: ["changeset-command-recovery"] }],
    [{ operations: [] }, { operations: [{ method: "POST", path: "/api/changesets" }] }],
    [{}, { minimumLimits: { maxChangesetOperations: 1001 } }],
  ];
  for (const [override, require] of cases) {
    const requests: string[] = [];
    const client = createClient({
      require,
      fetch: async (url, options) => {
        requests.push(`${options?.method} ${url}`);
        return Response.json({ ...describeApi(), ...override });
      },
    });
    await assert.rejects(client.connect(), { code: "incompatible_api" });
    assert.throws(() => client.write("/api/changesets", input), { code: "incompatible_api" });
    assert.deepEqual(requests, ["GET /api/capabilities"]);
  }
});

test("legacy, malformed and unavailable discovery remain blocked until a later successful explicit check", async () => {
  const responses = [
    Response.json({ error: "not_found", message: "Unknown query endpoint" }, { status: 404 }),
    Response.json({ contractVersion: 1 }),
    Response.json({ ...describeApi(), limits: { maxChangesetOperations: "1000" } }),
    new Response("not-json"),
  ];
  for (const response of responses) {
    const client = createClient({ fetch: async () => response });
    await assert.rejects(client.checkCompatibility(), {
      code: response.status === 404 ? "incompatible_api" : "read_failed",
    });
    assert.throws(() => client.write("/api/changesets", input), { code: "incompatible_api" });
  }
  let unavailable = true;
  const client = createClient({
    require: { features: ["changeset-command-recovery"] },
    fetch: async (_url, options) => {
      if (options?.signal?.aborted) throw new Error("aborted");
      if (unavailable) throw new Error("offline");
      return Response.json(describeApi());
    },
  });
  await assert.rejects(client.checkCompatibility(), { code: "read_failed" });
  unavailable = false;
  assert.deepEqual(await client.checkCompatibility(), describeApi());
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(client.checkCompatibility({}, { signal: abort.signal }), {
    code: "read_failed",
  });
  assert.throws(() => client.write("/api/changesets", input), { code: "incompatible_api" });
});

test("additive discovery extensions remain compatible, while a later failed check revokes write readiness", async () => {
  let writes = 0;
  const client = createClient({
    fetch: async (_url, options) => {
      if (options?.method === "POST") writes++;
      return Response.json({
        ...describeApi(),
        features: [...describeApi().features, "future-feature"],
        extra: { additive: true },
      });
    },
  });
  const requirements = { features: ["changeset-command-recovery"] };
  const pending = client.checkCompatibility(requirements);
  requirements.features.push("changed-while-in-flight");
  assert.equal((await pending).contractVersion, 2);
  await assert.rejects(client.checkCompatibility({ features: ["unsupported"] }), {
    code: "incompatible_api",
  });
  assert.throws(() => client.write("/api/changesets", input), { code: "incompatible_api" });
  assert.equal(writes, 0);
});

test("an older successful compatibility check cannot unblock a newer failed check", async () => {
  const pending: ((response: Response) => void)[] = [];
  const client = createClient({
    fetch: async () => new Promise<Response>((resolve) => pending.push(resolve)),
  });
  const older = client.checkCompatibility();
  const newer = client.checkCompatibility({ features: ["unsupported"] });
  pending[1](Response.json(describeApi()));
  await assert.rejects(newer, { code: "incompatible_api" });
  pending[0](Response.json(describeApi()));
  await assert.rejects(older, { code: "incompatible_api" });
  assert.throws(() => client.write("/api/changesets", input), { code: "incompatible_api" });
});

test("explicit requirements cannot weaken configured requirements and invalid input is captured before IO", async () => {
  let requests = 0;
  const client = createClient({
    require: { features: ["configured"] },
    fetch: async () => {
      requests++;
      return Response.json(describeApi());
    },
  });
  await assert.rejects(client.checkCompatibility({}), { code: "incompatible_api" });
  for (const bad of [
    { features: "text" },
    { minimumLimits: { unknown: 1 } },
    { minimumLimits: { maxChangesetOperations: -1 } },
  ])
    await assert.rejects(client.checkCompatibility(bad as never), { code: "validation" });
  assert.equal(requests, 1);
  assert.throws(() => createClient({ require: { features: "text" } as never }), {
    code: "validation",
  });
});

test("generated reference stays in sync with query codecs and registered JSON request keys", () => {
  const reference = renderApiReference();
  assert.equal(
    readFileSync("docs/api-reference.md", "utf8"),
    reference,
    "Run npm run api:reference after endpoint changes",
  );
  assert.match(reference, /`commandId`\* \(text\)/);
  assert.match(reference, /`query`\* \(json\)/);
  assert.match(reference, /`expanded` \(csv\)/);
  for (const operation of describeApi().operations)
    assert.ok(reference.includes(`| ${operation.method} | \`${operation.path}\` |`));
});
