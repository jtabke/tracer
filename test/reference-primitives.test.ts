import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";
import type { Entity, Relationship } from "../src/core/model.ts";
const origin = { actor: "reference-test" };
const schema = {
  entityTypes: {
    need: { fields: {} },
    document: { fields: { title: { type: "string" as const } } },
  },
  relationshipTypes: {
    cites: { source: ["need"], target: [], resourceTarget: true, reference: true, fields: {} },
  },
};

test("resources, native scoped references and independent evaluation inputs survive changes, retries and reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-references-")),
    path = join(directory, "project.sqlite"),
    file = join(directory, "needs.md");
  let repo = new SQLiteRepository(path);
  try {
    const t = new Tracer(repo, undefined, observeLocal);
    await t.setSchema(schema, 0, origin);
    const a = await t.createEntity({ type: "need", fields: {} }, 1, origin),
      b = await t.createEntity({ type: "need", fields: {} }, 1, origin),
      out = await t.createEntity({ type: "need", fields: {} }, 1, origin);
    const command = {
      commandId: "reference-save",
      expectedSchemaVersion: 1,
      operations: [
        {
          op: "reference.create" as const,
          input: {
            type: "cites",
            source: a.id,
            sourceVersion: a.version,
            resource: {
              label: "User needs",
              source: { system: "file" as const, externalId: "needs-document" },
            },
            fields: {},
            reference: {
              role: "definition",
              selector: { kind: "section", value: "PN-01" },
              state: { mode: "current" as const },
            },
          },
        },
      ],
    };
    const first = await t.applyChangeset(command, origin),
      ref = first.results[0] as Relationship;
    assert.deepEqual(await t.applyChangeset(command, origin), first);
    const resource = await t.getEntity(ref.target);
    assert.equal(resource.type, "@resource");
    const second = await t.applyChangeset(
      {
        ...command,
        commandId: "second",
        operations: [
          {
            ...command.operations[0],
            input: {
              ...command.operations[0].input,
              source: b.id,
              reference: {
                ...command.operations[0].input.reference,
                role: "support",
                selector: { kind: "unknown-future-selector", value: { section: "PN-07" } },
              },
            },
          },
        ],
      },
      origin,
    );
    assert.equal((second.results[0] as Relationship).target, resource.id);
    assert.notEqual(second.results[0].id, ref.id);
    writeFileSync(file, "PN-01: need\nPN-07: evidence\n");
    const observation = await t.evidence.observe(
      { entityId: resource.id, locator: { system: "file", path: file } },
      origin,
    );
    const pinned = await t.updateRelationship(
      ref.id,
      ref.version,
      {
        ...ref,
        reference: { ...ref.reference!, state: { mode: "pinned", observationId: observation.id } },
      },
      1,
      origin,
    );
    const selectedContext = await t.getReference(pinned.id);
    assert.equal(selectedContext.sourceChanged, false);
    assert.equal(selectedContext.selectedObservation?.id, observation.id);
    assert.equal(selectedContext.passage, "unknown");
    const receipt = await t.evidence.recordReceipt(
      {
        outputId: out.id,
        outcome: "Simulated pass",
        inputs: [
          { entityId: resource.id, observationId: observation.id, role: "definition source" },
          { entityId: resource.id, facet: "native", role: "interpretation" },
        ],
        relationshipInputs: [
          { id: pinned.id, expectedVersion: pinned.version, role: "acceptance basis" },
        ],
      },
      origin,
    );
    assert.equal((await t.evidence.compareReceipt(receipt.id)).state, "current");
    assert.equal(receipt.inputs[0].contentRetention, "external-content-not-retained");
    assert.equal(receipt.inputs[1].contentRetention, "native-history");
    const token = (await t.evidence.compareReceipt(receipt.id)).token;
    await t.evidence.review(
      {
        receiptId: receipt.id,
        decision: "accepted",
        rationale: "Simulated assessment",
        expectedComparison: token,
      },
      origin,
    );
    const edited = await t.updateRelationship(
      pinned.id,
      pinned.version,
      { ...pinned, reference: { ...pinned.reference!, explanation: "Changed interpretation" } },
      1,
      origin,
    );
    const changed = await t.evidence.compareReceipt(receipt.id);
    assert.equal(changed.hasChanged, true);
    assert.equal(changed.relationshipInputs?.[0].hasChanged, true);
    assert.notEqual(changed.token, token);
    assert.equal(changed.review.state, "unreviewed");
    assert.deepEqual(await t.evidence.getReceipt(receipt.id), receipt);
    const promoted = await t.updateEntity(
      resource.id,
      resource.version,
      { type: "document", fields: resource.fields },
      1,
      origin,
    );
    assert.equal(promoted.id, resource.id);
    assert.deepEqual(promoted.resource, resource.resource);
    const moved = join(directory, "moved.md");
    writeFileSync(moved, "PN-01: need\nPN-07: revised\n");
    await t.evidence.observe(
      { entityId: resource.id, locator: { system: "file", path: moved } },
      origin,
    );
    assert.equal((await t.getRelationship(edited.id)).reference?.state.mode, "pinned");
    const driftedContext = await t.getReference(edited.id);
    assert.equal(driftedContext.sourceChanged, true);
    assert.equal(driftedContext.passage, "unknown");
    assert.equal(driftedContext.selectedObservation?.id, observation.id);
    const unknown = await t.evidence.observe(
      { entityId: resource.id, locator: { system: "file", path: join(directory, "missing.md") } },
      origin,
    );
    assert.equal(unknown.availability, "unknown");
    const unavailableContext = await t.getReference(edited.id);
    assert.equal(unavailableContext.sourceChanged, null);
    assert.equal(unavailableContext.latestObservation?.availability, "unknown");
    assert.equal(unavailableContext.selectedObservation?.id, observation.id);
    assert.equal((await t.evidence.compareReceipt(receipt.id)).hasUnknown, true);
    await assert.rejects(t.updateRelationship(edited.id, pinned.version, edited, 1, origin), {
      code: "conflict",
    });
    const baseline = await t.baselines.capture(
      {
        name: "Reference baseline",
        expectedProjectRevision: (await t.getProjectSnapshot()).projectRevision,
      },
      origin,
    );
    const contents = await t.baselines.contents({
      baselineId: baseline.id,
      kind: "entity",
      limit: 100,
    });
    assert.ok(contents.objects.items.some((e) => e.id === resource.id && (e as Entity).resource));
    const before = await t.exportProject();
    repo.close();
    repo = new SQLiteRepository(path);
    const reopened = new Tracer(repo);
    assert.deepEqual(await reopened.exportProject(), before);
    assert.deepEqual((await reopened.getRelationship(edited.id)).reference, edited.reference);
  } finally {
    repo.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("failed compound references roll back resources, reuse is serialized, and legacy permissions do not widen", async () => {
  const repo = new SQLiteRepository(":memory:"),
    t = new Tracer(repo);
  try {
    await t.setSchema(schema, 0, origin);
    const source = await t.createEntity({ type: "need", fields: {} }, 1, origin);
    const operation = {
      op: "reference.create" as const,
      input: {
        type: "cites",
        source: source.id,
        sourceVersion: source.version,
        resource: { label: "Shared", source: { system: "file" as const, externalId: "shared" } },
        fields: {},
        reference: { role: "support", state: { mode: "current" as const } },
      },
    };
    const before = await t.getProjectSnapshot();
    await assert.rejects(
      t.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: [{ ...operation, input: { ...operation.input, type: "missing" } }],
        },
        origin,
      ),
    );
    assert.deepEqual(await t.getProjectSnapshot(), before);
    const [a, b] = await Promise.all([
      t.applyChangeset({ expectedSchemaVersion: 1, operations: [operation] }, origin),
      t.applyChangeset({ expectedSchemaVersion: 1, operations: [operation] }, origin),
    ]);
    assert.equal((a.results[0] as Relationship).target, (b.results[0] as Relationship).target);
    const res = await t.getEntity((a.results[0] as Relationship).target);
    await assert.rejects(
      t.createEntity({ type: "@resource", resource: res.resource, fields: {} }, 1, origin),
      { code: "conflict" },
    );
    await assert.rejects(
      t.evidence.bindExternal(
        { entityId: source.id, system: "file", externalId: "shared", ownership: "external" },
        origin,
      ),
      { code: "conflict" },
    );
    await assert.rejects(
      t.setSchema(
        { ...schema, relationshipTypes: { cites: { source: ["need"], target: [], fields: {} } } },
        1,
        origin,
      ),
    );
    await assert.rejects(
      t.updateEntity(
        res.id,
        res.version,
        {
          fields: {},
          resource: { label: "Other", source: { system: "file", externalId: "changed" } },
        },
        1,
        origin,
      ),
    );
    const invalid = {
      ...operation,
      input: {
        ...operation.input,
        target: res.id,
        targetVersion: res.version,
        resource: undefined,
        reference: {
          role: "support",
          state: { mode: "pinned" as const, observationId: "missing" },
        },
      },
    };
    await assert.rejects(
      t.applyChangeset({ expectedSchemaVersion: 1, operations: [invalid] }, origin),
    );
  } finally {
    repo.close();
  }
});

