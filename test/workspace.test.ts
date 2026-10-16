import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { seedWorkspace } from "../examples/seed-workspace.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Entity } from "../src/core/model.ts";

const actor = { actor: "test" };
for (const domain of ["software", "engineering"] as const)
  test(`${domain}: isolated seed, shared identity, real old revisions, persisted edits and tombstones`, async () => {
    const parent = mkdtempSync(join(tmpdir(), "tracer-workspace-test-"));
    let repo: SQLiteRepository | undefined;
    try {
      const fixture = await seedWorkspace(join(parent, "project"), domain);
      repo = new SQLiteRepository(fixture.database);
      const tracer = new Tracer(repo);
      assert.equal((await tracer.getWorkingSet()).total, domain === "software" ? 22 : 12);
      const server = await startLocalServer(tracer, parent, 0);
      try {
        const response = await fetch(
          `${server.origin}/api/family?rootId=${fixture.intents[0].id}&relationshipType=contributes_to&direction=incoming&limit=12`,
        );
        assert.equal(response.status, 200);
        assert.equal((await response.json()).root.id, fixture.intents[0].id);
        assert.equal(
          (await fetch(`${server.origin}/api/family?rootId=${fixture.intents[0].id}&limit=21`))
            .status,
          400,
        );
        const { token } = await (await fetch(`${server.origin}/api/session`)).json();
        const stale = await fetch(`${server.origin}/api/changesets`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Tracer-Token": token,
            Origin: server.origin,
          },
          body: JSON.stringify({
            expectedSchemaVersion: 1,
            operations: [
              {
                op: "relationship.create",
                input: {
                  type: "mapped_to",
                  source: fixture.requirements[0].id,
                  target: fixture.outputs[1].id,
                  fields: { scope: "Captured old intent", source_version: 1, review: "unreviewed" },
                },
                expectedEndpoints: { sourceVersion: 1, targetVersion: 1 },
                rejectExisting: true,
              },
            ],
          }),
        });
        assert.equal(stale.status, 409);
        assert.equal((await stale.json()).error, "conflict");
      } finally {
        await server.close();
      }
      const first = await tracer.getFamily({
        rootId: fixture.intents[0].id,
        relationshipType: "contributes_to",
        direction: "incoming",
      });
      assert.ok(first.members.some((entity) => entity.id === fixture.requirements[1].id));
      const second = await tracer.getFamily({
        rootId: fixture.intents[1].id,
        relationshipType: "contributes_to",
        direction: "incoming",
      });
      assert.ok(second.members.some((entity) => entity.id === fixture.requirements[1].id));
      assert.equal(first.nodes.filter((entity) => entity.id === fixture.outputs[0].id).length, 1);
      const history = await tracer.history({ kind: "entity", id: fixture.requirements[0].id });
      assert.deepEqual(
        history.items.map((revision) => revision.version),
        [1, 2],
      );
      assert.notDeepEqual(history.items[0].snapshot, history.items[1].snapshot);
      const requirement = fixture.requirements[1];
      await tracer.updateEntity(
        requirement.id,
        1,
        { fields: { ...requirement.fields, title: "Saved prose" } },
        1,
        actor,
      );
      await tracer.removeRelationship(fixture.mapping.id, 1, 1, actor);
      repo.close();
      repo = new SQLiteRepository(fixture.database);
      const reopened = new Tracer(repo);
      assert.equal(
        (await reopened.getFamily({ rootId: requirement.id })).root.fields.title,
        "Saved prose",
      );
      assert.equal(
        (await reopened.history({ kind: "relationship", id: fixture.mapping.id })).items.at(-1)
          ?.snapshot,
        null,
      );
      const sentinel = join(fixture.directory, "owner.txt");
      writeFileSync(sentinel, "preserve");
      await assert.rejects(seedWorkspace(fixture.directory, domain), { code: "EEXIST" });
      assert.equal(readFileSync(sentinel, "utf8"), "preserve");
      assert.equal((await reopened.getWorkingSet()).total, domain === "software" ? 22 : 12);
      await assert.rejects(seedWorkspace(join(parent, "failed"), "unknown" as "software"));
      assert.equal(existsSync(join(parent, "failed")), false);
    } finally {
      repo?.close();
      rmSync(parent, { recursive: true, force: true });
    }
  });

