import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";
import type { ChangesetInput, Operation } from "../src/application/commands.ts";
const origin = { actor: "foundation-verification", reason: "REQ-003/005 AC-1 and AC-2" };
const schema = {
  entityTypes: { item: { fields: { title: { type: "string" as const, required: true } } } },
  relationshipTypes: {
    connects: {
      source: ["item"],
      target: ["item"],
      fields: { scope: { type: "string" as const } },
    },
    cites: { source: ["item"], target: [], resourceTarget: true, reference: true, fields: {} },
  },
};

test("REQ-003 AC-1/AC-2: another process reopens the exact project without reseeding any recorded primitive", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-durable-")),
    path = join(directory, "project.sqlite");
  let repository: SQLiteRepository | undefined = new SQLiteRepository(path);
  try {
    const t = new Tracer(repository, undefined, observeLocal);
    await t.setSchema(schema, 0, origin);
    const id = crypto.randomUUID(),
      outputId = crypto.randomUUID();
    const command: ChangesetInput = {
      commandId: "durable-create",
      expectedSchemaVersion: 1,
      operations: [
        {
          op: "entity.create" as const,
          id,
          input: { type: "item", key: "REQ-1", fields: { title: "Durable criterion" } },
        },
        {
          op: "entity.create" as const,
          id: outputId,
          input: { type: "item", key: "ARTICLE-1", fields: { title: "Candidate" } },
        },
        {
          op: "relationship.create" as const,
          input: {
            type: "connects",
            source: id,
            target: outputId,
            fields: { scope: "Article under test" },
          },
        },
      ],
    };
    const saved = await t.applyChangeset(command, origin);
    const resource = await t.createEntity(
      {
        type: "@resource",
        fields: {},
        resource: {
          label: "Definition document",
          source: { system: "file", externalId: "definition-document" },
        },
      },
      1,
      origin,
    );
    const file = join(directory, "definition.md");
    writeFileSync(file, "A controlled definition\n");
    const observation = await t.evidence.observe(
      { entityId: resource.id, locator: { system: "file", path: file } },
      origin,
    );
    const reference = await t.createRelationship(
      {
        type: "cites",
        source: id,
        target: resource.id,
        fields: {},
        reference: {
          role: "definition",
          selector: { kind: "section", value: "Criterion" },
          state: { mode: "pinned", observationId: observation.id },
        },
      },
      1,
      origin,
    );
    const receipt = await t.evidence.recordReceipt(
      {
        outputId,
        outcome: "Simulated interpretation only",
        inputs: [
          { entityId: id, facet: "native", role: "criterion" },
          { entityId: resource.id, observationId: observation.id, role: "definition" },
        ],
        relationshipInputs: [{ id: reference.id }],
      },
      origin,
    );
    await t.savedViews.save({
      name: "Recorded allocation",
      expectedVersion: 0,
      expectedSchemaVersion: 1,
      definition: {
        kind: "chain",
        type: "item",
        steps: [{ relationshipType: "connects", type: "item", direction: "outgoing" }],
      },
    });
    await t.configurations.capture(
      {
        name: "Captured article context",
        subjectId: outputId,
        expectedSubjectVersion: 1,
        members: [{ entityId: id, version: 1 }],
      },
      origin,
    );
    await t.baselines.capture(
      {
        id: "durable-head",
        name: "Durable project state",
        expectedProjectRevision: (await t.getProjectSnapshot()).projectRevision,
      },
      origin,
    );
    const before = await t.exportProject();
    repository.close();
    repository = undefined;
    const child = spawnSync(
      process.execPath,
      ["src/interfaces/cli.ts", "--db", path, "project", "export"],
      { encoding: "utf8", timeout: 10000 },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), before);
    const rejectedSeed = spawnSync(
      process.execPath,
      ["src/interfaces/serve.ts", "--headless", "--db", path, "--seed-demo"],
      { encoding: "utf8", timeout: 10000 },
    );
    assert.equal(rejectedSeed.status, 1);
    assert.match(rejectedSeed.stderr, /existing projects are never seeded/);
    repository = new SQLiteRepository(path);
    const reopened = new Tracer(repository);
    assert.deepEqual(await reopened.exportProject(), before);
    assert.deepEqual(await reopened.applyChangeset(command, origin), saved);
    assert.deepEqual(await reopened.evidence.getReceipt(receipt.id), receipt);
    assert.equal(
      (await reopened.getReference(reference.id)).selectedObservation?.id,
      observation.id,
    );
    assert.deepEqual(await reopened.exportProject(), before);
  } finally {
    repository?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("REQ-005 AC-1/AC-2: guarded multi-object changes commit one history unit or leave every primitive unchanged", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const t = new Tracer(repository);
    await t.setSchema(schema, 0, origin);
    const source = await t.createEntity({ type: "item", fields: { title: "Original" } }, 1, origin);
    const target = await t.createEntity({ type: "item", fields: { title: "Target" } }, 1, origin);
    await t.updateEntity(source.id, 1, { fields: { title: "Current" } }, 1, origin);
    const link = await t.createRelationship(
      { type: "connects", source: source.id, target: target.id, fields: {} },
      1,
      origin,
    );
    const before = await t.exportProject(),
      prefixId = crypto.randomUUID();
    const prefix: Operation = {
      op: "entity.create",
      id: prefixId,
      input: { type: "item", key: "PREFIX", fields: { title: "Created together" } },
    };
    const failures: { name: string; code: string; operation: Operation }[] = [
      {
        name: "invalid-field",
        code: "validation",
        operation: {
          op: "entity.update",
          id: source.id,
          expectedVersion: 2,
          input: { fields: { title: 42 } },
        },
      },
      {
        name: "stale-entity",
        code: "conflict",
        operation: {
          op: "entity.update",
          id: source.id,
          expectedVersion: 1,
          input: { fields: { title: "Stale proposal" } },
        },
      },
      {
        name: "stale-link",
        code: "conflict",
        operation: {
          op: "relationship.update",
          id: link.id,
          expectedVersion: 2,
          input: { ...link, fields: { scope: "Stale link proposal" } },
        },
      },
      {
        name: "missing-target",
        code: "referential_integrity",
        operation: { op: "relationship.create", input: { ...link, target: crypto.randomUUID() } },
      },
    ];
    for (const failure of failures) {
      await assert.rejects(
        t.applyChangeset(
          {
            commandId: failure.name,
            expectedSchemaVersion: 1,
            operations: [prefix, failure.operation],
          },
          origin,
        ),
        { code: failure.code },
      );
      assert.deepEqual(await t.exportProject(), before);
      assert.equal(await t.getChangesetOutcome(failure.name), null);
    }
    const operations: Operation[] = [
      prefix,
      {
        op: "entity.update",
        id: source.id,
        expectedVersion: 2,
        input: { fields: { title: "Committed criterion" } },
      },
      {
        op: "relationship.update",
        id: link.id,
        expectedVersion: 1,
        input: { ...link, fields: { scope: "Committed allocation" } },
      },
    ];
    const command: ChangesetInput = {
      commandId: "stale-entity",
      expectedSchemaVersion: 1,
      expectedProjectRevision: before.projectRevision,
      operations,
    };
    const result = await t.applyChangeset(command, origin),
      after = await t.exportProject();
    assert.equal(after.projectRevision, before.projectRevision + 1);
    assert.equal(after.provenance.changesets.length, before.provenance.changesets.length + 1);
    const revisions = after.provenance.revisions.filter(
      (r) => r.changesetId === result.changeset.id,
    );
    assert.deepEqual(
      revisions.map((r) => [r.id, r.version, r.ordinal]),
      [
        [prefixId, 1, 1],
        [source.id, 3, 2],
        [link.id, 2, 3],
      ],
    );
    assert.equal((await t.getEntity(source.id)).fields.title, "Committed criterion");
    assert.equal((await t.getRelationship(link.id)).fields.scope, "Committed allocation");
    assert.deepEqual(await t.applyChangeset(command, origin), result);
    assert.deepEqual(await t.exportProject(), after);
  } finally {
    repository.close();
  }
});
