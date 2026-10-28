import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { applicationModelFixture } from "./application-model-fixture.ts";

test("headless and CLI resolve the same exact application model without writes or automatic selection", async () => {
  const f = await applicationModelFixture("research"),
    server = await startHeadlessServer(f.tracer, { port: 0 });
  try {
    const before = await f.tracer.exportProject(),
      client = createClient({
        baseUrl: server.origin,
        require: { features: ["pinned-application-models"] },
      });
    await client.checkCompatibility();
    const result = await client.read("/api/application-model", f.pin);
    assert.deepEqual(result, await f.tracer.applicationModels.resolve(f.pin));
    const cli = spawnSync(
      process.execPath,
      [
        "src/interfaces/cli.ts",
        "--db",
        f.database,
        "application-model",
        "resolve",
        JSON.stringify(f.pin),
      ],
      { encoding: "utf8" },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), result);
    assert.throws(
      () => client.read("/api/application-model", { ...f.pin, actor: "forged" } as never),
      { code: "validation" },
    );
    const noVersion = await fetch(
      server.origin + "/api/application-model?entityId=" + f.pin.entityId + "&field=" + f.pin.field,
    );
    assert.equal(noVersion.status, 400);
    assert.deepEqual(await f.tracer.exportProject(), before);
    const changed = structuredClone(f.schema);
    delete changed.relationshipTypes[f.definition.relationships.member];
    delete changed.entityTypes[f.definition.assessment.type];
    delete changed.entityTypes[f.definition.disposition.type];
    await f.tracer.setSchema(changed, 2, { actor: "model-interface-test" });
    const state = await f.tracer.exportProject();
    const incompatible = await client.read("/api/application-model", f.pin);
    assert.equal(incompatible.compatibility.writable, false);
    assert.equal(incompatible.requiredFields.assessment, null);
    assert.equal(incompatible.requiredFields.disposition, null);
    assert.deepEqual(incompatible.definition, result.definition);
    assert.deepEqual(await f.tracer.exportProject(), state);
  } finally {
    await server.close();
    f.close();
  }
});

test("typed model decoding rejects mismatched identity, false compatibility and malformed metadata", async () => {
  const f = await applicationModelFixture();
  try {
    const good = await f.tracer.applicationModels.resolve(f.pin);
    const candidates = [
      { ...good, pin: { ...good.pin, version: 2 } },
      { ...good, pin: { ...good.pin, field: "other" } },
      { ...good, source: { ...good.source, type: "x".repeat(131072) } },
      { ...good, source: { ...good.source, id: crypto.randomUUID() } },
      { ...good, source: { ...good.source, currentVersion: 0 } },
      { ...good, pinnedSchemaVersion: good.context.schemaVersion + 1 },
      { ...good, compatibility: { writable: false, issues: [] } },
      { ...good, requiredFields: { ...good.requiredFields, assessment: null } },
      {
        ...good,
        requiredFields: {
          ...good.requiredFields,
          assessment: { owner: { type: "string", required: false } },
        },
      },
      { ...good, definition: { ...good.definition, policy: { allowUnknown: "yes" } } },
      {
        ...good,
        compatibility: { writable: false, issues: [{ path: [], message: "unknown scope" }] },
      },
    ];
    for (const candidate of candidates) {
      let requests = 0;
      const client = createClient({
        fetch: async () => {
          requests++;
          return new Response(JSON.stringify(candidate), { status: 200 });
        },
      });
      await assert.rejects(client.read("/api/application-model", f.pin), { code: "read_failed" });
      assert.equal(requests, 1);
    }
  } finally {
    f.close();
  }
});
