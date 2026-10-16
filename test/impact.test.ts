import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import type { ChangeImpactQuery } from "../src/core/impact.ts";
import type { Operation } from "../src/application/commands.ts";
import type { Entity, Schema } from "../src/core/model.ts";

const actor = { actor: "impact-domain-qa" };
const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const schema: Schema = {
  entityTypes: { item: { fields: { title: { type: "string" }, note: { type: "string" } } } },
  relationshipTypes: {
    dependency: { fields: { note: { type: "string" } } },
    references: { fields: {} },
  },
};
async function fixture() {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository);
  await tracer.setSchema(schema, 0, actor);
  return { repository, tracer };
}
async function items(tracer: Tracer, count: number) {
  const result = await tracer.applyChangeset(
    {
      expectedSchemaVersion: 1,
      operations: Array.from({ length: count }, (_, i): Operation => ({
        op: "entity.create",
        id: uuid(i + 1),
        input: { type: "item", key: `ITEM-${i + 1}`, fields: { title: `Item ${i + 1}` } },
      })),
    },
    actor,
  );
  return result.results as Entity[];
}
async function links(tracer: Tracer, pairs: [number, number, number, string?][]) {
  await tracer.applyChangeset(
    {
      expectedSchemaVersion: 1,
      operations: pairs.map(([id, source, target, type]): Operation => ({
        op: "relationship.create",
        id: uuid(id),
        input: {
          type: type ?? "dependency",
          source: uuid(source),
          target: uuid(target),
          fields: {},
        },
      })),
    },
    actor,
  );
}
const baseline = async (tracer: Tracer) =>
  tracer.baselines.capture(
    { name: "Native impact boundary", expectedProjectRevision: (await tracer.timeline()).head },
    actor,
  );
const query = (
  baselineId: string,
  rootId = uuid(1),
  extra: Partial<ChangeImpactQuery> = {},
): ChangeImpactQuery => ({
  baselineId,
  rootId,
  direction: "outgoing",
  relationshipTypes: ["dependency"],
  ...extra,
});
const record = (tracer: Tracer, outputId: string, inputId: string) =>
  tracer.evidence.recordReceipt(
    { outputId, outcome: "Recorded outcome", inputs: [{ entityId: inputId }] },
    actor,
  );

test("impact traverses separate native snapshots with canonical shared/cyclic paths and distinguishes leaving scope from deletion", async () => {
  const { repository, tracer } = await fixture();
  try {
    const nodes = await items(tracer, 8);
    await links(tracer, [
      [101, 1, 2],
      [102, 1, 2],
      [103, 1, 3],
      [104, 2, 4],
      [105, 3, 4],
      [106, 4, 1],
      [107, 4, 4],
      [108, 1, 5],
      [109, 6, 1],
      [110, 1, 7, "references"],
      [111, 2, 8],
    ]);
    const captured = await baseline(tracer);
    await tracer.updateRelationship(
      uuid(108),
      1,
      { type: "dependency", source: uuid(7), target: uuid(5), fields: {} },
      1,
      actor,
    );
    await tracer.updateEntity(
      uuid(5),
      1,
      { fields: { title: "Still exists outside current selected neighborhood" } },
      1,
      actor,
    );
    const before = await tracer.history();
    const result = await tracer.getChangeImpact(query(captured.id));
    assert.equal(result.scope.depth, 2);
    assert.equal(
      new Set(result.native.entities.map((node) => node.id)).size,
      result.native.entities.length,
    );
    assert.deepEqual(
      result.native.before.paths.find((path) => path.entityId === uuid(4)),
      { entityId: uuid(4), depth: 2, relationshipIds: [uuid(101), uuid(104)] },
    );
    assert.ok(
      result.native.before.frontierIds.includes(uuid(8)),
      "unexpanded leaf is a boundary, not proof of extra links",
    );
    assert.ok(!result.native.after.paths.some((path) => path.entityId === uuid(5)));
    const moved = result.native.relationships.find((link) => link.id === uuid(108))!;
    assert.equal(moved.state, "modified");
    assert.equal(moved.before?.source, uuid(1));
    assert.equal(moved.after?.source, uuid(7));
    const departed = result.native.entities.find((node) => node.id === uuid(5))!;
    assert.equal(departed.state, "modified");
    assert.deepEqual(departed.before, nodes[4]);
    assert.equal(departed.after?.version, 2);
    assert.ok(
      !result.native.entities.some((node) => node.id === uuid(7)),
      "off-scope counterpart endpoint does not inflate reached identities",
    );
    const incoming = await tracer.getChangeImpact(
      query(captured.id, uuid(1), { direction: "incoming", depth: 1 }),
    );
    assert.deepEqual(
      incoming.native.before.paths.map((path) => path.entityId).sort(),
      [uuid(1), uuid(4), uuid(6)].sort(),
    );
    assert.equal(
      incoming.native.relationships.find((link) => link.id === uuid(109))?.after?.source,
      uuid(6),
    );
    const cyclic = await tracer.getChangeImpact(
      query(captured.id, uuid(1), { direction: "both", depth: 6 }),
    );
    assert.equal(
      new Set(cyclic.native.before.paths.map((path) => path.entityId)).size,
      cyclic.native.before.paths.length,
    );
    assert.equal(cyclic.native.before.frontierIds.length, 0);
    const rootOnly = await tracer.getChangeImpact(
      query(captured.id, uuid(1), { relationshipTypes: [] }),
    );
    assert.deepEqual(
      rootOnly.native.entities.map((node) => node.id),
      [uuid(1)],
    );
    assert.deepEqual(rootOnly.native.relationships, []);
    assert.deepEqual(await tracer.history(), before);
  } finally {
    repository.close();
  }
});

