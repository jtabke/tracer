import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/application/service.ts";
import type { Repository, Transaction } from "../src/application/ports/repository.ts";
import type { Entity } from "../src/core/model.ts";

type RepositoryFixture = {
  repository: Repository;
  dispose(): void | Promise<void>;
};
const provenance = { actor: "repository-contract" };
const schema = {
  entityTypes: { item: { fields: { title: { type: "string" as const } } } },
  relationshipTypes: { connects: { fields: {} } },
};

/** Each adapter supplies a fresh isolated project and owns its cleanup. */
export function repositoryContract(name: string, open: () => Promise<RepositoryFixture>) {
  async function setup(t: TestContext) {
    const fixture = await open();
    t.after(() => fixture.dispose());
    const tracer = new Tracer(fixture.repository);
    await tracer.setSchema(schema, 0, provenance);
    return { tracer, repository: fixture.repository };
  }

  test(`${name}: callback rejection rolls back state, identity, history and head`, async (t) => {
    const { tracer, repository } = await setup(t);
    const item: Entity = {
      id: crypto.randomUUID(),
      type: "item",
      version: 1,
      fields: { title: "Rolled back" },
    };
    const failure = new Error("abort after writes");
    await assert.rejects(
      repository.transaction(async (tx) => {
        await tx.beginChangeset(crypto.randomUUID(), 1, provenance);
        await tx.save("entity", item, 0);
        assert.deepEqual(await tx.get("entity", item.id), item);
        throw failure;
      }),
      { code: "storage" },
    );
    await repository.transaction(async (tx) => {
      assert.equal(await tx.headRevision(), 1);
      assert.equal(await tx.get("entity", item.id), undefined);
      assert.deepEqual((await tx.history({ kind: "entity" })).items, []);
      await tx.beginChangeset(crypto.randomUUID(), 1, provenance);
      await tx.save("entity", item, 0);
    });
    assert.deepEqual(await tracer.getEntity(item.id), item);
    assert.deepEqual(
      (await tracer.changesets()).map((value) => value.projectRevision),
      [1, 2],
    );
  });

  test(
    `${name}: nested transactions reject without deadlock or partial writes`,
    { timeout: 2000 },
    async (t) => {
      const { tracer, repository } = await setup(t);
      const before = await tracer.exportProject();
      const item: Entity = {
        id: crypto.randomUUID(),
        type: "item",
        version: 1,
        fields: { title: "Must roll back" },
      };
      await assert.rejects(
        repository.transaction(async (tx) => {
          await tx.beginChangeset(crypto.randomUUID(), 1, provenance);
          await tx.save("entity", item, 0);
          // Service entry points acquire transactions too; callers must use tx inside a callback.
          await tracer.getEntity(item.id);
        }),
        { code: "storage", message: /Nested transactions/ },
      );
      assert.deepEqual(await tracer.exportProject(), before);
      await repository.transaction(async (tx) => {
        await tx.beginChangeset(crypto.randomUUID(), 1, provenance);
        await tx.save("entity", item, 0);
      });
      assert.deepEqual(await tracer.getEntity(item.id), item);
    },
  );

  test(`${name}: independent callers remain valid while another callback is active`, async (t) => {
    const { repository } = await setup(t);
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = repository.transaction(async (tx) => {
      enter();
      await gate;
      assert.equal(await tx.headRevision(), 1);
    });
    await entered;
    const second = repository.transaction(async (tx) => {
      return tx.headRevision();
    });
    release();
    assert.deepEqual(await Promise.all([first, second]), [undefined, 1]);
  });

  test(`${name}: completed async contexts do not block later independent work`, async (t) => {
    const { repository } = await setup(t);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let later!: Promise<number>;
    await repository.transaction(async (tx) => {
      later = gate.then(() => repository.transaction((next) => next.headRevision()));
      assert.equal(await tx.headRevision(), 1);
    });
    release();
    assert.equal(await later, 1);
  });

  test(`${name}: operations after close reject with a storage error before invoking callbacks`, async (t) => {
    const fixture = await open();
    let closed = false;
    t.after(() => {
      if (!closed) return fixture.dispose();
    });
    const tracer = new Tracer(fixture.repository);
    await tracer.setSchema(schema, 0, provenance);
    await fixture.dispose();
    closed = true;
    let invoked = false;
    await assert.rejects(
      fixture.repository.transaction(async () => {
        invoked = true;
      }),
      { code: "storage" },
    );
    await assert.rejects(tracer.getSchema(), { code: "storage" });
    assert.equal(invoked, false);
  });

  test(`${name}: transaction handles expire after both commit and rollback`, async (t) => {
    const { repository } = await setup(t);
    const committed = await repository.transaction(async (tx) => tx);
    await assert.rejects(committed.headRevision(), { code: "storage" });
    let rejected: Transaction | undefined;
    await assert.rejects(
      repository.transaction(async (tx) => {
        rejected = tx;
        throw new Error("abort");
      }),
      { code: "storage" },
    );
    assert.ok(rejected);
    await assert.rejects(rejected.headRevision(), { code: "storage" });
    assert.equal(await repository.transaction((tx) => tx.headRevision()), 1);
  });

  test(`${name}: competing versions commit one winner with matching immutable history`, async (t) => {
    const { tracer, repository } = await setup(t);
    const item = await tracer.createEntity(
      { type: "item", fields: { title: "Original" } },
      1,
      provenance,
    );
    const results = await Promise.allSettled(
      ["First", "Second"].map((title) =>
        tracer.updateEntity(item.id, 1, { fields: { title } }, 1, provenance),
      ),
    );
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.equal(rejected.reason.code, "conflict");
    const current = await tracer.getEntity(item.id);
    assert.equal(current.version, 2);
    const history = (await tracer.history({ kind: "entity", id: item.id })).items;
    assert.deepEqual(
      history.map((row) => row.version),
      [1, 2],
    );
    assert.deepEqual(history[0].snapshot, item);
    assert.deepEqual(history[1].snapshot, current);
    assert.equal(await repository.transaction((tx) => tx.headRevision()), 3);
  });

  test(`${name}: failed batches retain no partial objects or changeset`, async (t) => {
    const { tracer } = await setup(t);
    const before = await tracer.exportProject();
    await assert.rejects(
      tracer.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: [
            { op: "entity.create", input: { type: "item", key: "same", fields: {} } },
            { op: "entity.create", input: { type: "item", key: "same", fields: {} } },
          ],
        },
        provenance,
      ),
      { code: "conflict" },
    );
    assert.deepEqual(await tracer.exportProject(), before);
  });

  test(`${name}: command repeats return original generated results after later edits and schema changes`, async (t) => {
    const { tracer, repository } = await setup(t);
    const input = {
      commandId: "job-1",
      expectedSchemaVersion: 1,
      expectedProjectRevision: 1,
      operations: [
        { op: "entity.create" as const, input: { type: "item", fields: { title: "Original" } } },
      ],
    };
    assert.equal(await tracer.getChangesetOutcome(input.commandId), null);
    const first = await tracer.applyChangeset({ ...input, provenance });
    const item = first.results[0];
    await tracer.updateEntity(item.id, 1, { fields: { title: "Later" } }, 1, provenance);
    await tracer.setSchema(schema, 1, provenance);
    const before = await tracer.exportProject();
    const repeat = {
      ...input,
      operations: [
        { input: { fields: { title: "Original" }, type: "item" }, op: "entity.create" as const },
      ],
    };
    assert.deepEqual(await tracer.applyChangeset(repeat, provenance), first);
    assert.deepEqual(await tracer.getChangesetOutcome(input.commandId), first);
    // A caller cannot alter the persisted result through a returned reference.
    first.results.length = 0;
    assert.equal((await tracer.getChangesetOutcome(input.commandId))!.results.length, 1);
    assert.deepEqual(await tracer.exportProject(), before);
    await repository.transaction(async (tx) => {
      assert.equal((await tx.getChangesetCommand(input.commandId))!.result.results.length, 1);
    });
  });

  test(`${name}: concurrent command IDs deduplicate or reject differing intent without another revision`, async (t) => {
    const { tracer } = await setup(t);
    const input = {
      commandId: "competing",
      expectedSchemaVersion: 1,
      operations: [{ op: "entity.create" as const, input: { type: "item", fields: {} } }],
    };
    const [first, second] = await Promise.all([
      tracer.applyChangeset(input, provenance),
      tracer.applyChangeset(input, provenance),
    ]);
    assert.deepEqual(first, second);
    for (const changed of [
      { ...input, expectedProjectRevision: 2 },
      {
        ...input,
        operations: [
          { ...input.operations[0], input: { type: "item", fields: { title: "Different" } } },
        ],
      },
    ])
      await assert.rejects(tracer.applyChangeset(changed, provenance), {
        code: "conflict",
        details: { path: ["commandId"] },
      });
    await assert.rejects(tracer.applyChangeset(input, { actor: "different" }), {
      code: "conflict",
    });
    await assert.rejects(tracer.applyChangeset(input, { ...provenance, reason: "different" }), {
      code: "conflict",
    });
    assert.equal((await tracer.changesets()).length, 2);
    assert.equal((await tracer.queryEntities()).items.length, 1);
  });

  test(`${name}: outcomes retain ordered intermediate records and tombstones after deletion`, async (t) => {
    const { tracer } = await setup(t);
    const id = crypto.randomUUID();
    const input = {
      commandId: "multi-operation",
      expectedSchemaVersion: 1,
      operations: [
        { op: "entity.create" as const, id, input: { type: "item", fields: { title: "First" } } },
        {
          op: "entity.update" as const,
          id,
          expectedVersion: 1,
          input: { fields: { title: "Second" } },
        },
        { op: "entity.remove" as const, id, expectedVersion: 2 },
      ],
    };
    const result = await tracer.applyChangeset(input, provenance);
    assert.deepEqual(
      result.results.map((item) => item.version),
      [1, 2, 3],
    );
    assert.deepEqual(result.results[2], { id, version: 3, deleted: true });
    await assert.rejects(tracer.getEntity(id), { code: "not_found" });
    assert.deepEqual(await tracer.applyChangeset(input, provenance), result);
    assert.deepEqual(await tracer.getChangesetOutcome(input.commandId), result);
    await assert.rejects(
      tracer.applyChangeset({ ...input, operations: [...input.operations].reverse() }, provenance),
      { code: "conflict" },
    );
    assert.equal((await tracer.history({ id })).items.length, 3);
  });

  test(`${name}: failed commands reserve no ID and rollback after outcome insertion removes every write`, async (t) => {
    const { tracer, repository } = await setup(t);
    const bad = {
      commandId: "recoverable",
      expectedSchemaVersion: 1,
      operations: [
        { op: "entity.create" as const, input: { type: "item", key: "duplicate", fields: {} } },
        { op: "entity.create" as const, input: { type: "item", key: "duplicate", fields: {} } },
      ],
    };
    await assert.rejects(tracer.applyChangeset(bad, provenance), { code: "conflict" });
    assert.equal(await tracer.getChangesetOutcome(bad.commandId), null);
    const good = { ...bad, operations: bad.operations.slice(0, 1) };
    const result = await tracer.applyChangeset(good, provenance);
    assert.equal(result.changeset.projectRevision, 2);
    const before = await tracer.exportProject();
    await assert.rejects(
      repository.transaction(async (tx) => {
        const changeset = await tx.beginChangeset(crypto.randomUUID(), 1, provenance);
        const entity: Entity = { id: crypto.randomUUID(), version: 1, type: "item", fields: {} };
        await tx.save("entity", entity, 0);
        await tx.appendChangesetCommand("rollback", "intent", { changeset, results: [entity] });
        assert.ok(await tx.getChangesetCommand("rollback"));
        throw new Error("abort after outcome insertion");
      }),
      { code: "storage" },
    );
    assert.equal(await tracer.getChangesetOutcome("rollback"), null);
    assert.deepEqual(await tracer.exportProject(), before);
  });

  test(`${name}: dangling endpoints reject without recording native history`, async (t) => {
    const { tracer } = await setup(t);
    const item = await tracer.createEntity({ type: "item", fields: {} }, 1, provenance);
    const before = await tracer.exportProject();
    await assert.rejects(
      tracer.createRelationship(
        {
          type: "connects",
          source: item.id,
          target: crypto.randomUUID(),
          fields: {},
        },
        1,
        provenance,
      ),
      { code: "referential_integrity" },
    );
    assert.deepEqual(await tracer.exportProject(), before);
  });
}
