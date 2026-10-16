import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedScaleProject } from "../examples/seed-scale-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import type { ObjectQuery } from "../src/core/model.ts";

for (const scale of ["working", "large"] as const)
  test(`${scale} workload supports bounded search, scoped gaps, linking and dense connection context`, async () => {
    const parent = mkdtempSync(join(tmpdir(), "tracer-scale-test-"));
    const start = performance.now();
    let repository: SQLiteRepository | undefined;
    try {
      const project = await seedScaleProject(join(parent, "demo"), scale),
        seedMs = performance.now() - start;
      const inspection = new DatabaseSync(project.database, { readOnly: true });
      assert.equal(
        Number(inspection.prepare("SELECT COUNT(*) AS count FROM entities").get()!.count),
        project.tasks.entities,
      );
      assert.equal(
        Number(inspection.prepare("SELECT COUNT(*) AS count FROM relationships").get()!.count),
        project.tasks.links,
      );
      assert.equal(inspection.prepare("PRAGMA foreign_key_check").all().length, 0);
      inspection.close();
      repository = new SQLiteRepository(project.database);
      const tracer = new Tracer(repository);
      const head = (await tracer.timeline()).head;
      const scope: ObjectQuery = {
        type: "requirement",
        field: "subsystem",
        value: "Power",
        without: "verified_by",
        targetType: "test",
        limit: 50,
      };
      const durations = [];
      for (let index = 0; index < 10; index++) {
        const time = performance.now();
        await tracer.getWorkingSet(scope);
        durations.push(performance.now() - time);
      }
      const gaps = await tracer.getWorkingSet(scope);
      assert.equal(gaps.types.length, project.tasks.types);
      assert.equal(
        gaps.types.reduce((sum, item) => sum + item.count, 0),
        project.tasks.entities,
      );
      assert.equal(gaps.total, scale === "working" ? 8 : 72);
      const scoped = await tracer.getWorkingSet({ ...scope, search: project.tasks.gap });
      assert.equal(scoped.entities.items[0].key, project.tasks.gap);
      assert.equal(scoped.total, 1);
      const root = scoped.entities.items[0];
      const targets = await tracer.queryEntities({ type: "test", search: project.tasks.target });
      assert.equal(targets.items[0].key, project.tasks.target);
      const dense = (await tracer.queryEntities({ search: project.tasks.dense })).items[0];
      const connections = await tracer.getConnections({ id: dense.id, limit: 25 });
      assert.ok(connections.total > 200);
      assert.equal(connections.items.length, 25);
      assert.ok(connections.nextAfter);
      const next = await tracer.getConnections({
        id: dense.id,
        limit: 25,
        after: connections.nextAfter,
      });
      assert.ok(
        next.items.every(
          (item) =>
            !connections.items.some((first) => first.relationship.id === item.relationship.id),
        ),
      );
      const filtered = await tracer.getConnections({ id: dense.id, type: "implemented_by" });
      assert.equal(filtered.total, 1);
      assert.equal(filtered.items[0].target.type, "component");
      assert.equal((await tracer.timeline()).head, head);
      const prior = await tracer.evidence.compareReceipt(project.tasks.receipt);
      assert.equal(prior.state, "changed");
      await tracer.createRelationship(
        { type: "verified_by", source: root.id, target: targets.items[0].id, fields: {} },
        1,
        { actor: "scale-test" },
      );
      assert.equal((await tracer.getWorkingSet(scope)).total, gaps.total - 1);
      assert.equal((await tracer.getWorkingSet({ ...scope, search: project.tasks.gap })).total, 0);
      assert.equal((await tracer.getConnections({ id: root.id })).entity.id, root.id);
      assert.equal(
        (await tracer.evidence.compareReceipt(project.tasks.receipt)).token,
        prior.token,
      ); // Ordinary links do not manufacture evidence dependencies.
      durations.sort((a, b) => a - b);
      console.log(
        JSON.stringify({
          workload: scale,
          entities: project.tasks.entities,
          links: project.tasks.links,
          seedMs: Math.round(seedMs),
          scopedReadMaxMs: Number(durations.at(-1)!.toFixed(2)),
          denseConnections: connections.total,
        }),
      );
    } finally {
      repository?.close();
      rmSync(parent, { recursive: true, force: true });
    }
  });

test("working filters validate scope and search literal keys/text values without SQL wildcards", async () => {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository),
    actor = { actor: "test" };
  try {
    await tracer.setSchema(
      {
        entityTypes: {
          item: {
            fields: {
              name: { type: "string" },
              'part."code"': { type: "string" },
              numeric: { type: "number" },
            },
          },
          target: { fields: {} },
        },
        relationshipTypes: { verifies: { source: ["item"], target: ["target"], fields: {} } },
      },
      0,
      actor,
    );
    const entity = await tracer.createEntity(
      {
        type: "item",
        key: "LITERAL_%",
        fields: { name: "Searchable content", 'part."code"': "A_%" },
      },
      1,
      actor,
    );
    await tracer.createEntity(
      { type: "item", key: "OTHER", fields: { name: "Different content" } },
      1,
      actor,
    );
    assert.equal((await tracer.queryEntities({ search: "%" })).items[0].id, entity.id);
    assert.equal((await tracer.queryEntities({ search: "_" })).items.length, 1);
    assert.equal((await tracer.queryEntities({ search: "name" })).items.length, 0); // Field names themselves are not content.
    assert.equal((await tracer.queryEntities({ search: "searchable" })).items[0].id, entity.id);
    assert.equal(
      (await tracer.getWorkingSet({ type: "item", field: 'part."code"', value: "A_%" })).total,
      1,
    );
    for (const query of [
      { field: "name" },
      { type: "item", field: "name", value: "x", targetType: "target" },
      { type: "item", field: "numeric", value: "1" },
      { type: "item", without: "verifies", targetType: "item" },
      { without: "verifies", targetType: "target" },
      { type: "toString" },
      { search: "\ud800" },
      { search: "x".repeat(201) },
    ])
      await assert.rejects(async () => tracer.getWorkingSet(query), { code: "validation" });
    await assert.rejects(async () => tracer.getConnections({ id: entity.id, limit: 51 }), {
      code: "validation",
    });
    await assert.rejects(async () => tracer.getConnections({ id: entity.id, type: "toString" }), {
      code: "validation",
    });
  } finally {
    repository.close();
  }
});

test("scale seed refuses existing directories and preserves their files", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-scale-safety-"));
  try {
    writeFileSync(join(directory, "keep.txt"), "unchanged");
    await assert.rejects(seedScaleProject(directory));
    assert.equal(readFileSync(join(directory, "keep.txt"), "utf8"), "unchanged");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