test("impact preserves declared fields, historical/configuration pins and scoped state independently of full receipt drift", async () => {
  const { repository, tracer } = await fixture();
  try {
    const [root, other, output, middle, adjacent] = await items(tracer, 5);
    await links(tracer, [
      [101, 3, 4],
      [102, 4, 1],
      [103, 1, 5, "references"],
    ]);
    const direct = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        outcome: "PASS",
        inputs: [{ entityId: root.id, fields: ["title"] }, { entityId: other.id }],
      },
      actor,
    );
    const pathReceipt = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        outcome: "PASS with explicit path",
        inputs: [{ entityId: root.id, fields: ["title"], path: [uuid(101), uuid(102)] }],
      },
      actor,
    );
    const historic = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        outcome: "Exact version",
        inputs: [{ entityId: root.id, revision: 1 }],
      },
      actor,
    );
    const config = await tracer.configurations.capture(
      {
        name: "Explicit pin",
        subjectId: output.id,
        expectedSubjectVersion: 1,
        members: [{ entityId: root.id, version: 1 }],
      },
      actor,
    );
    const pinned = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        configurationId: config.id,
        outcome: "Configuration inputs",
        inputs: [{ entityId: root.id }],
      },
      actor,
    );
    const unrelated = await record(tracer, output.id, adjacent.id);
    await tracer.updateEntity(
      root.id,
      1,
      { fields: { title: root.fields.title, note: "Changed before native baseline" } },
      1,
      actor,
    );
    const captured = await baseline(tracer),
      scopedQuery = query(captured.id, root.id, { relationshipTypes: [] });
    const initial = await tracer.getChangeImpact(scopedQuery);
    assert.equal(initial.native.entities[0].state, "unchanged");
    assert.equal(
      initial.evaluations.items.find((item) => item.receipt.id === historic.id)?.scope.state,
      "changed",
      "capture drift predating the native baseline remains capture drift",
    );
    assert.equal(
      initial.evaluations.items.find((item) => item.receipt.id === pinned.id)?.receipt.inputs[0].pin
        ?.entity.version,
      1,
    );
    await tracer.updateEntity(
      other.id,
      1,
      { fields: { title: "Unrelated declared input changed" } },
      1,
      actor,
    );
    await tracer.updateEntity(
      middle.id,
      1,
      { fields: { title: "Path-only intermediate annotation changed" } },
      1,
      actor,
    );
    await tracer.updateEntity(
      output.id,
      1,
      { fields: { title: "Output title changed" } },
      1,
      actor,
    );
    const result = await tracer.getChangeImpact(scopedQuery);
    const scoped = result.evaluations.items.find((item) => item.receipt.id === direct.id)!;
    assert.equal(scoped.scope.state, "current");
    assert.equal(scoped.scope.hasChanged, false);
    assert.equal(scoped.comparison.state, "changed");
    assert.deepEqual(scoped.scope.inputIds, [root.id]);
    assert.equal(
      result.evaluations.items.find((item) => item.receipt.id === pathReceipt.id)?.scope.state,
      "current",
    );
    assert.ok(!result.evaluations.items.some((item) => item.receipt.id === unrelated.id));
    assert.deepEqual(result.summary, {
      scope: "page",
      evaluated: 4,
      current: 2,
      changed: 2,
      unknown: 0,
    });
    await tracer.removeEntity(root.id, 2, 1, actor, true);
    const deleted = await tracer.getChangeImpact(scopedQuery);
    assert.equal(deleted.native.entities[0].state, "removed");
    const pathDrift = deleted.evaluations.items.find((item) => item.receipt.id === pathReceipt.id)!;
    assert.equal(pathDrift.scope.hasUnknown, true);
    assert.equal(pathDrift.comparison.hasChanged, true);
    assert.equal(
      pathDrift.scope.hasChanged,
      false,
      "removed unselected path is full comparison drift, not selected native scope drift",
    );
    assert.equal(pathDrift.scope.state, "unknown");
    assert.equal(pathDrift.receipt.outcome, "PASS with explicit path");
    assert.deepEqual(await tracer.evidence.getReceipt(pathReceipt.id), pathReceipt);
    await assert.rejects(
      tracer.getChangeImpact(query(captured.id, uuid(999), { relationshipTypes: [] })),
      { code: "not_found" },
    );
  } finally {
    repository.close();
  }
});