test("captured endpoint/schema versions and duplicate guard fail atomically without history changes", async () => {
  const repo = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repo);
    await tracer.setSchema(
      {
        entityTypes: { item: { fields: { title: { type: "string", required: true } } } },
        relationshipTypes: { maps: { fields: {} } },
      },
      0,
      actor,
    );
    const source = (await tracer.createEntity(
      { type: "item", fields: { title: "Source" } },
      1,
      actor,
    )) as Entity;
    const target = (await tracer.createEntity(
      { type: "item", fields: { title: "Target" } },
      1,
      actor,
    )) as Entity;
    const operation = {
      op: "relationship.create" as const,
      input: { type: "maps", source: source.id, target: target.id, fields: {} },
      expectedEndpoints: { sourceVersion: 1, targetVersion: 1 },
      rejectExisting: true,
    };
    await tracer.updateEntity(source.id, 1, { fields: { title: "Changed" } }, 1, actor);
    const before = (await tracer.getFamily({ rootId: source.id })).projectRevision;
    const revisions = (await tracer.history()).items.length;
    await assert.rejects(
      tracer.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: [
            {
              op: "entity.update",
              id: target.id,
              expectedVersion: 1,
              input: { fields: { title: "Must roll back" } },
            },
            operation,
          ],
        },
        actor,
      ),
      { code: "conflict" },
    );
    assert.equal((await tracer.getFamily({ rootId: target.id })).root.version, 1);
    assert.equal((await tracer.getFamily({ rootId: target.id })).projectRevision, before);
    assert.equal((await tracer.history()).items.length, revisions);
    await assert.rejects(
      tracer.applyChangeset({ expectedSchemaVersion: 2, operations: [operation] }, actor),
      { code: "schema_conflict" },
    );
    await tracer.updateEntity(target.id, 1, { fields: { title: "Changed target" } }, 1, actor);
    await assert.rejects(
      tracer.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: [{ ...operation, expectedEndpoints: { sourceVersion: 2, targetVersion: 1 } }],
        },
        actor,
      ),
      { code: "conflict" },
    );
    const current = { ...operation, expectedEndpoints: { sourceVersion: 2, targetVersion: 2 } };
    await tracer.applyChangeset({ expectedSchemaVersion: 1, operations: [current] }, actor);
    await assert.rejects(
      tracer.applyChangeset({ expectedSchemaVersion: 1, operations: [current] }, actor),
      { code: "conflict" },
    );
    assert.equal((await tracer.queryRelationships()).items.length, 1);
    await assert.rejects(
      tracer.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: [{ ...current, expectedEndpoints: null } as unknown as typeof current],
        },
        actor,
      ),
      { code: "validation" },
    );
  } finally {
    repo.close();
  }
});

test("family read is a single snapshot with bounded dense context, cursors and non-absent off-page connections", async () => {
  const repo = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repo);
    await tracer.setSchema(
      {
        entityTypes: { item: { fields: { title: { type: "string" } } } },
        relationshipTypes: { maps: { fields: {} } },
      },
      0,
      actor,
    );
    const root = (await tracer.createEntity(
      { type: "item", fields: { title: "Root" } },
      1,
      actor,
    )) as Entity;
    const member = (await tracer.createEntity(
      { type: "item", fields: { title: "Member" } },
      1,
      actor,
    )) as Entity;
    const values: Entity[] = [];
    for (let index = 0; index < 205; index++)
      values.push(
        (await tracer.createEntity(
          { type: "item", fields: { title: "same-filename.ts" } },
          1,
          actor,
        )) as Entity,
      );
    await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: values.map((target) => ({
          op: "relationship.create",
          input: { type: "maps", source: root.id, target: target.id, fields: {} },
        })),
      },
      actor,
    );
    await tracer.createRelationship(
      { type: "maps", source: root.id, target: member.id, fields: {} },
      1,
      actor,
    );
    let transactions = 0;
    const counted = new Tracer({
      transaction: (work) => {
        transactions++;
        return repo.transaction(work);
      },
      close() {},
    });
    const read = await counted.getFamily({ rootId: root.id });
    assert.equal(transactions, 1);
    assert.equal(read.links.length, 200);
    assert.equal(read.connections[0].total, 206);
    assert.equal(read.connections[0].loaded, 200);
    assert.equal(read.nodes.length, 201); // Identical filenames do not merge identities.
    const page = await tracer.getFamily({
      rootId: root.id,
      relationshipType: "maps",
      limit: 2,
      direction: "outgoing",
    });
    assert.equal(page.members.length, 2);
    assert.ok(page.nextAfter);
    const next = await tracer.getFamily({
      rootId: root.id,
      relationshipType: "maps",
      limit: 2,
      direction: "outgoing",
      after: page.nextAfter,
    });
    assert.equal(
      next.members.some((entity) => page.members.some((previous) => previous.id === entity.id)),
      false,
    );
    for (const query of [
      { rootId: root.id, limit: 21 },
      { rootId: root.id, relationshipType: "toString" },
      { rootId: root.id, direction: "sideways" },
      { rootId: root.id, after: "cursor" },
      { rootId: root.id, extra: 1 },
    ])
      await assert.rejects(tracer.getFamily(query as Parameters<Tracer["getFamily"]>[0]), {
        code: "validation",
      });
  } finally {
    repo.close();
  }
});
