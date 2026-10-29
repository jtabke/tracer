import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/index.ts";
import type { EvaluationCommand } from "../src/application/evaluations.ts";
import type { ChangesetCommand } from "../src/application/commands.ts";

const actor = { actor: "independent-process-contract" };
function response(child: ChildProcess, predicate: (message: any) => boolean) {
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error("Worker response timed out")), 5000);
    function finish(error?: Error, message?: unknown) {
      clearTimeout(timeout);
      child.off("message", receive);
      child.off("exit", exited);
      if (error) reject(error);
      else resolve(message);
    }
    function receive(message: any) {
      if (predicate(message)) finish(undefined, message);
    }
    function exited() {
      finish(new Error("Worker exited before response"));
    }
    child.on("message", receive);
    child.on("exit", exited);
  });
}
async function worker(database: string) {
  const child = fork(new URL("./sqlite-concurrency-worker.ts", import.meta.url), [database], {
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  });
  const ready = response(child, (message) => message.ready);
  await ready;
  let id = 0;
  return {
    child,
    request(action: string, input?: ChangesetCommand | EvaluationCommand) {
      const selected = ++id;
      const result = response(child, (message) => message.id === selected && !message.held);
      child.send({ id: selected, action, input });
      return result;
    },
    async hold(action: string, input?: ChangesetCommand | EvaluationCommand) {
      const selected = ++id;
      const held = response(
        child,
        (message) => message.id === selected && (message.held || message.error),
      );
      const result = response(child, (message) => message.id === selected && !message.held);
      child.send({ id: selected, action, input });
      const entered = await held;
      if (entered.error) {
        await result;
        throw new Error(entered.error.message);
      }
      return { result, release: () => child.send({ action: "release" }) };
    },
    async close() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, "exit");
      child.kill();
      await exited;
    },
  };
}
async function setup(t: test.TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "tracer-process-contract-"));
  const database = join(directory, "project.sqlite");
  const repository = new SQLiteRepository(database);
  const tracer = new Tracer(repository);
  await tracer.setSchema(
    { entityTypes: { item: { fields: { title: { type: "string" } } } }, relationshipTypes: {} },
    0,
    actor,
  );
  const children: Awaited<ReturnType<typeof worker>>[] = [];
  t.after(async () => {
    await Promise.all(children.map((child) => child.close()));
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    repository,
    tracer,
    async open() {
      const child = await worker(database);
      children.push(child);
      return child;
    },
  };
}

test("SQLite independent process reader retains its snapshot while another process commits", async (t) => {
  const { tracer, open } = await setup(t);
  const reader = await open(),
    writer = await open();
  const held = await reader.hold("hold-read");
  try {
    assert.equal((await tracer.getSchema())!.version, 1);
    const result = await writer.request("apply", {
      commandId: "write-during-read",
      expectedSchemaVersion: 1,
      operations: [{ op: "entity.create", input: { type: "item", fields: {} } }],
      provenance: actor,
    });
    assert.equal(result.error, undefined);
    assert.equal((await tracer.getProjectSnapshot()).projectRevision, 2);
  } finally {
    held.release();
  }
  assert.deepEqual((await held.result).result, { before: 1, after: 1 });
  assert.equal((await reader.request("snapshot")).result.projectRevision, 2);
});

test("SQLite readers coexist with a writer; a competing writer rejects without partial writes", async (t) => {
  const { tracer, open } = await setup(t);
  const writer = await open(),
    competitor = await open();
  const held = await writer.hold("hold-write");
  try {
    assert.equal((await tracer.getProjectSnapshot()).projectRevision, 1);
    const result = await competitor.request("apply", {
      commandId: "blocked-write",
      expectedSchemaVersion: 1,
      operations: [{ op: "entity.create", input: { type: "item", fields: {} } }],
      provenance: actor,
    });
    assert.equal(result.error.code, "busy");
    assert.equal(await tracer.getChangesetOutcome("blocked-write"), null);
    assert.equal((await tracer.queryEntities()).items.length, 0);
  } finally {
    held.release();
  }
  await held.result;
  assert.equal((await competitor.request("snapshot")).result.projectRevision, 1);
});

test("SQLite independent process competing command identities preserve one exact outcome", async (t) => {
  const { tracer, open } = await setup(t);
  const first = await open(),
    second = await open();
  const input: ChangesetCommand = {
    commandId: "same-command",
    expectedSchemaVersion: 1,
    operations: [{ op: "entity.create", input: { type: "item", fields: {} } }],
    provenance: actor,
  };
  const results = await Promise.all([
    first.request("apply", input),
    second.request("apply", input),
  ]);
  const successes = results.filter((result) => !result.error);
  assert.ok(successes.length >= 1);
  for (const result of results) {
    if (result.error) assert.equal(result.error.code, "busy");
    else assert.deepEqual(result.result, successes[0].result);
  }
  assert.deepEqual(await tracer.getChangesetOutcome(input.commandId!), successes[0].result);
  const changed = await second.request("apply", { ...input, provenance: { actor: "different" } });
  assert.equal(changed.error.code, "conflict");
  assert.equal((await tracer.getProjectSnapshot()).projectRevision, 2);
  assert.equal((await tracer.queryEntities()).items.length, 1);
});

for (const phase of ["before", "after"] as const) {
  test(`SQLite process crash ${phase} commit preserves native/evidence/outcome atomicity`, async (t) => {
    const { tracer, open } = await setup(t);
    const criterion = await tracer.createEntity({ type: "item", fields: {} }, 1, actor);
    const child = await open();
    const outputId = crypto.randomUUID();
    const command: EvaluationCommand = {
      commandId: `interrupted-${phase}`,
      expectedSchemaVersion: 1,
      operations: [{ op: "entity.create", id: outputId, input: { type: "item", fields: {} } }],
      receipt: {
        outputId,
        expectedOutputVersion: 1,
        outcome: "Synthetic process crash test",
        inputs: [{ entityId: criterion.id }],
      },
    };
    const before = await tracer.exportProject();
    const held = await child.hold(`evaluation-${phase}-commit`, command);
    // Losing the command response must not produce an unhandled pending request.
    const interrupted = held.result.catch(() => undefined);
    await child.close();
    await interrupted;
    const recovered = await tracer.evaluations.getOutcome(command.commandId);
    if (phase === "before") {
      assert.equal(recovered, null);
      assert.deepEqual(await tracer.exportProject(), before);
      const result = await tracer.evaluations.commit(
        { ...command, commandId: "deliberate-new-attempt" },
        actor,
      );
      assert.equal(result.receipt.output.id, outputId);
    } else {
      assert.ok(recovered);
      assert.equal(recovered.receipt.output.id, outputId);
      assert.equal((await tracer.getEntity(outputId)).version, 1);
      assert.equal((await tracer.evidence.list("receipt")).items.length, 1);
      const fresh = await open();
      assert.equal((await fresh.request("snapshot")).result.projectRevision, 3);
      assert.deepEqual(await tracer.evaluations.getOutcome(command.commandId), recovered);
    }
  });
}
