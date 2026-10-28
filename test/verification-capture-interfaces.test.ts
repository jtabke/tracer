import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { decodeRead, decodeWrite } from "../src/interfaces/api-endpoints.ts";
import {
  verificationFixture,
  verificationOpening,
  verificationExecution,
  verificationActor as actor,
} from "./verification-fixture.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: verification opening and execution recover lost HTTP responses and exact CLI intent after restart`, async () => {
    const f = await verificationFixture(domain);
    let server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
    let sent = 0;
    const lossy = () =>
      createClient({
        baseUrl: server.origin,
        require: { features: ["verification-cases", "verification-executions"] },
        fetch: async (...args) => {
          const response = await fetch(...args);
          if (args[1]?.method === "POST") {
            sent++;
            assert.equal(response.status, 200);
            throw Error("Lost committed verification response");
          }
          return response;
        },
      });
    try {
      const opening = await verificationOpening(f),
        writer = lossy();
      await writer.connect();
      await assert.rejects(writer.write("/api/verifications/open", opening), {
        code: "outcome_unknown",
      });
      assert.equal(sent, 1);
      const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
        opened = await f.tracer.evaluations.getOutcome(opening.commandId);
      assert.ok(opened);
      const client = createClient({ baseUrl: server.origin });
      await client.connect();
      assert.deepEqual(await client.write("/api/verifications/open", opening), opened);
      assert.deepEqual(
        await client.read("/api/verification-case", selection),
        await f.tracer.verification.get(selection),
      );
      assert.deepEqual(
        await client.read("/api/verification-case-locate", { caseId: opening.caseId }),
        await f.tracer.verification.get(selection),
      );
      const request = await verificationExecution(f, selection),
        executionWriter = lossy();
      await executionWriter.connect();
      await assert.rejects(executionWriter.write("/api/verifications/execute", request), {
        code: "outcome_unknown",
      });
      assert.equal(sent, 2);
      const recorded = await f.tracer.evaluations.getOutcome(request.commandId);
      assert.ok(recorded);
      await server.close();
      f.reopen();
      server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
      const fresh = createClient({ baseUrl: server.origin });
      await fresh.connect();
      const before = await f.tracer.exportProject();
      assert.deepEqual(await fresh.write("/api/verifications/execute", request), recorded);
      const detail = await fresh.read("/api/verification-execution", {
        ...selection,
        executionId: request.executionId,
      });
      assert.equal(detail.data.results.length, 2);
      assert.equal(detail.comparison.record.state, "current");
      const cli = (operation: string, input: unknown) => {
        const result = spawnSync(
          process.execPath,
          [
            "src/interfaces/cli.ts",
            "--db",
            f.database,
            "--actor",
            actor.actor,
            "--reason",
            actor.reason,
            "verification",
            operation,
            JSON.stringify(input),
          ],
          { encoding: "utf8" },
        );
        assert.equal(result.status, 0, result.stderr);
        return JSON.parse(result.stdout);
      };
      assert.deepEqual(cli("open", opening), opened);
      assert.deepEqual(cli("record-execution", request), recorded);
      assert.deepEqual(cli("get", selection), await f.tracer.verification.get(selection));
      assert.deepEqual(
        cli("execution", { ...selection, executionId: request.executionId }),
        detail,
      );
      assert.deepEqual(await f.tracer.exportProject(), before);
    } finally {
      await server.close();
      f.close();
    }
  });

test("verification wire decoders reject altered control, membership, input states and typed criterion results", async () => {
  const f = await verificationFixture();
  try {
    const opening = await verificationOpening(f),
      opened = await f.tracer.verification.open(opening, actor),
      selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
    const falseOpening = structuredClone(opened);
    falseOpening.native!.results.pop();
    assert.throws(() => decodeWrite("/api/verifications/open", falseOpening, opening));
    const view = await f.tracer.verification.get(selection),
      wrongControl = structuredClone(view);
    wrongControl.control.commandId = "another";
    assert.throws(() => decodeRead("/api/verification-case", selection, wrongControl));
    const request = await verificationExecution(f, selection),
      recorded = await f.tracer.verification.recordExecution(request, actor),
      wrongResult = structuredClone(recorded);
    const data = wrongResult.receipt.output.fields[f.definition.execution.fields.data] as {
      results: { outcome: string }[];
    };
    data.results[0].outcome = "failed";
    assert.throws(() => decodeWrite("/api/verifications/execute", wrongResult, request));
    const detail = await f.tracer.verification.execution(selection, request.executionId),
      falseState = structuredClone(detail);
    falseState.comparison.record.hasUnknown = true;
    assert.throws(() =>
      decodeRead(
        "/api/verification-execution",
        { ...selection, executionId: request.executionId },
        falseState,
      ),
    );
  } finally {
    f.close();
  }
});
