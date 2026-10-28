import test from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { evaluationFixture, evaluationActor as actor } from "./evaluation-fixture.ts";

test("evaluation command captures invocation intent before queueing and does not infer changed intent from caller mutation", async () => {
  const f = await evaluationFixture();
  let release!: () => void, enter!: () => void;
  try {
    const gate = new Promise<void>((r) => {
        release = r;
      }),
      entered = new Promise<void>((r) => {
        enter = r;
      });
    const held = f.repository.transaction(async (tx) => {
      await tx.headRevision();
      enter();
      await gate;
    });
    await entered;
    const original = structuredClone(f.command),
      origin = { ...actor };
    const pending = f.tracer.evaluations.commit(f.command, origin);
    f.command.receipt.outcome = "Caller changed outcome";
    const op = f.command.operations[0];
    assert.ok(op.op === "entity.create");
    op.input.fields.title = "Caller changed activity";
    origin.reason = "Caller changed provenance";
    release();
    await held;
    const result = await pending;
    assert.equal(result.receipt.outcome, original.receipt.outcome);
    assert.equal(result.receipt.reason, actor.reason);
    const first = result.native!.results[0];
    assert.ok("fields" in first);
    assert.equal(first.fields.title, "Recorded activity");
    const saved = await f.tracer.exportProject();
    assert.deepEqual(await f.tracer.evaluations.commit(original, actor), result);
    await assert.rejects(f.tracer.evaluations.commit(f.command, origin), { code: "conflict" });
    assert.deepEqual(await f.tracer.exportProject(), saved);
  } finally {
    release?.();
    f.close();
  }
});

test("invalid native, capture, schema and head proposals reject atomically and leave the command identity reusable", async () => {
  const f = await evaluationFixture();
  try {
    const original = f.command,
      before = await f.tracer.exportProject();
    const nativeBad = structuredClone(original);
    const op = nativeBad.operations[1];
    assert.ok(op.op === "entity.create");
    op.input.fields = { unconfigured: true };
    const wrongObservation = structuredClone(original);
    wrongObservation.receipt.inputs[5].observationId = f.spec.observation.id;
    const wrongLink = structuredClone(original);
    wrongLink.receipt.relationshipInputs![1].expectedVersion = 99;
    const cases = [
      { command: { ...original, expectedSchemaVersion: 99 }, code: "schema_conflict" },
      { command: { ...original, expectedProjectRevision: 0 }, code: "conflict" },
      { command: nativeBad, code: "validation" },
      {
        command: { ...original, receipt: { ...original.receipt, expectedOutputVersion: 99 } },
        code: "conflict",
      },
      { command: wrongObservation, code: "validation" },
      { command: wrongLink, code: "conflict" },
      {
        command: {
          ...original,
          operations: Array.from({ length: 1001 }, () => original.operations[0]),
        },
        code: "validation",
      },
      { command: { ...original, operations: [] }, code: "not_found" },
    ];
    for (const c of cases) {
      await assert.rejects(f.tracer.evaluations.commit(c.command, actor), { code: c.code });
      assert.deepEqual(await f.tracer.exportProject(), before);
      assert.equal(await f.tracer.evaluations.getOutcome(original.commandId), null);
    }
    await f.tracer.evaluations.commit(original, actor);
    assert.equal((await f.tracer.evidence.list("receipt")).items.length, 1);
  } finally {
    f.close();
  }
});

test("independent SQLite connections recover contention without duplicating evaluation command results", async () => {
  const f = await evaluationFixture(),
    other = new SQLiteRepository(f.database);
  try {
    const second = new Tracer(other),
      outcomes = await Promise.allSettled([
        f.tracer.evaluations.commit(f.command, actor),
        second.evaluations.commit(f.command, actor),
      ]);
    const successes = outcomes.filter((r) => r.status === "fulfilled");
    assert.ok(successes.length >= 1);
    const first = successes[0].value;
    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") assert.deepEqual(outcome.value, first);
      else assert.equal(outcome.reason.code, "busy");
    }
    const saved = await f.tracer.exportProject();
    assert.deepEqual(await second.evaluations.getOutcome(f.command.commandId), first);
    assert.deepEqual(await second.evaluations.commit(f.command, actor), first);
    assert.deepEqual(await f.tracer.exportProject(), saved);
    assert.equal(saved.evidence.receipts.length, 1);
  } finally {
    other.close();
    f.close();
  }
});
