import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import {
  applicationModelFixture,
  assessmentOpenRequest,
  assessmentCommand as command,
  dispositionProposal as proposal,
} from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: headless judgment and closure recover lost responses and share CLI/read/reopen semantics`, async () => {
    const f = await applicationModelFixture(domain);
    let server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
    let lost = 0;
    const interrupted = (path: string) =>
      createClient({
        baseUrl: server.origin,
        require: { features: ["change-assessment-dispositions", "change-assessment-closure"] },
        fetch: async (...args) => {
          const response = await fetch(...args);
          if (String(args[0]).endsWith(path)) {
            lost++;
            assert.equal(response.status, 200);
            throw Error("Lost committed application response");
          }
          return response;
        },
      });
    try {
      const opening = await assessmentOpenRequest(f);
      await f.tracer.changeAssessments.open(opening, actor);
      const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId },
        subject = { kind: "entity" as const, id: f.criterion.id };
      const write = interrupted("/api/change-assessments/disposition");
      await write.checkCompatibility();
      await write.connect();
      const before = await write.read("/api/assessment-analysis", selection);
      assert.equal(before.obligations[0].state, "undisposed");
      const request = await proposal(f, selection, subject);
      await assert.rejects(write.write("/api/change-assessments/disposition", request), {
        code: "outcome_unknown",
      });
      assert.equal(lost, 1);
      await server.close();
      f.base.reopen();
      server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
      const client = createClient({ baseUrl: server.origin });
      await client.connect();
      const outcome = await client.read("/api/evaluation-outcome", {
        commandId: request.commandId,
      });
      assert.ok(outcome);
      assert.deepEqual(await client.write("/api/change-assessments/disposition", request), outcome);
      const detail = await client.read("/api/assessment-disposition", { ...selection, ...subject });
      assert.ok(detail);
      assert.equal(detail.decision, "no_action");
      assert.equal(
        (await client.read("/api/assessment-analysis", selection)).obligations[0].state,
        "accounted",
      );
      const closing = await command(f, selection),
        closeClient = interrupted("/api/change-assessments/close");
      await closeClient.connect();
      await assert.rejects(closeClient.write("/api/change-assessments/close", closing), {
        code: "outcome_unknown",
      });
      assert.equal(lost, 2);
      const closed = await client.read("/api/evaluation-outcome", { commandId: closing.commandId });
      assert.ok(closed);
      const saved = await f.tracer.exportProject();
      const view = await client.read("/api/change-assessment", selection);
      assert.equal(view.assessment.state, f.definition.states.closed);
      const analysis = await client.read("/api/assessment-analysis", selection);
      assert.equal(analysis.completion.state, "completed");
      assert.equal(analysis.completion.receiptId, closed.receipt.id);
      const invoke = (...args: string[]) =>
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
            ...args,
          ],
          { encoding: "utf8" },
        );
      const repeated = invoke("close", JSON.stringify(closing));
      assert.equal(repeated.status, 0, repeated.stderr);
      assert.deepEqual(JSON.parse(repeated.stdout), closed);
      const read = invoke("analyze", JSON.stringify(selection));
      assert.equal(read.status, 0, read.stderr);
      assert.deepEqual(JSON.parse(read.stdout), analysis);
      const readDetail = invoke("disposition", JSON.stringify({ ...selection, subject }));
      assert.equal(readDetail.status, 0, readDetail.stderr);
      assert.deepEqual(JSON.parse(readDetail.stdout), detail);
      await assert.rejects(
        client.write("/api/change-assessments/close", { ...closing, reason: "Different intent" }),
        { code: "conflict" },
      );
      await assert.rejects(
        client.write("/api/change-assessments/disposition", {
          ...request,
          approved: true,
        } as never),
        { code: "validation" },
      );
      assert.deepEqual(await f.tracer.exportProject(), saved);
      for (const value of [
        { ...analysis, obligations: [] },
        { ...analysis, completion: { state: "open", receiptId: null } },
        {
          ...analysis,
          obligations: analysis.obligations.map((item) => ({
            ...item,
            state: "accounted",
            openActions: 1,
          })),
        },
        {
          ...analysis,
          view: { ...analysis.view, opening: { ...analysis.view.opening, commandId: "other" } },
        },
        {
          ...analysis,
          obligations: analysis.obligations.map((item) => ({ ...item, currentDigest: "invalid" })),
        },
      ]) {
        const corrupt = createClient({ fetch: async () => Response.json(value) });
        await assert.rejects(corrupt.read("/api/assessment-analysis", selection), {
          code: "read_failed",
        });
      }
      const corrupt = createClient({
        fetch: async () =>
          Response.json({
            ...detail,
            data: { ...detail.data, subject: { kind: "entity", id: "other" } },
          }),
      });
      await assert.rejects(
        corrupt.read("/api/assessment-disposition", { ...selection, ...subject }),
        { code: "read_failed" },
      );
      await client.write("/api/change-assessments/reopen", await command(f, selection));
      assert.equal(
        (await client.read("/api/assessment-analysis", selection)).completion.state,
        "open",
      );
      assert.deepEqual(
        await client.read("/api/evaluation-outcome", { commandId: closing.commandId }),
        closed,
      );
    } finally {
      await server.close();
      f.close();
    }
  });