test("link-only impact excludes terminal content and unselected path drift while retaining the full comparison", async () => {
  const { repository, tracer } = await fixture();
  try {
    const [middle1, middle2, terminal, output] = await items(tracer, 4);
    await links(tracer, [
      [101, 4, 1],
      [102, 1, 2],
      [103, 2, 3],
    ]);
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        outcome: "Captured",
        inputs: [{ entityId: terminal.id, path: [uuid(101), uuid(102), uuid(103)] }],
      },
      actor,
    );
    const captured = await baseline(tracer),
      scopedQuery = query(captured.id, middle1.id, { depth: 1 });
    await tracer.updateEntity(
      terminal.id,
      1,
      { fields: { title: "Changed outside selected depth" } },
      1,
      actor,
    );
    await tracer.updateRelationship(
      uuid(101),
      1,
      {
        type: "dependency",
        source: output.id,
        target: middle1.id,
        fields: { note: "Unselected captured link changed" },
      },
      1,
      actor,
    );
    const result = await tracer.getChangeImpact(scopedQuery),
      selected = result.evaluations.items[0];
    assert.deepEqual(
      result.native.entities.map((node) => node.id).sort(),
      [middle1.id, middle2.id].sort(),
    );
    assert.equal(selected.receipt.id, receipt.id);
    assert.equal(selected.comparison.state, "changed");
    assert.equal(selected.scope.state, "current");
    assert.equal(selected.scope.hasChanged, false);
    assert.deepEqual(selected.scope.relationshipIds, [uuid(102)]);
    await tracer.removeEntity(terminal.id, 2, 1, actor, true);
    const unresolved = (await tracer.getChangeImpact(scopedQuery)).evaluations.items[0];
    assert.equal(unresolved.comparison.hasUnknown, true);
    assert.equal(unresolved.scope.state, "current");
    assert.equal(
      unresolved.scope.hasUnknown,
      false,
      "unselected terminal availability is full comparison context only",
    );
    await tracer.updateRelationship(
      uuid(102),
      1,
      {
        type: "dependency",
        source: middle1.id,
        target: middle2.id,
        fields: { note: "Selected captured link changed" },
      },
      1,
      actor,
    );
    const changed = (await tracer.getChangeImpact(scopedQuery)).evaluations.items[0];
    assert.equal(changed.scope.state, "changed");
    assert.equal(changed.scope.hasChanged, true);
    assert.equal(changed.scope.hasUnknown, false);
  } finally {
    repository.close();
  }
});

