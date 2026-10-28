import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { applicationModelFixture, assessmentOpenRequest } from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";
import type { RefreshChangeAssessment } from "../src/core/change-assessment.ts";

test("headless refresh preserves original intent through lost response, reopen, get and CLI repeat", async () => {
  const f = await applicationModelFixture("research");
  let server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
  try {
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    let writes = 0;
    const client = createClient({
      baseUrl: server.origin,
      require: { features: ["change-assessment-scope-refresh"] },
      fetch: async (...args) => {
        const response = await fetch(...args);
        if (String(args[0]).endsWith("/api/change-assessments/refresh")) {
          writes++;
          assert.equal(response.status, 200);
          throw Error("Lost committed refresh response");
        }
        return response;
      },
    });
    await client.checkCompatibility();
    await client.connect();
    const view = await client.read("/api/change-assessment", selection);
    const request: RefreshChangeAssessment = {
      ...selection,
      commandId: "headless-refresh",
      expectedSchemaVersion: view.model.context.schemaVersion,
      expectedProjectRevision: view.model.context.projectRevision,
      expectedEvidenceRevision: view.model.context.evidenceRevision,
      expectedAssessmentVersion: view.assessment.version,
      reason: "Synthetic explicit headless rediscovery",
    };
    await assert.rejects(client.write("/api/change-assessments/refresh", request), {
      code: "outcome_unknown",
    });
    assert.equal(writes, 1);
    const saved = await f.tracer.exportProject();
    await server.close();
    f.base.reopen();
    server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
    const recovery = createClient({ baseUrl: server.origin });
    await recovery.connect();
    const outcome = await recovery.read("/api/evaluation-outcome", {
      commandId: request.commandId,
    });
    assert.ok(outcome);
    assert.deepEqual(await recovery.write("/api/change-assessments/refresh", request), outcome);
    const cli = (...command: string[]) =>
      spawnSync(
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
          ...command,
        ],
        { encoding: "utf8" },
      );
    const repeated = cli("refresh", JSON.stringify(request));
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.deepEqual(JSON.parse(repeated.stdout), outcome);
    const current = await recovery.read("/api/change-assessment", selection),
      read = cli("get", JSON.stringify(selection));
    assert.equal(read.status, 0, read.stderr);
    assert.deepEqual(JSON.parse(read.stdout), current);
    assert.equal(current.control.assessmentVersion, 2);
    await assert.rejects(
      recovery.write("/api/change-assessments/refresh", { ...request, reason: "Different intent" }),
      { code: "conflict" },
    );
    await assert.rejects(
      recovery.write("/api/change-assessments/refresh", {
        ...request,
        query: { rootId: "forged" },
      } as never),
      { code: "validation" },
    );
    assert.deepEqual(await f.tracer.exportProject(), saved);
    const corruptions = [
      { ...current, opening: { ...current.opening, commandId: "wrong" } },
      { ...current, control: { ...current.control, assessmentVersion: 99 } },
      {
        ...current,
        scope: { ...current.scope, discovery: { ...current.scope.discovery, complete: false } },
      },
      {
        ...current,
        model: { ...current.model, context: { ...current.model.context, evidenceRevision: 0 } },
      },
      { ...current, scope: { ...current.scope, purpose: "x".repeat(262144) } },
    ];
    for (const value of corruptions) {
      const corrupt = createClient({ fetch: async () => Response.json(value) });
      await assert.rejects(corrupt.read("/api/change-assessment", selection), {
        code: "read_failed",
      });
    }
  } finally {
    await server.close();
    f.close();
  }
});
