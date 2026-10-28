import test from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/application/service.ts";
import type { RepositoryFixture } from "./repository-contract.ts";
import type { Repository } from "../src/application/ports/repository.ts";
import type { EvaluationResult } from "../src/core/evaluation-command.ts";
import type { ProjectExport } from "../src/core/project-export.ts";
import type { EvaluationCommand } from "../src/application/evaluations.ts";
const actor = { actor: "portable-evaluation-contract", reason: "Synthetic application operation" };
const schema = {
  entityTypes: { item: { fields: { title: { type: "string" as const } } } },
  relationshipTypes: {},
};
async function setup(open: () => Promise<RepositoryFixture>) {
  const fixture = await open(),
    tracer = new Tracer(fixture.repository);
  await tracer.setSchema(schema, 0, actor);
  const criterion = await tracer.createEntity(
    { type: "item", fields: { title: "Criterion" } },
    1,
    actor,
  );
  const outputId = crypto.randomUUID();
  const command: EvaluationCommand = {
    commandId: "evaluation-1",
    expectedSchemaVersion: 1,
    expectedProjectRevision: (await tracer.timeline()).head,
    operations: [
      {
        op: "entity.create",
        id: outputId,
        input: { type: "item", fields: { title: "Assessment" } },
      },
    ],
    receipt: {
      outputId,
      expectedOutputVersion: 1,
      outcome: "SIMULATED result",
      inputs: [{ entityId: criterion.id, fields: ["title"], role: "criterion" }],
    },
  };
  return { fixture, tracer, criterion, command };
}
/** Every registered provider must satisfy the same application atomicity and recovery contract. */
async function reopenedOutcome(
  fixture: RepositoryFixture,
  expected: EvaluationResult,
  saved: ProjectExport,
) {
  const reopened = new Tracer(await fixture.reopen());
  assert.deepEqual(await reopened.evaluations.getOutcome(expected.commandId), expected);
  assert.deepEqual(await reopened.exportProject(), saved);
  return reopened;
}
export function repositoryEvaluationContract(name: string, open: () => Promise<RepositoryFixture>) {
  test(`${name}: evaluation rejection rolls back the native proposal and retry/reopen recover one exact result`, async (t) => {
    const f = await setup(open);
    t.after(() => f.fixture.dispose());
    const before = await f.tracer.exportProject();
    assert.equal(before.evidenceRevision, 0);
    f.command.expectedEvidenceRevision = 0;
    await assert.rejects(
      f.tracer.evaluations.commit(
        {
          ...f.command,
          receipt: { ...f.command.receipt, inputs: [{ entityId: crypto.randomUUID() }] },
        },
        actor,
      ),
      { code: "not_found" },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal(await f.tracer.evaluations.getOutcome(f.command.commandId), null);
    const results = await Promise.all([
      f.tracer.evaluations.commit(f.command, actor),
      f.tracer.evaluations.commit(f.command, actor),
    ]);
    assert.deepEqual(results[0], results[1]);
    assert.equal((await f.tracer.evidence.list("receipt")).items.length, 1);
    const saved = await f.tracer.exportProject(),
      reopened = await reopenedOutcome(f.fixture, results[0], saved);
    results[0].receipt.inputs[0].entity.fields.title = "Caller mutation";
    assert.deepEqual(await reopened.evaluations.commit(f.command, actor), results[1]);
    assert.deepEqual(await reopened.exportProject(), saved);
  });
  test(`${name}: receipt-only evaluation recovery is family-scoped and independent of later native state`, async (t) => {
    const f = await setup(open);
    t.after(() => f.fixture.dispose());
    const native = await f.tracer.applyChangeset(
      {
        commandId: f.command.commandId,
        expectedSchemaVersion: 1,
        operations: f.command.operations,
      },
      actor,
    );
    const command = {
      ...f.command,
      expectedProjectRevision: (await f.tracer.timeline()).head,
      operations: [],
    };
    const first = await f.tracer.evaluations.commit(command, actor);
    assert.equal(first.native, null);
    assert.equal((await f.tracer.timeline()).head, command.expectedProjectRevision);
    assert.deepEqual(await f.tracer.getChangesetOutcome(command.commandId), native);
    await f.tracer.setSchema(
      { ...schema, entityTypes: { ...schema.entityTypes, other: { fields: {} } } },
      1,
      actor,
    );
    await f.tracer.removeEntity(command.receipt.outputId, 1, 2, actor);
    const saved = await f.tracer.exportProject();
    assert.deepEqual(await f.tracer.evaluations.commit(command, actor), first);
    for (const changed of [
      { ...command, receipt: { ...command.receipt, outcome: "Different" } },
      { ...command, expectedSchemaVersion: 2 },
    ])
      await assert.rejects(f.tracer.evaluations.commit(changed, actor), { code: "conflict" });
    await assert.rejects(
      f.tracer.evaluations.commit(command, { ...actor, reason: "Different provenance" }),
      { code: "conflict" },
    );
    await reopenedOutcome(f.fixture, first, saved);
  });
  test(`${name}: evaluation outcome insertion rolls back with capture/index/native state and reserves no identity`, async (t) => {
    const f = await setup(open);
    t.after(() => f.fixture.dispose());
    let fail = true;
    const fault: Repository = {
      close() {},
      transaction: (work) =>
        f.fixture.repository.transaction((tx) =>
          work({
            ...tx,
            appendEvaluationCommand: async (...args) => {
              await tx.appendEvaluationCommand(...args);
              if (fail) throw new Error("After durable outcome insertion");
            },
          }),
        ),
    };
    const tracer = new Tracer(fault),
      before = await tracer.exportProject();
    await assert.rejects(tracer.evaluations.commit(f.command, actor), { code: "storage" });
    assert.deepEqual(await tracer.exportProject(), before);
    assert.equal(await tracer.evaluations.getOutcome(f.command.commandId), null);
    await f.fixture.repository.transaction(async (tx) =>
      assert.deepEqual(
        (await tx.impactReceipts({ entityIds: [f.criterion.id], relationshipIds: [], limit: 10 }))
          .items,
        [],
      ),
    );
    fail = false;
    const result = await tracer.evaluations.commit(f.command, actor);
    await f.fixture.repository.transaction(async (tx) => {
      assert.equal(
        (await tx.impactReceipts({ entityIds: [f.criterion.id], relationshipIds: [], limit: 1 }))
          .items.length,
        1,
      );
      assert.deepEqual(
        await tx.impactReceipts({
          entityIds: [f.criterion.id],
          relationshipIds: [],
          limit: 1,
          excludeOutputId: result.receipt.output.id,
        }),
        { items: [] },
      );
    });
    await assert.rejects(
      f.fixture.repository.transaction((tx) =>
        tx.appendEvaluationCommand(f.command.commandId, "replace", result),
      ),
      { code: "storage" },
    );
    assert.deepEqual(await tracer.evaluations.getOutcome(f.command.commandId), result);
    assert.equal((await tracer.timeline()).head, before.projectRevision + 1);
  });
}
