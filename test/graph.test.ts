import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";

const actor = { actor: "graph-test" };
async function fixture(work: (tracer: Tracer) => Promise<void>) {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    await tracer.setSchema(
      {
        entityTypes: { item: { fields: { title: { type: "string", required: true } } } },
        relationshipTypes: { references: { fields: {} } },
      },
      0,
      actor,
    );
    await work(tracer);
  } finally {
    repository.close();
  }
}
const create = (tracer: Tracer, key: string) =>
  tracer.createEntity({ type: "item", key, fields: { title: key } }, 1, actor);
const link = (tracer: Tracer, source: string, target: string) =>
  tracer.createRelationship({ type: "references", source, target, fields: {} }, 1, actor);

test("graph reads a bounded neighborhood with ordered expansion, cycles and immutable evaluation metadata", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "ROOT"),
      neighbor = await create(tracer, "NEIGHBOR"),
      hidden = await create(tracer, "HIDDEN"),
      unrelated = await create(tracer, "UNRELATED");
    const first = await link(tracer, root.id, neighbor.id),
      second = await link(tracer, neighbor.id, hidden.id);
    await link(tracer, neighbor.id, neighbor.id);
    await link(tracer, neighbor.id, root.id);
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: root.id,
        outcome: "Conclusion",
        inputs: [{ entityId: neighbor.id, path: [first.id] }],
      },
      actor,
    );
    await tracer.updateEntity(neighbor.id, 1, { fields: { title: "Changed neighbor" } }, 1, actor);
    const count = (await tracer.changesets()).length;
    const graph = await tracer.getGraph({ rootId: root.id });
    assert.deepEqual(
      new Set(graph.nodes.map((value) => value.id)),
      new Set([root.id, neighbor.id]),
    );
    assert.equal(graph.links.length, 2);
    assert.equal(graph.evaluations[0].receipt.id, receipt.id);
    assert.equal(graph.evaluations[0].comparison.state, "changed");
    assert.deepEqual(graph.evaluations[0].receipt.inputs[0].entity.fields, { title: "NEIGHBOR" });
    const expanded = await tracer.getGraph({ rootId: root.id, expanded: [neighbor.id] });
    assert.equal(expanded.nodes.length, 3);
    assert.equal(expanded.links.length, 4);
    assert.ok(expanded.links.some((value) => value.id === second.id));
    assert.deepEqual(expanded.expanded, [root.id, neighbor.id]);
    await tracer.updateEntity(unrelated.id, 1, { fields: { title: "Unrelated change" } }, 1, actor);
    assert.equal(
      (await tracer.getGraph({ rootId: root.id })).evaluations[0].comparison.state,
      "changed",
    );
    assert.equal((await tracer.changesets()).length, count + 1); // Graph reads never allocate revisions.
    await assert.rejects(tracer.getGraph({ rootId: root.id, expanded: [hidden.id] }), {
      code: "validation",
    });
    await assert.rejects(tracer.getGraph({ rootId: root.id, expanded: [unrelated.id] }), {
      code: "validation",
    });
    await assert.rejects(
      tracer.getGraph({ rootId: root.id, expanded: [neighbor.id, neighbor.id] }),
      { code: "validation" },
    );
    await assert.rejects(tracer.getGraph({ rootId: root.id, expanded: [root.id] }), {
      code: "validation",
    });
    await assert.rejects(tracer.getGraph({ rootId: "missing" }), { code: "not_found" });
    await assert.rejects(tracer.getGraph({ rootId: root.id, extra: true } as never), {
      code: "validation",
    });
  }));

test("receipt-only dependencies are visible and expandable without inventing ordinary links", () =>
  fixture(async (tracer) => {
    const output = await create(tracer, "OUTPUT"),
      input = await create(tracer, "INPUT"),
      extra = await create(tracer, "EXTRA");
    await link(tracer, input.id, extra.id);
    await tracer.evidence.recordReceipt(
      { outputId: output.id, outcome: "Conclusion", inputs: [{ entityId: input.id }] },
      actor,
    );
    const graph = await tracer.getGraph({ rootId: output.id });
    assert.deepEqual(new Set(graph.nodes.map((value) => value.id)), new Set([output.id, input.id]));
    assert.equal(graph.links.length, 0);
    const expanded = await tracer.getGraph({ rootId: output.id, expanded: [input.id] });
    assert.equal(expanded.nodes.length, 3);
    assert.equal(expanded.links.length, 1);
  }));