test("impact discovers declared inputs beyond global evidence pages and binds continuations to every evidence/native append", async () => {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository, undefined, async () => ({
      availability: "available",
      hash: "sha256:" + "a".repeat(64),
    }));
  try {
    await tracer.setSchema(schema, 0, actor);
    const [root, other, output] = await items(tracer, 3);
    await tracer.evidence.bindExternal(
      {
        entityId: other.id,
        system: "file",
        externalId: "clock-only-source",
        ownership: "external",
      },
      actor,
    );
    // Irrelevant captures precede all matches; output identity is not an implicit dependency.
    for (let index = 0; index < 1005; index++) await record(tracer, root.id, output.id);
    const first = await record(tracer, output.id, root.id);
    await record(tracer, output.id, root.id);
    for (let index = 0; index < 5; index++)
      await tracer.evidence.recordReceipt(
        {
          outputId: output.id,
          outcome: "Superseding capture",
          inputs: [{ entityId: root.id }],
          supersedes: first.id,
        },
        actor,
      );
    const captured = await baseline(tracer),
      scopedQuery = query(captured.id, root.id, { relationshipTypes: [], limit: 1 });
    const result = await tracer.getChangeImpact(scopedQuery);
    assert.equal(result.evaluations.items[0].receipt.id, first.id);
    assert.deepEqual(result.summary, {
      scope: "page",
      evaluated: 1,
      current: 1,
      changed: 0,
      unknown: 0,
    });
    assert.equal(result.evaluations.items[0].supersession.count, 5);
    assert.equal(result.evaluations.items[0].supersession.ids.length, 3);
    assert.equal(new Set(result.evaluations.items[0].supersession.ids).size, 3);
    assert.ok(result.evaluations.nextAfter);
    const continuation = await tracer.getChangeImpact({
      ...scopedQuery,
      after: result.evaluations.nextAfter,
      limit: 25,
    });
    assert.equal(continuation.evaluations.items.length, 6);
    const nativeHead = (await tracer.timeline()).head;
    for (const append of [
      () => record(tracer, output.id, root.id),
      async () => {
        const compared = await tracer.evidence.compareReceipt(first.id);
        await tracer.evidence.review(
          {
            receiptId: first.id,
            decision: "accepted",
            rationale: "Explicit unchanged input",
            expectedComparison: compared.token,
          },
          actor,
        );
      },
      () =>
        tracer.evidence.observe(
          {
            entityId: other.id,
            locator: { system: "file", path: "/isolated-observer-does-not-read-disk" },
          },
          actor,
        ),
    ]) {
      const page = await tracer.getChangeImpact(scopedQuery);
      await append();
      assert.equal((await tracer.timeline()).head, nativeHead);
      await assert.rejects(
        tracer.getChangeImpact({ ...scopedQuery, after: page.evaluations.nextAfter }),
        { code: "conflict" },
      );
      assert.ok(
        (await tracer.getChangeImpact(scopedQuery)).context.evidenceRevision >
          page.context.evidenceRevision,
      );
    }
    const page = await tracer.getChangeImpact(scopedQuery);
    await tracer.updateEntity(
      output.id,
      1,
      { fields: { title: "Native clock advances" } },
      1,
      actor,
    );
    await assert.rejects(
      tracer.getChangeImpact({ ...scopedQuery, after: page.evaluations.nextAfter }),
      { code: "conflict" },
    );
    await assert.rejects(
      tracer.getChangeImpact({ ...scopedQuery, expectedProjectRevision: nativeHead }),
      { code: "conflict" },
    );
    const unchanged = await tracer.history(),
      evidence = await tracer.evidence.list("receipt", { limit: 1000 });
    await tracer.getChangeImpact(scopedQuery);
    assert.deepEqual(await tracer.history(), unchanged);
    assert.deepEqual(await tracer.evidence.list("receipt", { limit: 1000 }), evidence);
  } finally {
    repository.close();
  }
});