test("native pins, relationship-only evaluations, tombstones and scoped impact preserve their distinct meanings", async () => {
  const repo = new SQLiteRepository(":memory:"),
    t = new Tracer(repo);
  try {
    await t.setSchema(schema, 0, origin);
    const source = await t.createEntity({ type: "need", fields: {} }, 1, origin),
      output = await t.createEntity({ type: "need", fields: {} }, 1, origin);
    const resource = await t.createEntity(
      {
        type: "@resource",
        resource: { label: "Native document" },
        fields: { text: "Original passage" },
      },
      1,
      origin,
    );
    const link = await t.createRelationship(
      {
        type: "cites",
        source: source.id,
        target: resource.id,
        fields: {},
        reference: {
          role: "definition",
          selector: { kind: "unsupported", value: { exact: "Original passage" } },
          state: { mode: "pinned", revision: resource.version },
        },
      },
      1,
      origin,
    );
    const context = await t.getReference(link.id);
    assert.equal(context.nativeVersion, 1);
    assert.equal(context.passage, "unknown");
    assert.equal(context.contentRetention, "native-history");
    const receipt = await t.evidence.recordReceipt(
      {
        outputId: output.id,
        outcome: "Simulated relation assessment",
        inputs: [],
        relationshipInputs: [
          { id: link.id, expectedVersion: link.version, role: "definition context" },
        ],
      },
      origin,
    );
    const baseline = await t.baselines.capture(
      {
        name: "Before reference change",
        expectedProjectRevision: (await t.getProjectSnapshot()).projectRevision,
      },
      origin,
    );
    const edited = await t.updateRelationship(
      link.id,
      link.version,
      {
        type: link.type,
        source: link.source,
        target: link.target,
        fields: {},
        reference: { ...link.reference!, role: "support" },
      },
      1,
      origin,
    );
    const impact = await t.getChangeImpact({
      baselineId: baseline.id,
      rootId: source.id,
      direction: "outgoing",
      relationshipTypes: ["cites"],
      depth: 1,
    });
    const match = impact.evaluations.items.find((e) => e.receipt.id === receipt.id);
    assert.ok(match);
    assert.equal(match.scope.hasChanged, true);
    assert.ok(match.scope.relationshipIds.includes(link.id));
    await t.removeRelationship(link.id, edited.version, 1, origin);
    const removed = await t.evidence.compareReceipt(receipt.id);
    assert.equal(removed.hasChanged, true);
    assert.equal(removed.hasUnknown, true);
    const historical = await t.evidence.recordReceipt(
      {
        outputId: output.id,
        outcome: "Historical relation assessment",
        inputs: [],
        relationshipInputs: [{ id: link.id, revision: 1 }],
      },
      origin,
    );
    assert.equal(historical.relationshipInputs![0].relationship.reference!.role, "definition");
    assert.deepEqual(
      (await t.getGraph({ rootId: resource.id, depth: 1 })).nodes.find((n) => n.id === resource.id)
        ?.resource,
      resource.resource,
    );
    const external = await t.createEntity(
      {
        type: "@resource",
        resource: { label: "External", source: { system: "file", externalId: "permanent-source" } },
        fields: {},
      },
      1,
      origin,
    );
    await t.removeEntity(external.id, external.version, 1, origin);
    await assert.rejects(
      t.createEntity({ type: "@resource", resource: external.resource, fields: {} }, 1, origin),
      { code: "conflict" },
    );
    await assert.rejects(
      t.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: [
            {
              op: "reference.create",
              input: {
                type: "cites",
                source: source.id,
                sourceVersion: source.version,
                resource: external.resource,
                fields: {},
                reference: { role: "support", state: { mode: "current" } },
              },
            },
          ],
        },
        origin,
      ),
      { code: "conflict" },
    );
  } finally {
    repo.close();
  }
});