test("graph refuses node, edge, expansion and evaluation overflow rather than hiding data", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "ROOT"),
      dense = await create(tracer, "DENSE"),
      output = await create(tracer, "OUTPUT");
    for (let index = 0; index < 60; index++) {
      const node = await create(tracer, "N" + index);
      await link(tracer, root.id, node.id);
    }
    await assert.rejects(tracer.getGraph({ rootId: root.id }), /60 nodes/);
    for (let index = 0; index < 201; index++) await link(tracer, dense.id, dense.id);
    await assert.rejects(tracer.getGraph({ rootId: dense.id }), /200 connections/);
    await assert.rejects(
      tracer.getGraph({
        rootId: output.id,
        expanded: Array.from({ length: 21 }, (_, index) => String(index)),
      }),
      /20 distinct/,
    );
    for (let index = 0; index < 51; index++)
      await tracer.evidence.recordReceipt(
        { outputId: output.id, outcome: "Result " + index, inputs: [{ entityId: dense.id }] },
        actor,
      );
    await assert.rejects(tracer.getGraph({ rootId: output.id }), /50 evaluations/);
    const crowded = await create(tracer, "CROWDED");
    const inputs = (await tracer.queryEntities({ limit: 100 })).items
      .filter((node) => node.key?.startsWith("N"))
      .slice(0, 51)
      .map((node) => ({ entityId: node.id }));
    for (let index = 0; index < 4; index++)
      await tracer.evidence.recordReceipt(
        { outputId: crowded.id, outcome: "Many inputs " + index, inputs },
        actor,
      );
    await assert.rejects(tracer.getGraph({ rootId: crowded.id }), /200 declared inputs/);
  }));

test("receipt frontier remains one explicit expansion deep and deleted inputs do not become live nodes", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "ROOT"),
      input = await create(tracer, "INPUT"),
      downstream = await create(tracer, "DOWNSTREAM");
    await tracer.evidence.recordReceipt(
      { outputId: root.id, outcome: "Recorded root", inputs: [{ entityId: input.id }] },
      actor,
    );
    await tracer.evidence.recordReceipt(
      { outputId: input.id, outcome: "Recorded input", inputs: [{ entityId: downstream.id }] },
      actor,
    );
    const count = (await tracer.timeline()).head;
    const initial = await tracer.getGraph({ rootId: root.id });
    assert.deepEqual(new Set(initial.nodes.map((value) => value.id)), new Set([root.id, input.id]));
    const expanded = await tracer.getGraph({ rootId: root.id, expanded: [input.id] });
    assert.deepEqual(
      new Set(expanded.nodes.map((value) => value.id)),
      new Set([root.id, input.id, downstream.id]),
    );
    assert.equal((await tracer.timeline()).head, count);
    await tracer.removeEntity(input.id, input.version, 1, actor);
    const deleted = await tracer.getGraph({ rootId: root.id });
    assert.deepEqual(
      deleted.nodes.map((value) => value.id),
      [root.id],
    );
    assert.equal(deleted.evaluations[0].comparison.hasUnknown, true);
    assert.equal(deleted.evaluations[0].receipt.inputs[0].entityId, input.id);
  }));