test("impact enforces captured-input comparison budgets and exact traversal caps without partial success", async () => {
  const { repository, tracer } = await fixture();
  try {
    const nodes = await items(tracer, 202);
    const captured = await baseline(tracer);
    for (let index = 0; index < 3; index++)
      await tracer.evidence.recordReceipt(
        {
          outputId: nodes[201].id,
          outcome: "Large declared set",
          inputs: nodes.slice(0, 100).map((node) => ({ entityId: node.id })),
        },
        actor,
      );
    const scopedQuery = query(captured.id, nodes[0].id, { relationshipTypes: [] });
    await assert.rejects(tracer.getChangeImpact({ ...scopedQuery, limit: 3 }), {
      code: "validation",
    });
    const narrowed = await tracer.getChangeImpact({ ...scopedQuery, limit: 2 });
    assert.equal(narrowed.evaluations.items.length, 2);
    assert.equal(narrowed.evaluations.items.flatMap((item) => item.comparison.inputs).length, 200);
    await links(
      tracer,
      Array.from({ length: 199 }, (_, i) => [1001 + i, 1, i + 2]),
    );
    assert.equal(
      (await tracer.getChangeImpact(query(captured.id, nodes[0].id, { limit: 1, depth: 1 }))).native
        .entities.length,
      200,
    );
    await links(tracer, [[2001, 1, 201]]);
    await assert.rejects(
      tracer.getChangeImpact(query(captured.id, nodes[0].id, { limit: 1, depth: 1 })),
      { code: "validation" },
    );
    await links(tracer, [[2002, 1, 202]]);
    await assert.rejects(
      tracer.getChangeImpact(query(captured.id, nodes[0].id, { limit: 1, depth: 1 })),
      { code: "validation", message: /200 selected connections/ },
    );
    const before = await tracer.history();
    for (const extra of [
      { depth: 0 },
      { depth: 7 },
      { limit: 0 },
      { limit: 26 },
      { relationshipTypes: ["dependency", "dependency"] },
      { relationshipTypes: ["missing"] },
      { direction: "sideways" },
      { unrecognized: true },
    ])
      await assert.rejects(
        tracer.getChangeImpact({ ...scopedQuery, ...extra } as ChangeImpactQuery),
        { code: "validation" },
      );
    assert.deepEqual(await tracer.history(), before);
  } finally {
    repository.close();
  }
});

test("impact accepts exactly six hundred selected native links but rejects the next without inflating shared identities", async () => {
  const { repository, tracer } = await fixture();
  try {
    await items(tracer, 4);
    const captured = await baseline(tracer);
    await links(tracer, [
      [101, 1, 2],
      [102, 1, 3],
      [103, 1, 4],
      ...Array.from({ length: 597 }, (_, i): [number, number, number] => {
        const source = Math.floor(i / 199) + 2;
        return [1001 + i, source, source === 4 ? 2 : source + 1];
      }),
    ]);
    const result = await tracer.getChangeImpact(query(captured.id));
    assert.equal(result.native.relationships.length, 600);
    assert.equal(result.native.entities.length, 4);
    assert.equal(result.native.after.paths.length, 4);
    await links(tracer, [[2001, 2, 3]]);
    const before = await tracer.history();
    await assert.rejects(tracer.getChangeImpact(query(captured.id)), {
      code: "validation",
      message: /600 connections/,
    });
    const narrowed = await tracer.getChangeImpact(query(captured.id, uuid(1), { depth: 1 }));
    assert.equal(narrowed.native.relationships.length, 3);
    assert.deepEqual(await tracer.history(), before);
  } finally {
    repository.close();
  }
});

test("unavailable historical native endpoints fail impact instead of becoming empty or current evidence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-impact-unavailable-")),
    file = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(file);
  try {
    let tracer = new Tracer(repository);
    await tracer.setSchema(schema, 0, actor);
    await items(tracer, 2);
    await links(tracer, [[101, 1, 2]]);
    const captured = await baseline(tracer);
    repository.close();
    const raw = new DatabaseSync(file);
    raw
      .prepare("UPDATE object_revisions SET snapshot_json=NULL WHERE kind='entity' AND object_id=?")
      .run(uuid(2));
    raw.close();
    repository = new SQLiteRepository(file);
    tracer = new Tracer(repository);
    const before = await tracer.history();
    await assert.rejects(tracer.getChangeImpact(query(captured.id)), {
      code: "referential_integrity",
    });
    assert.deepEqual(await tracer.history(), before);
  } finally {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
