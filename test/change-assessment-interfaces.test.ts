import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { applicationModelFixture, assessmentOpenRequest } from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";

test("headless assessment opening recovers lost response after reopen and CLI exact repeat", async () => {
  const f = await applicationModelFixture("research");
  let server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
  let writes = 0;
  try {
    const request = await assessmentOpenRequest(f);
    const client = createClient({
      baseUrl: server.origin,
      require: { features: ["change-assessment-opening"] },
      fetch: async (...args) => {
        const response = await fetch(...args);
        if (String(args[0]).endsWith("/api/change-assessments/open")) {
          writes++;
          assert.equal(response.status, 200);
          throw Error("Lost committed response");
        }
        return response;
      },
    });
    await client.checkCompatibility();
    await client.connect();
    await assert.rejects(client.write("/api/change-assessments/open", request), {
      code: "outcome_unknown",
    });
    assert.equal(writes, 1);
    const saved = await f.tracer.exportProject();
    await server.close();
    f.base.reopen();
    server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
    const recoveredClient = createClient({ baseUrl: server.origin });
    await recoveredClient.connect();
    const recovered = await recoveredClient.read("/api/evaluation-outcome", {
      commandId: request.commandId,
    });
    assert.ok(recovered);
    assert.deepEqual(
      await recoveredClient.write("/api/change-assessments/open", request),
      recovered,
    );
    const cli = spawnSync(
      process.execPath,
      [
        "src/interfaces/cli.ts",
        "--db",
        f.database,
        "--actor",
        actor.actor,
        "--reason",
        actor.reason,
        "assessment",
        "open",
        JSON.stringify(request),
      ],
      { encoding: "utf8" },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), recovered);
    await assert.rejects(
      recoveredClient.write("/api/change-assessments/open", {
        ...request,
        query: { ...request.query, after: "partial-page" },
      } as never),
      { code: "validation" },
    );
    assert.deepEqual(await f.tracer.exportProject(), saved);
    let corruptWrites = 0;
    const corrupt = createClient({
      baseUrl: server.origin,
      fetch: async (...args) => {
        if (String(args[0]).endsWith("/api/change-assessments/open")) {
          corruptWrites++;
          return Response.json({
            ...recovered,
            receipt: {
              ...recovered.receipt,
              output: { ...recovered.receipt.output, id: crypto.randomUUID() },
            },
          });
        }
        return fetch(...args);
      },
    });
    await corrupt.connect();
    await assert.rejects(corrupt.write("/api/change-assessments/open", request), {
      code: "outcome_unknown",
    });
    assert.equal(corruptWrites, 1);
  } finally {
    await server.close();
    f.close();
  }
});