test("configurable depth follows several levels, shared tests, incoming links and cycles without changing directions", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "INTENT"),
      requirement = await create(tracer, "REQUIREMENT"),
      sibling = await create(tracer, "SIBLING"),
      design = await create(tracer, "DESIGN"),
      testNode = await create(tracer, "TEST"),
      result = await create(tracer, "RESULT"),
      unrelated = await create(tracer, "UNRELATED");
    const links = [
      await link(tracer, requirement.id, root.id),
      await link(tracer, sibling.id, root.id),
      await link(tracer, requirement.id, design.id),
      await link(tracer, sibling.id, design.id),
      await link(tracer, design.id, testNode.id),
      await link(tracer, requirement.id, testNode.id),
      await link(tracer, testNode.id, result.id),
      await link(tracer, design.id, design.id),
      await link(tracer, design.id, requirement.id),
    ];
    const head = (await tracer.timeline()).head;
    const first = await tracer.getGraph({ rootId: root.id, depth: 1 });
    assert.deepEqual(
      new Set(first.nodes.map((node) => node.id)),
      new Set([root.id, requirement.id, sibling.id]),
    );
    assert.deepEqual(new Set(first.trace?.frontier), new Set([requirement.id, sibling.id]));
    assert.deepEqual(first.expanded, [root.id]);
    const second = await tracer.getGraph({ rootId: root.id, depth: 2 });
    assert.equal(second.nodes.length, 5);
    assert.ok(!second.nodes.some((node) => node.id === result.id));
    assert.deepEqual(new Set(second.trace?.frontier), new Set([design.id, testNode.id]));
    const third = await tracer.getGraph({ rootId: root.id, depth: 3 });
    assert.equal(third.nodes.length, 6);
    assert.equal(third.links.length, links.length);
    assert.equal(third.nodes.filter((node) => node.id === design.id).length, 1);
    assert.equal(third.nodes.filter((node) => node.id === testNode.id).length, 1);
    assert.deepEqual(new Set(third.trace?.frontier), new Set([result.id]));
    const complete = await tracer.getGraph({ rootId: root.id, depth: 6 });
    assert.deepEqual(complete.trace, { depth: 6, frontier: [] });
    assert.equal(complete.nodes.length, 6);
    assert.deepEqual(
      new Set(complete.links.map((value) => value.id)),
      new Set(links.map((value) => value.id)),
    );
    for (const original of links)
      assert.deepEqual(
        complete.links.find((value) => value.id === original.id),
        original,
      );
    assert.ok(!complete.nodes.some((node) => node.id === unrelated.id));
    assert.equal((await tracer.timeline()).head, head);
    const manual = await tracer.getGraph({
      rootId: root.id,
      depth: 1,
      expanded: [requirement.id, design.id],
    });
    assert.ok(manual.expanded.includes(design.id));
    assert.ok(!manual.trace?.frontier.includes(requirement.id));
    assert.deepEqual(new Set(manual.trace?.frontier), new Set([sibling.id, testNode.id]));
  }));

test("depth validation rejects malformed and excessive values without writes", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "ROOT");
    const head = (await tracer.timeline()).head;
    for (const depth of [0, -1, 1.5, 7, NaN, Infinity, "2", null])
      await assert.rejects(tracer.getGraph({ rootId: root.id, depth } as never), {
        code: "validation",
      });
    for (const depth of [1, 6]) {
      const graph = await tracer.getGraph({ rootId: root.id, depth });
      assert.deepEqual(graph.trace, { depth, frontier: [] });
      assert.equal(graph.nodes.length, 1);
    }
    await assert.rejects(tracer.getGraph({ rootId: root.id, depth: 2, expanded: ["unreached"] }), {
      code: "validation",
    });
    assert.equal((await tracer.timeline()).head, head);
  }));

test("depth respects historical snapshots, tombstones and comparison unions", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "ROOT"),
      requirement = await create(tracer, "REQUIREMENT"),
      design = await create(tracer, "DESIGN"),
      testNode = await create(tracer, "TEST");
    await link(tracer, root.id, requirement.id);
    await link(tracer, requirement.id, design.id);
    const testLink = await link(tracer, design.id, testNode.id);
    const before = (await tracer.timeline()).head;
    await tracer.updateEntity(design.id, 1, { fields: { title: "Updated design" } }, 1, actor);
    await tracer.removeEntity(testNode.id, 1, 1, actor, true);
    const head = (await tracer.timeline()).head;
    const oldGraph = await tracer.getGraph({ rootId: root.id, depth: 3, atRevision: before });
    assert.equal(oldGraph.nodes.length, 4);
    assert.equal(oldGraph.nodes.find((node) => node.id === design.id)?.fields.title, "DESIGN");
    assert.equal(oldGraph.links.length, 3);
    const currentGraph = await tracer.getGraph({ rootId: root.id, depth: 3, atRevision: head });
    assert.equal(currentGraph.nodes.length, 3);
    assert.equal(currentGraph.nodes.find((node) => node.id === design.id)?.version, 2);
    assert.deepEqual(currentGraph.trace?.frontier, []);
    const comparison = await tracer.getGraph({
      rootId: root.id,
      depth: 3,
      atRevision: head,
      compareRevision: before,
    });
    assert.equal(comparison.nodes.length, 4);
    assert.equal(
      comparison.differences?.nodes.find((node) => node.id === testNode.id)?.state,
      "removed",
    );
    assert.equal(
      comparison.differences?.links.find((value) => value.id === testLink.id)?.state,
      "removed",
    );
    assert.deepEqual(comparison.evaluations, []);
    assert.equal((await tracer.timeline()).head, head);
  }));

