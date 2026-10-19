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
