import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { createClient } from "../src/client.ts";
import { evaluationFixture, evaluationActor as actor } from "./evaluation-fixture.ts";

test("typed headless evaluation survives response loss, restart, explicit lookup and exact repeat without another write", async () => {
  const f = await evaluationFixture();
  let server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
  let writes = 0;
  f.command.expectedEvidenceRevision = await f.repository.transaction((tx) =>
    tx.impactEvidenceRevision(),
  );
  try {
    const interrupted = createClient({
      baseUrl: server.origin,
      require: { features: ["atomic-evaluation-commands", "evidence-revision-guards"] },
      fetch: async (...args) => {
        const response = await fetch(...args);
        if (String(args[0]).endsWith("/api/evaluation-commands")) {
          writes++;
          assert.equal(response.status, 200);
          throw Error("Lost committed response");
        }
        return response;
      },
    });
    await interrupted.checkCompatibility();
    await interrupted.connect();
    await assert.rejects(interrupted.write("/api/evaluation-commands", f.command), {
      code: "outcome_unknown",
    });
    assert.equal(writes, 1);
    const saved = await f.tracer.exportProject();
    assert.equal(saved.evidence.receipts.length, 1);
    await server.close();
    f.reopen();
    server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
    const client = createClient({ baseUrl: server.origin });
    await client.connect();
    const recovered = await client.read("/api/evaluation-outcome", {
      commandId: f.command.commandId,
    });
    assert.ok(recovered);
    assert.deepEqual(await client.write("/api/evaluation-commands", f.command), recovered);
    assert.deepEqual(
      await client.read("/api/receipt", { receiptId: recovered.receipt.id }),
      recovered.receipt,
    );
    assert.deepEqual(await f.tracer.exportProject(), saved);
    assert.equal((await fetch(server.origin + "/")).status, 404);
  } finally {
    await server.close();
    f.close();
  }
});

test("evaluation transport rejects malformed provenance and wrong result identity without retry or inferred success", async () => {
  const f = await evaluationFixture(),
    server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
  let writes = 0;
  try {
    const before = await f.tracer.exportProject(),
      client = createClient({ baseUrl: server.origin });
    await client.connect();
    await assert.rejects(
      client.write("/api/evaluation-commands", { ...f.command, actor: "forged" } as never),
      { code: "validation" },
    );
    await assert.rejects(
      client.write("/api/evaluation-commands", {
        ...f.command,
        receipt: { ...f.command.receipt, locator: { system: "file", path: "/unrequested" } },
      } as never),
      { code: "validation" },
    );
    assert.throws(
      () =>
        client.read("/api/evaluation-outcome", {
          commandId: f.command.commandId,
          extra: true,
        } as never),
      { code: "validation" },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
    const corrupt = createClient({
      baseUrl: server.origin,
      fetch: async (...args) => {
        const response = await fetch(...args);
        if (String(args[0]).endsWith("/api/evaluation-commands")) {
          writes++;
          const result = await response.json();
          return new Response(JSON.stringify({ ...result, commandId: "wrong-command" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return response;
      },
    });
    await corrupt.connect();
    await assert.rejects(corrupt.write("/api/evaluation-commands", f.command), {
      code: "outcome_unknown",
    });
    assert.equal(writes, 1);
    const recovered = await client.read("/api/evaluation-outcome", {
      commandId: f.command.commandId,
    });
    assert.ok(recovered);
    const wrongRead = createClient({
      baseUrl: server.origin,
      fetch: async () =>
        new Response(JSON.stringify({ ...recovered, commandId: "wrong-command" }), { status: 200 }),
    });
    await assert.rejects(
      wrongRead.read("/api/evaluation-outcome", { commandId: f.command.commandId }),
      { code: "read_failed" },
    );
    assert.equal((await f.tracer.exportProject()).evidence.receipts.length, 1);
  } finally {
    await server.close();
    f.close();
  }
});

test("CLI records and recovers the same research application operation across processes", async () => {
  const f = await evaluationFixture("research");
  try {
    const invoke = (...tokens: string[]) => {
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
          ...tokens,
        ],
        { encoding: "utf8" },
      );
      return { ...r, value: r.status === 0 ? JSON.parse(r.stdout) : undefined };
    };
    f.command.expectedEvidenceRevision = await f.repository.transaction((tx) =>
      tx.impactEvidenceRevision(),
    );
    const rejected = invoke(
      "evaluation",
      "commit",
      JSON.stringify({ ...f.command, expectedEvidenceRevision: 0 }),
    );
    assert.equal(rejected.status, 1);
    assert.equal(JSON.parse(rejected.stderr).error, "conflict");
    const absent = invoke("evaluation", "outcome", f.command.commandId);
    assert.equal(absent.status, 0, absent.stderr);
    assert.equal(absent.value, null);
    const first = invoke("evaluation", "commit", JSON.stringify(f.command));
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.value.receipt.output.type, f.model.conclusion);
    const saved = await f.tracer.exportProject();
    assert.deepEqual(invoke("evaluation", "outcome", f.command.commandId).value, first.value);
    assert.deepEqual(invoke("evaluation", "commit", JSON.stringify(f.command)).value, first.value);
    const bad = invoke(
      "evaluation",
      "commit",
      JSON.stringify({ ...f.command, receipt: { ...f.command.receipt, outcome: "Different" } }),
    );
    assert.equal(bad.status, 1);
    assert.equal(JSON.parse(bad.stderr).error, "conflict");
    assert.deepEqual(await f.tracer.exportProject(), saved);
  } finally {
    f.close();
  }
});
