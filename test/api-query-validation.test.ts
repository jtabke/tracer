import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "../src/client.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { decodeQuery } from "../src/interfaces/api-endpoints.ts";
import type { ReadPath } from "../src/interfaces/api-contract.ts";

const origin = "http://localhost";
test("integer query fields reject ambiguous formats and unsafe values before service dispatch", () => {
  const cases: [ReadPath, Record<string, string>, string][] = [
    ["/api/entities", {}, "limit"],
    ["/api/graph", { rootId: "item" }, "depth"],
    ["/api/timeline", {}, "before"],
    ["/api/native-pin", { id: "item" }, "version"],
    ["/api/coverage", { expectationId: "policy" }, "expectedProjectRevision"],
    [
      "/api/impact",
      { baselineId: "baseline", rootId: "item", direction: "both", relationshipTypes: "[]" },
      "depth",
    ],
  ];
  for (const [path, query, field] of cases)
    for (const value of [
      "",
      " ",
      "1.5",
      "1e2",
      "0x10",
      "Infinity",
      "NaN",
      "9007199254740992",
      "+1",
      "01",
    ])
      assert.throws(
        () =>
          decodeQuery(
            path,
            new URL(path + "?" + new URLSearchParams({ ...query, [field]: value }), origin),
          ),
        { code: "validation" },
        `${path}:${field}=${value}`,
      );
});

test("query definitions enforce required fields, choices, unknown fields and nested JSON structure", () => {
  for (const suffix of ["", "?id=x", "?type=item&extra=x"])
    assert.throws(() => decodeQuery("/api/table", new URL("/api/table" + suffix, origin)), {
      code: "validation",
    });
  assert.throws(() => decodeQuery("/api/history", new URL("/api/history?kind=made-up", origin)), {
    code: "validation",
  });
  assert.throws(
    () => decodeQuery("/api/entities", new URL("/api/entities?limit=1&limit=2", origin)),
    { code: "usage" },
  );
  for (const query of [
    { focusId: "item", recipe: { routes: [] }, limit: "2" },
    { focusId: "item", recipe: { routes: [] }, extra: true },
    {
      focusId: "item",
      recipe: { routes: [] },
      trace: { rowId: "row", routeKey: "route", stage: 1.5 },
    },
  ])
    assert.throws(
      () =>
        decodeQuery(
          "/api/working-context",
          new URL(
            "/api/working-context?" + new URLSearchParams({ query: JSON.stringify(query) }),
            origin,
          ),
        ),
      { code: "validation" },
    );
  assert.deepEqual(
    decodeQuery("/api/graph", new URL("/api/graph?rootId=item&depth=2&expanded=", origin)),
    { rootId: "item", depth: 2, expanded: [] },
  );
});

test("malformed queries return stable field errors without reading storage or recording history", async (t) => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  let transactions = 0;
  const original = repository.transaction.bind(repository);
  repository.transaction = (work) => {
    transactions++;
    return original(work);
  };
  const server = await startHeadlessServer(tracer, { port: 0 });
  t.after(async () => {
    await server.close();
    repository.close();
  });
  const response = await fetch(server.origin + "/api/entities?limit=1e2");
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "validation",
    message: "Invalid integer query parameter: limit",
    details: { path: ["limit"] },
  });
  const client = createClient({ baseUrl: server.origin });
  await assert.rejects(client.read("/api/table", {} as never), { code: "validation" });
  assert.throws(() => client.read("/api/entities", { limit: Number.NaN }), { code: "validation" });
  assert.equal(transactions, 0);
});
