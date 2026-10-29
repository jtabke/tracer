import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { decodeWrite, decodeRead } from "../src/interfaces/api-endpoints.ts";
import { pairVerificationFixture, performTargetVerification } from "./pair-verification-fixture.ts";
import { assessmentCommand, dispositionProposal } from "./application-model-fixture.ts";
import { verificationActor as actor } from "./verification-fixture.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: pair source and target-qualified judgment recover through typed HTTP, restart and exact CLI replay`, async () => {
    const x = await pairVerificationFixture(domain),
      { f } = x;
    let server;
    try {
      const verified = await performTargetVerification(x);
      server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
      const client = createClient({
        baseUrl: server.origin,
        require: { features: ["configuration-pair-assessments"] },
      });
      await client.connect();
      const original = await f.tracer.changeAssessments.open(x.opening, actor);
      assert.deepEqual(await client.write("/api/change-assessments/open", x.opening), original);
      assert.deepEqual(
        await client.read("/api/change-assessment", x.assessment),
        await f.tracer.changeAssessments.get(x.assessment),
      );
      assert.throws(() =>
        decodeWrite("/api/change-assessments/open", original, {
          ...x.opening,
          query: { ...x.opening.query, rootId: "other-root" },
        }),
      );
      const subject = { kind: "entity" as const, id: f.requirement.id };
      const request = await dispositionProposal(f, x.assessment, subject);
      request.decision = "reverify";
      request.actions = [
        {
          id: "performed-target-proof",
          kind: "reverify",
          title: "Perform target verification",
          state: "done",
          resolution: "Complete applicable verification for the exact selected after state",
          support: [
            {
              kind: "receipt",
              id: verified.conclusion.receipt.id,
              mode: "configuration",
              configurationId: x.after.id,
            },
          ],
        },
      ];
      let lost = 0;
      const uncertain = createClient({
        baseUrl: server.origin,
        fetch: async (...args) => {
          const response = await fetch(...args);
          if (String(args[0]).endsWith("/api/change-assessments/disposition")) {
            assert.equal(response.status, 200);
            lost++;
            throw Error("Lost committed response");
          }
          return response;
        },
      });
      await uncertain.connect();
      await assert.rejects(uncertain.write("/api/change-assessments/disposition", request), {
        code: "outcome_unknown",
      });
      assert.equal(lost, 1);
      await server.close();
      f.reopen();
      server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
      const resumed = createClient({ baseUrl: server.origin });
      await resumed.connect();
      const outcome = await resumed.read("/api/evaluation-outcome", {
        commandId: request.commandId,
      });
      assert.ok(outcome);
      assert.deepEqual(
        await resumed.write("/api/change-assessments/disposition", request),
        outcome,
      );
      const detail = await resumed.read("/api/assessment-disposition", {
        ...x.assessment,
        ...subject,
      });
      assert.ok(detail);
      assert.equal(detail.data.basis.version, 2);
      assert.equal(detail.data.actionSupport[0].support[0].applicability, "applicable");
      const invalid = structuredClone(detail);
      invalid.data.actionSupport[0].support[0].reference = {
        kind: "receipt",
        id: verified.conclusion.receipt.id,
        mode: "configuration",
        configurationId: x.before.id,
      };
      assert.throws(() =>
        decodeRead("/api/assessment-disposition", { ...x.assessment, ...subject }, invalid),
      );
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
          { encoding: "utf8", maxBuffer: 2097152 },
        );
      const repeated = invoke("set-disposition", JSON.stringify(request));
      assert.equal(repeated.status, 0, repeated.stderr);
      assert.deepEqual(JSON.parse(repeated.stdout), outcome);
      const analysis = await resumed.read("/api/assessment-analysis", x.assessment);
      for (const obligation of analysis.obligations)
        if (obligation.subject.id !== subject.id)
          await resumed.write(
            "/api/change-assessments/disposition",
            await dispositionProposal(f, x.assessment, obligation.subject),
          );
      const closing = await assessmentCommand(f, x.assessment),
        closed = await resumed.write("/api/change-assessments/close", closing);
      assert.equal(
        (await resumed.read("/api/assessment-analysis", x.assessment)).completion.state,
        "completed",
      );
      const snapshot = await f.tracer.exportProject();
      const cli = invoke("close", JSON.stringify(closing));
      assert.equal(cli.status, 0, cli.stderr);
      assert.deepEqual(JSON.parse(cli.stdout), closed);
      const read = invoke("analyze", JSON.stringify(x.assessment));
      assert.equal(read.status, 0, read.stderr);
      assert.deepEqual(
        JSON.parse(read.stdout),
        await resumed.read("/api/assessment-analysis", x.assessment),
      );
      await assert.rejects(
        resumed.write("/api/change-assessments/disposition", {
          ...request,
          rationale: "Changed original intent",
        }),
        { code: "conflict" },
      );
      assert.deepEqual(await f.tracer.exportProject(), snapshot);
    } finally {
      await server?.close();
      f.close();
    }
  });