test("ordinary depth retains explicit receipt frontier without inventing or recursively following native links", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "ROOT"),
      input = await create(tracer, "RECEIPT-INPUT"),
      hidden = await create(tracer, "BEYOND-RECEIPT");
    await link(tracer, input.id, hidden.id);
    await tracer.evidence.recordReceipt(
      { outputId: root.id, outcome: "Recorded result", inputs: [{ entityId: input.id }] },
      actor,
    );
    const graph = await tracer.getGraph({ rootId: root.id, depth: 6 });
    assert.deepEqual(new Set(graph.nodes.map((node) => node.id)), new Set([root.id, input.id]));
    assert.equal(graph.links.length, 0);
    assert.deepEqual(graph.trace?.frontier, []);
    assert.ok(!graph.expanded.includes(input.id));
    const expanded = await tracer.getGraph({ rootId: root.id, depth: 6, expanded: [input.id] });
    assert.equal(expanded.nodes.length, 3);
    assert.equal(expanded.links.length, 1);
  }));

test("explicit depth retains incident and total bounds and fails visibly rather than truncating", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "ROOT");
    const first = await create(tracer, "FIRST");
    await link(tracer, root.id, first.id);
    for (let index = 0; index < 199; index++) {
      const node = await create(tracer, "N" + index);
      await link(tracer, first.id, node.id);
    }
    const initial = await tracer.getGraph({ rootId: root.id, depth: 1 });
    assert.equal(initial.nodes.length, 2);
    await assert.rejects(tracer.getGraph({ rootId: root.id, depth: 2 }), /200 nodes/);
    const crowded = await create(tracer, "CROWDED");
    for (let index = 0; index < 201; index++) await link(tracer, crowded.id, crowded.id);
    await assert.rejects(tracer.getGraph({ rootId: crowded.id, depth: 1 }), /200 connections/);
    const wide = await create(tracer, "WIDE");
    for (let branch = 0; branch < 4; branch++) {
      const node = await create(tracer, "BRANCH" + branch);
      await link(tracer, wide.id, node.id);
      for (let index = 0; index < 160; index++) await link(tracer, node.id, node.id);
    }
    const head = (await tracer.timeline()).head;
    await assert.rejects(tracer.getGraph({ rootId: wide.id, depth: 2 }), /600 connections/);
    assert.equal((await tracer.timeline()).head, head);
  }));

test("historical depth comparison rejects an oversized union even when both snapshots fit", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "ROOT");
    const oldLinks = [];
    for (let index = 0; index < 101; index++) {
      const node = await create(tracer, "OLD" + index);
      oldLinks.push(await link(tracer, root.id, node.id));
    }
    const before = (await tracer.timeline()).head;
    for (const value of oldLinks) await tracer.removeRelationship(value.id, 1, 1, actor);
    for (let index = 0; index < 101; index++) {
      const node = await create(tracer, "NEW" + index);
      await link(tracer, root.id, node.id);
    }
    const head = (await tracer.timeline()).head;
    for (const atRevision of [before, head]) {
      const graph = await tracer.getGraph({ rootId: root.id, depth: 1, atRevision });
      assert.equal(graph.nodes.length, 102);
    }
    await assert.rejects(
      tracer.getGraph({ rootId: root.id, depth: 1, atRevision: head, compareRevision: before }),
      /Comparison exceeds 200 nodes \/ 600 connections/,
    );
    assert.equal((await tracer.timeline()).head, head);
  }));

test("historical absence retains requested depth for an informative empty read and comparison layout", () =>
  fixture(async (tracer) => {
    const root = await create(tracer, "ROOT"),
      requirement = await create(tracer, "REQUIREMENT"),
      design = await create(tracer, "DESIGN");
    await link(tracer, root.id, requirement.id);
    await link(tracer, requirement.id, design.id);
    const before = (await tracer.timeline()).head;
    await tracer.removeEntity(root.id, 1, 1, actor, true);
    const head = (await tracer.timeline()).head;
    const empty = await tracer.getGraph({ rootId: root.id, depth: 2, atRevision: head });
    assert.deepEqual(empty.trace, { depth: 2, frontier: [] });
    assert.deepEqual(empty.nodes, []);
    const compared = await tracer.getGraph({
      rootId: root.id,
      depth: 2,
      atRevision: head,
      compareRevision: before,
    });
    assert.equal(compared.trace?.depth, 2);
    assert.equal(compared.nodes.length, 3);
    assert.equal(compared.differences?.nodes.find((node) => node.id === root.id)?.state, "removed");
    assert.equal((await tracer.timeline()).head, head);
  }));
