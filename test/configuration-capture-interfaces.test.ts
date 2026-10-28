import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { decodeRead, decodeWrite } from "../src/interfaces/api-endpoints.ts";
import {
  configurationCaptureFixture,
  configurationActor as actor,
} from "./configuration-capture-fixture.ts";

test("exact configuration HTTP response loss and restart recover through read, identical intent and CLI without duplicate capture", async () => {
  const f = await configurationCaptureFixture();
  let server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor }),
    posts = 0;
  try {
    const input = await f.input(),
      client = createClient({
        baseUrl: server.origin,
        require: { features: ["exact-configuration-captures"] },
        fetch: async (...args) => {
          const response = await fetch(...args);
          if (args[1]?.method === "POST") {
            posts++;
            assert.equal(response.status, 200);
            throw Error("Lost committed capture response");
          }
          return response;
        },
      });
    await client.connect();
    assert.deepEqual(
      await client.read("/api/configuration-capture-context", {}),
      await f.tracer.configurations.captureContext(),
    );
    await assert.rejects(client.write("/api/configuration-captures", input), {
      code: "outcome_unknown",
    });
    assert.equal(posts, 1);
    const saved = await f.tracer.configurations.get(input.id);
    assert.equal((await f.tracer.configurations.list()).items.length, 1);
    await server.close();
    f.reopen();
    server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
    const fresh = createClient({ baseUrl: server.origin });
    await fresh.connect();
    const before = await f.tracer.exportProject();
    assert.deepEqual(await fresh.read("/api/configuration", { id: input.id }), saved);
    assert.deepEqual(await fresh.write("/api/configuration-captures", input), saved);
    assert.deepEqual((await fresh.read("/api/configurations", { subject: f.root.id })).items, [
      saved,
    ]);
    const command = spawnSync(
      process.execPath,
      [
        "src/interfaces/cli.ts",
        "--db",
        f.database,
        "--actor",
        actor.actor,
        "--reason",
        actor.reason,
        "configuration",
        "capture-exact",
        JSON.stringify(input),
      ],
      { encoding: "utf8" },
    );
    assert.equal(command.status, 0, command.stderr);
    assert.deepEqual(JSON.parse(command.stdout), saved);
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    await server.close();
    f.close();
  }
});

test("configuration wire rejects missing control, mismatched intent/clocks/content and cross-request identities while retaining legacy reads", async () => {
  const f = await configurationCaptureFixture();
  try {
    const input = await f.input(),
      saved = await f.tracer.configurations.captureExact(input, actor);
    assert.deepEqual(decodeWrite("/api/configuration-captures", saved, input), saved);
    const altered = structuredClone(saved);
    altered.capture!.context.evidenceRevision++;
    assert.throws(() => decodeRead("/api/configuration", { id: saved.id }, altered));
    const wrongObservation = structuredClone(saved);
    wrongObservation.capture!.content[0].observation!.entityId = f.part.id;
    assert.throws(() => decodeWrite("/api/configuration-captures", wrongObservation, input));
    assert.throws(() =>
      decodeWrite("/api/configuration-captures", saved, {
        ...input,
        name: "Different original request",
      }),
    );
    assert.throws(() => decodeRead("/api/configuration", { id: "another" }, saved));
    const legacy = await f.tracer.configurations.capture(
      {
        name: "Legacy native capture",
        subjectId: f.root.id,
        expectedSubjectVersion: 1,
        members: [{ entityId: f.root.id, version: 1 }],
      },
      actor,
    );
    assert.deepEqual(decodeRead("/api/configuration", { id: legacy.id }, legacy), legacy);
    assert.throws(() => decodeWrite("/api/configuration-captures", legacy, input));
  } finally {
    f.close();
  }
});
