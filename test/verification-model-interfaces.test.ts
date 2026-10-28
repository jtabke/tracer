import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { decodeRead } from "../src/interfaces/api-endpoints.ts";
import { verificationFixture } from "./verification-fixture.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: pinned verification model reads agree through core, typed HTTP, CLI and restart`, async () => {
    const f = await verificationFixture(domain);
    let server = await startHeadlessServer(f.tracer, { port: 0 });
    try {
      const before = await f.tracer.exportProject(),
        expected = await f.tracer.verification.resolveModel(f.input.model);
      const client = createClient({
        baseUrl: server.origin,
        require: { features: ["verification-models"] },
      });
      const capabilities = await client.checkCompatibility();
      assert.ok(capabilities.operations.some((x) => x.path === "/api/verification-model"));
      assert.deepEqual(await client.read("/api/verification-model", f.input.model), expected);
      const cli = (operation: string, input: unknown) => {
        const result = spawnSync(
          process.execPath,
          [
            "src/interfaces/cli.ts",
            "--db",
            f.database,
            "verification",
            operation,
            JSON.stringify(input),
          ],
          { encoding: "utf8" },
        );
        assert.equal(result.status, 0, result.stderr);
        return JSON.parse(result.stdout);
      };
      assert.deepEqual(cli("resolve-model", f.input.model), expected);
      assert.deepEqual(
        cli("prepare-basis", f.input),
        await f.tracer.verification.prepareBasis(f.input),
      );
      assert.deepEqual(await f.tracer.exportProject(), before);
      await server.close();
      f.reopen();
      server = await startHeadlessServer(f.tracer, { port: 0 });
      assert.deepEqual(
        await createClient({ baseUrl: server.origin }).read(
          "/api/verification-model",
          f.input.model,
        ),
        expected,
      );
      assert.deepEqual(await f.tracer.exportProject(), before);
    } finally {
      await server.close();
      f.close();
    }
  });

test("verification model response rejects false correlation, compatibility and partial required metadata", async () => {
  const f = await verificationFixture();
  try {
    const result = await f.tracer.verification.resolveModel(f.input.model);
    const wrongPin = structuredClone(result);
    wrongPin.pin.entityId = "another";
    const wrongSource = structuredClone(result);
    wrongSource.source.version++;
    const wrongContext = structuredClone(result);
    wrongContext.context.schemaVersion = 0;
    const missingMetadata = structuredClone(result);
    missingMetadata.requiredFields.execution = null;
    const falseCompatibility = structuredClone(result);
    falseCompatibility.compatibility.writable = false;
    const invalidModel = structuredClone(result);
    invalidModel.definition.outcomes.failed = invalidModel.definition.outcomes.passed;
    for (const value of [
      wrongPin,
      wrongSource,
      wrongContext,
      missingMetadata,
      falseCompatibility,
      invalidModel,
    ])
      assert.throws(() => decodeRead("/api/verification-model", f.input.model, value));
  } finally {
    f.close();
  }
});
