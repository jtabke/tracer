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
  verificationMutation,
  verificationResults,
  verificationActor as actor,
} from "./verification-fixture.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: verification lifecycle shares HTTP/CLI reads, exact recovery and typed conclusions`, async () => {
    const f = await verificationFixture(domain);
    let server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
    let sent = 0;
    try {
      const opening = await verificationOpening(f);
      await f.tracer.verification.open(opening, actor);
      const s = { caseId: opening.caseId, openingCommandId: opening.commandId },
        run = await verificationExecution(f, s);
      await f.tracer.verification.recordExecution(run, actor);
      const client = createClient({
        baseUrl: server.origin,
        require: { features: ["verification-results"] },
      });
      await client.connect();
      const selected = await verificationResults(f, s, run.executionId),
        result = await client.write("/api/verifications/select", selected);
      assert.deepEqual(result, await f.tracer.evaluations.getOutcome(selected.commandId));
      assert.deepEqual(
        await client.read("/api/verification-analysis", s),
        await f.tracer.verification.analyze(s),
      );
      const close = await verificationMutation(f, s),
        lossy = createClient({
          baseUrl: server.origin,
          fetch: async (...args) => {
            const response = await fetch(...args);
            if (args[1]?.method === "POST") {
              sent++;
              assert.equal(response.status, 200);
              throw Error("Lost committed conclusion");
            }
            return response;
          },
        });
      await lossy.connect();
      await assert.rejects(lossy.write("/api/verifications/conclude", close), {
        code: "outcome_unknown",
      });
      assert.equal(sent, 1);
      const conclusion = await f.tracer.evaluations.getOutcome(close.commandId);
      assert.ok(conclusion);
      await server.close();
      f.reopen();
      server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
      const fresh = createClient({ baseUrl: server.origin });
      await fresh.connect();
      const saved = await f.tracer.exportProject();
      assert.deepEqual(await fresh.write("/api/verifications/conclude", close), conclusion);
      assert.equal(
        (await fresh.read("/api/verification-case", s)).case.state,
        f.definition.states.closed,
      );
      const a = await fresh.read("/api/verification-analysis", s);
      assert.equal(a.completion.state, "verified");
      const cli = (operation: string, input: unknown) => {
        const r = spawnSync(
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
        assert.equal(r.status, 0, r.stderr);
        return JSON.parse(r.stdout);
      };
      assert.deepEqual(cli("analyze", s), a);
      assert.deepEqual(cli("select", selected), result);
      assert.deepEqual(cli("conclude", close), conclusion);
      assert.deepEqual(await f.tracer.exportProject(), saved);
      const reopen = await verificationMutation(f, s),
        reopened = await fresh.write("/api/verifications/reopen", reopen);
      assert.deepEqual(cli("reopen", reopen), reopened);
      const revision = {
        ...(await verificationMutation(f, s)),
        basis: f.input,
        mapping: f.input.criteria.map((c) => ({ fromId: c.id, toId: c.id })),
      };
      const revised = await fresh.write("/api/verifications/revise", revision);
      assert.deepEqual(cli("revise-basis", revision), revised);
      assert.equal((await fresh.read("/api/verification-analysis", s)).selection.state, "none");
    } finally {
      await server.close();
      f.close();
    }
  });

test("verification lifecycle response contracts reject mismatched populations, clocks, conclusions and requested selections", async () => {
  const f = await verificationFixture();
  try {
    const opening = await verificationOpening(f);
    await f.tracer.verification.open(opening, actor);
    const s = { caseId: opening.caseId, openingCommandId: opening.commandId };
    const run = await verificationExecution(f, s);
    await f.tracer.verification.recordExecution(run, actor);
    const choice = await verificationResults(f, s, run.executionId),
      selected = await f.tracer.verification.selectResults(choice, actor);
    const changed = structuredClone(choice);
    changed.accounting[0].rationale = "Different requested judgment";
    assert.throws(() => decodeWrite("/api/verifications/select", selected, changed));
    const a = await f.tracer.verification.analyze(s);
    for (const edit of [
      (x: typeof a) => x.executions.pop(),
      (x: typeof a) => x.obligations.pop(),
      (x: typeof a) => (x.ready = false),
      (x: typeof a) => (x.completion.state = "verified"),
    ]) {
      const bad = structuredClone(a);
      edit(bad);
      assert.throws(() => decodeRead("/api/verification-analysis", s, bad));
    }
    const close = await verificationMutation(f, s),
      concluded = await f.tracer.verification.conclude(close, actor);
    assert.throws(() =>
      decodeWrite("/api/verifications/conclude", concluded, {
        ...close,
        expectedCaseVersion: close.expectedCaseVersion + 1,
      }),
    );
    const closed = await f.tracer.verification.analyze(s),
      bad = structuredClone(closed);
    bad.completion.receiptId = "unrelated";
    assert.throws(() => decodeRead("/api/verification-analysis", s, bad));
  } finally {
    f.close();
  }
});
