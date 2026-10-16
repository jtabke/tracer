import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Receipt, Review } from "../src/core/evidence.ts";
import type { Entity } from "../src/core/model.ts";
import type { WorkingContext, WorkingContextQuery } from "../src/core/working-context.ts";
import type { Repository, Transaction } from "../src/persistence/contracts.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import {
  actor,
  clocks,
  fixture,
  link,
  orbit,
  query,
  captureReceipt,
  schema,
  uuid,
} from "./working-context-fixture.ts";
import type { WorkingFixture } from "./working-context-fixture.ts";

function receipt(result: WorkingContext, id: string) {
  const value = result.receipts.page.items.find((entry) => entry.receipt.id === id);
  assert.ok(value, `Expected related receipt ${id}`);
  return value;
}
function guarded(repository: Repository, change: (tx: Transaction) => Transaction): Repository {
  return {
    transaction: (work) => repository.transaction((tx) => work(change(tx))),
    close: () => repository.close(),
  };
}
const ids = (values: { id: string }[]) => values.map((value) => value.id).sort();

test("authoring a previously empty incoming scope uses native endpoint guards and preserves the saved unlinked identity", async () => {
  const f = await fixture(),
    e = f.entities;
  try {
    const q = query(f, { recipe: { members: query(f).recipe.members, routes: [] } });
    const empty = await f.tracer.getWorkingContext(q);
    assert.equal(empty.rows.total, 0);
    assert.deepEqual(empty.rows.page.items, []);
    assert.deepEqual(empty.schema.relationshipTypes.realized_by.source, ["requirement"]);
    const saved = await f.tracer.createEntity(
      { type: "requirement", key: "NEW-REQ", fields: { title: "Saved independently" } },
      1,
      actor,
    );
    assert.equal((await f.tracer.getWorkingContext(q)).rows.total, 0);
    assert.deepEqual((await f.tracer.getNativePin(saved.id, saved.version)).entity, saved);
    await assert.rejects(link(f, "realized_by", e.aux, e.focus), { code: "validation" });
    const connection = await link(f, "realized_by", saved, e.focus);
    const before = await clocks(f),
      connected = await f.tracer.getWorkingContext(q);
    assert.equal(connected.rows.total, 1);
    assert.deepEqual(connected.rows.page.items, [{ entity: saved, membership: [connection] }]);
    assert.deepEqual(await clocks(f), before);
    assert.deepEqual((await f.tracer.getNativePin(saved.id, saved.version)).entity, saved);
  } finally {
    f.repository.close();
  }
});

test("Orbit context deduplicates rows and receipts while retaining parallel memberships and unmatched output captures", async () => {
  const f = await orbit(),
    e = f.entities;
  try {
    const matched = await captureReceipt(f, e.evalA, [e.focus, e.aux]);
    const unmatched = await captureReceipt(f, e.evalA, [e.aux]);
    const declaredElsewhere = await captureReceipt(f, e.evalOther, [e.focus]);
    const rowDeclared = await captureReceipt(f, e.evalOther, [e.rowA]);
    const first = await link(f, "dependency", e.evalOther, e.rowA);
    const last = await link(f, "dependency", e.focus, e.otherAux);
    const linkOnly = await f.tracer.evidence.recordReceipt(
      {
        outputId: e.evalOther.id,
        outcome: "Only an intermediate mention of the focus and row",
        inputs: [{ entityId: e.otherAux.id, path: [first.id, f.memberships[0].id, last.id] }],
      },
      actor,
    );
    const before = await clocks(f);
    const result = await f.tracer.getWorkingContext(query(f, { receipts: { limit: 20 } }));
    assert.equal(result.rows.total, 2);
    assert.deepEqual(
      result.rows.page.items.map((row) => row.entity.id),
      [e.rowA.id, e.rowB.id],
    );
    assert.deepEqual(ids(result.rows.page.items[0].membership), ids(f.memberships.slice(0, 2)));
    assert.equal(result.receipts.scope, "focus-and-loaded-rows");
    assert.equal(result.receipts.total, 4);
    assert.deepEqual(
      ids(result.receipts.page.items.map((value) => value.receipt)),
      ids([matched, unmatched, declaredElsewhere, rowDeclared]),
    );
    assert.ok(!result.receipts.page.items.some((value) => value.receipt.id === linkOnly.id));
    assert.equal(receipt(result, unmatched.id).focus.declared, false);
    assert.equal(receipt(result, unmatched.id).focus.comparison, null);
    assert.deepEqual(
      receipt(result, unmatched.id)
        .matches.routes.map((route) => route.rowId)
        .sort(),
      [e.rowA.id, e.rowB.id],
    );
    assert.deepEqual(receipt(result, rowDeclared.id).matches.inputIds, [e.rowA.id]);
    assert.equal(receipt(result, declaredElsewhere.id).matches.routes.length, 0);
    assert.deepEqual(await clocks(f), before);
  } finally {
    f.repository.close();
  }
});

test("native row, trace and receipt page unions agree with an unpaged oracle and never turn an omitted page into absence", async () => {
  const f = await orbit(),
    e = f.entities;
  try {
    for (let index = 0; index < 4; index++) await captureReceipt(f, e.evalA, [e.focus]);
    const q = query(f, {
      limit: 1,
      trace: { rowId: e.rowA.id, routeKey: "evaluations", limit: 1 },
      receipts: { limit: 1 },
    });
    const first = await f.tracer.getWorkingContext(q);
    assert.equal(first.rows.total, 2);
    assert.equal(first.traces[0].total, 2);
    assert.deepEqual(first.traces[0].stageCounts, [2]);
    assert.equal(first.traces[0].pathSelection, "one-per-identity");
    assert.equal(first.receipts.total, 4);
    assert.ok(
      first.rows.page.nextAfter && first.traces[0].page.nextAfter && first.receipts.page.nextAfter,
    );
    const traceNext = await f.tracer.getWorkingContext({
      ...q,
      trace: { ...q.trace!, after: first.traces[0].page.nextAfter },
    });
    assert.deepEqual(
      ids(
        [...first.traces[0].page.items, ...traceNext.traces[0].page.items].map(
          (path) => path.entity,
        ),
      ),
      [e.evalA.id, e.evalB.id],
    );
    const found: string[] = [];
    let after: string | undefined;
    do {
      const page = await f.tracer.getWorkingContext({ ...q, receipts: { after, limit: 1 } });
      found.push(...page.receipts.page.items.map((entry) => entry.receipt.id));
      assert.equal(page.receipts.total, 4);
      after = page.receipts.page.nextAfter;
    } while (after);
    const complete = await f.tracer.getWorkingContext(query(f, { receipts: { limit: 20 } }));
    assert.deepEqual(
      found,
      complete.receipts.page.items.map((entry) => entry.receipt.id),
    );
    assert.equal(new Set(found).size, 4);
  } finally {
    f.repository.close();
  }
});

test("medical protocol-to-run routes expose intermediate plans, zero execution and unmatched captured results distinctly", async () => {
  const f = await fixture(),
    e = f.entities;
  try {
    await link(f, "verified_by", e.rowA, e.protocolA);
    await link(f, "verified_by", e.rowA, e.protocolB);
    await link(f, "produces_result", e.protocolA, e.runA);
    const captured = await captureReceipt(f, e.runA, [e.aux]);
    const q: WorkingContextQuery = {
      focusId: e.rowA.id,
      recipe: {
        routes: [
          {
            key: "verification",
            label: "Protocol and execution",
            receipts: true,
            steps: [
              { relationshipType: "verified_by", direction: "outgoing", type: "protocol" },
              { relationshipType: "produces_result", direction: "outgoing", type: "run" },
            ],
          },
        ],
      },
      trace: { rowId: e.rowA.id, routeKey: "verification", stage: 1 },
    };
    const result = await f.tracer.getWorkingContext(q);
    assert.deepEqual(result.traces[0].stageCounts, [2, 1]);
    assert.deepEqual(ids(result.traces[0].page.items.map((path) => path.entity)), [
      e.protocolA.id,
      e.protocolB.id,
    ]);
    assert.equal(result.receipts.total, 1);
    assert.equal(receipt(result, captured.id).focus.declared, false);
    const terminal = await f.tracer.getWorkingContext({ ...q, trace: { ...q.trace!, stage: 2 } });
    assert.deepEqual(
      terminal.traces[0].page.items[0].entities.map((item) => item.id),
      [e.rowA.id, e.protocolA.id, e.runA.id],
    );
    const unexecuted = await f.tracer.getWorkingContext({
      focusId: e.protocolB.id,
      recipe: { routes: [{ ...q.recipe.routes[0], steps: [q.recipe.routes[0].steps[1]] }] },
    });
    assert.deepEqual(unexecuted.traces[0].stageCounts, [0]);
    assert.equal(unexecuted.receipts.total, 0);
    await link(f, "produces_result", e.protocolB, e.runB);
    const noReceipt = await f.tracer.getWorkingContext({ ...q, trace: { ...q.trace!, stage: 2 } });
    assert.equal(noReceipt.traces[0].total, 2);
    assert.equal(noReceipt.receipts.total, 1);
  } finally {
    f.repository.close();
  }
});

test("full comparison drift, focus equality, latest review applicability and explicit supersession remain independent", async () => {
  const f = await orbit(),
    e = f.entities;
  try {
    const captured = await f.tracer.evidence.recordReceipt(
      {
        outputId: e.evalA.id,
        outcome: "Captured against selected title",
        inputs: [{ entityId: e.focus.id, fields: ["title"] }, { entityId: e.aux.id }],
      },
      actor,
    );
    const original = await f.tracer.evidence.compareReceipt(captured.id);
    await f.tracer.evidence.review(
      {
        receiptId: captured.id,
        decision: "accepted",
        rationale: "Original scoped comparison",
        expectedComparison: original.token,
      },
      actor,
    );
    const aux2 = await f.tracer.updateEntity(
      e.aux.id,
      1,
      { fields: { title: "Changed other input" } },
      1,
      actor,
    );
    let context = await f.tracer.getWorkingContext(query(f, { receipts: { limit: 20 } }));
    assert.equal(receipt(context, captured.id).focus.comparison?.state, "current");
    assert.equal(receipt(context, captured.id).comparison?.state, "changed");
    assert.equal(receipt(context, captured.id).comparison?.review.state, "unreviewed");
    const changed = await f.tracer.evidence.compareReceipt(captured.id);
    await f.tracer.evidence.review(
      {
        receiptId: captured.id,
        decision: "needs_reevaluation",
        rationale: "Other input drift",
        expectedComparison: changed.token,
      },
      actor,
    );
    await f.tracer.updateEntity(aux2.id, aux2.version, { fields: e.aux.fields }, 1, actor);
    const focus2 = await f.tracer.updateEntity(
      e.focus.id,
      1,
      { fields: { ...e.focus.fields, note: "Unselected annotation" } },
      1,
      actor,
    );
    // The whole aux entity version is a dependency, so a separate selected-field receipt proves token reversion.
    const selected = await f.tracer.evidence.recordReceipt(
      {
        outputId: e.evalA.id,
        outcome: "Scoped",
        inputs: [{ entityId: focus2.id, fields: ["title"] }],
      },
      actor,
    );
    await verifyLatestReview(f, selected, focus2);
    for (let index = 0; index < 5; index++)
      await captureReceipt(f, e.evalA, [e.aux], { supersedes: captured.id });
    context = await f.tracer.getWorkingContext(query(f, { receipts: { limit: 20 } }));
    const value = receipt(context, captured.id);
    assert.equal(value.supersession.count, 5);
    assert.equal(value.supersession.ids.length, 3);
    assert.equal(value.receipt.outcome, captured.outcome);
    assert.deepEqual(await f.tracer.evidence.getReceipt(captured.id), captured);
  } finally {
    f.repository.close();
  }
});

async function verifyLatestReview(f: WorkingFixture, captured: Receipt, focus: Entity) {
  const original = await f.tracer.evidence.compareReceipt(captured.id);
  const accepted = await f.tracer.evidence.review(
    {
      receiptId: captured.id,
      decision: "accepted",
      rationale: "Original selected fields",
      expectedComparison: original.token,
    },
    actor,
  );
  await f.repository.transaction(async (tx) => {
    for (let index = 0; index < 1005; index++)
      await tx.appendEvidence("review", captured.id, {
        ...accepted,
        id: `old-review-${index}`,
        at: "2099-01-01T00:00:00Z",
      } satisfies Review);
  });
  const changed = await f.tracer.updateEntity(
    focus.id,
    focus.version,
    { fields: { title: "Temporary selected-field edit" } },
    1,
    actor,
  );
  const changedComparison = await f.tracer.evidence.compareReceipt(captured.id);
  const latest = await f.tracer.evidence.review(
    {
      receiptId: captured.id,
      decision: "needs_reevaluation",
      rationale: "Newer sequence, earlier timestamp than inserted history",
      expectedComparison: changedComparison.token,
    },
    actor,
  );
  await f.tracer.updateEntity(changed.id, changed.version, { fields: focus.fields }, 1, actor);
  const result = receipt(
    await f.tracer.getWorkingContext(query(f, { receipts: { limit: 20 } })),
    captured.id,
  );
  assert.equal(result.comparison?.token, original.token);
  assert.equal(result.comparison?.review.state, "unreviewed");
  assert.equal(result.comparison?.review.previous?.id, latest.id);
}

test("a removed captured path and unavailable terminal retain both changed and unknown facts while the focus remains current", async () => {
  const f = await orbit(),
    e = f.entities;
  try {
    const dependency = await link(f, "dependency", e.evalA, e.aux);
    const captured = await f.tracer.evidence.recordReceipt(
      {
        outputId: e.evalA.id,
        outcome: "Captured before removal",
        inputs: [{ entityId: e.focus.id }, { entityId: e.aux.id, path: [dependency.id] }],
      },
      actor,
    );
    await f.tracer.removeRelationship(dependency.id, 1, 1, actor);
    await f.tracer.removeEntity(e.aux.id, 1, 1, actor);
    const before = await clocks(f),
      result = receipt(await f.tracer.getWorkingContext(query(f)), captured.id);
    assert.equal(result.focus.comparison?.state, "current");
    assert.equal(result.comparison?.state, "unknown");
    assert.equal(result.comparison?.hasUnknown, true);
    assert.equal(result.comparison?.hasChanged, true);
    assert.ok(result.comparison?.inputs.some((input) => input.hasChanged && input.hasUnknown));
    await assert.rejects(
      f.tracer.evidence.review(
        {
          receiptId: captured.id,
          decision: "accepted",
          rationale: "Cannot accept unknown input",
          expectedComparison: result.comparison!.token,
        },
        actor,
      ),
      { code: "validation" },
    );
    assert.deepEqual(await clocks(f), before);
    assert.deepEqual(await f.tracer.evidence.getReceipt(captured.id), captured);
  } finally {
    f.repository.close();
  }
});

test("input work overflow is explicitly unavailable rather than unknown, current or absent", async () => {
  const f = await orbit(),
    e = f.entities;
  try {
    const batch = await f.tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: Array.from({ length: 99 }, (_, index) => ({
          op: "entity.create" as const,
          id: uuid(1000 + index),
          input: { type: "aux", fields: { title: `Input ${index}` } },
        })),
      },
      actor,
    );
    const inputs = [e.focus, ...(batch.results as Entity[])];
    for (let index = 0; index < 3; index++) await captureReceipt(f, e.evalA, inputs);
    const result = await f.tracer.getWorkingContext(query(f));
    assert.equal(result.receipts.total, 3);
    assert.equal(result.receipts.page.items.filter((value) => value.comparison !== null).length, 2);
    const unloaded = result.receipts.page.items.find((value) => value.comparison === null)!;
    assert.equal(unloaded.inputCount, 100);
    assert.equal(unloaded.comparisonUnavailable, "input_budget");
    assert.equal(unloaded.focus.declared, true);
    assert.equal(unloaded.focus.capturedVersion, 1);
    assert.equal(unloaded.focus.comparison, null);
  } finally {
    f.repository.close();
  }
});

test("every continuation binds exact recipe, page owner and independent native/schema/evidence clocks", async () => {
  for (const append of [
    "native",
    "schema",
    "receipt",
    "review",
    "observation",
    "external",
  ] as const)
    await staleContinuation(append);
});

async function staleContinuation(
  kind: "native" | "schema" | "receipt" | "review" | "observation" | "external",
) {
  const f = await orbit(),
    e = f.entities;
  try {
    const captured = await captureReceipt(f, e.evalA, [e.focus]);
    await captureReceipt(f, e.evalB, [e.aux]);
    const q = query(f, {
      limit: 1,
      trace: { rowId: e.rowA.id, routeKey: "evaluations", limit: 1 },
      receipts: { limit: 1 },
    });
    const first = await f.tracer.getWorkingContext(q);
    const rowAfter = first.rows.page.nextAfter!,
      traceAfter = first.traces[0].page.nextAfter!,
      receiptAfter = first.receipts.page.nextAfter!;
    assert.ok(rowAfter && traceAfter && receiptAfter);
    await assert.rejects(
      f.tracer.getWorkingContext({ ...q, focusId: e.otherFocus.id, after: rowAfter }),
      { code: "validation" },
    );
    await assert.rejects(
      f.tracer.getWorkingContext({
        ...q,
        after: rowAfter,
        trace: undefined,
        receipts: { after: receiptAfter, limit: 1 },
      }),
      { code: "validation" },
    );
    await mutateClock(f, kind, captured);
    for (const changed of [
      { ...q, after: rowAfter },
      { ...q, trace: { ...q.trace!, after: traceAfter } },
      { ...q, receipts: { after: receiptAfter, limit: 1 } },
    ])
      await assert.rejects(f.tracer.getWorkingContext(changed), { code: "conflict" });
    await assert.rejects(f.tracer.getWorkingContext({ ...q, after: "[broken" }), {
      code: "validation",
    });
  } finally {
    f.repository.close();
  }
}

async function mutateClock(f: WorkingFixture, kind: string, captured: Receipt) {
  const e = f.entities;
  if (kind === "native")
    return f.tracer.updateEntity(
      e.otherAux.id,
      1,
      { fields: { title: "Unrelated edit" } },
      1,
      actor,
    );
  if (kind === "schema") return f.tracer.setSchema(schema, 1, actor);
  if (kind === "receipt") return captureReceipt(f, e.evalOther, [e.otherAux]);
  if (kind === "external")
    return f.tracer.evidence.bindExternal(
      { entityId: e.otherAux.id, system: "file", externalId: "unrelated", ownership: "external" },
      actor,
    );
  if (kind === "review") {
    const compared = await f.tracer.evidence.compareReceipt(captured.id);
    return f.tracer.evidence.review(
      {
        receiptId: captured.id,
        decision: "accepted",
        rationale: "Evidence-only append",
        expectedComparison: compared.token,
      },
      actor,
    );
  }
  return f.repository.transaction((tx) =>
    tx.appendEvidence("observation", e.otherAux.id, {
      id: crypto.randomUUID(),
      entityId: e.otherAux.id,
      locator: { system: "file", path: "not-read" },
      availability: "unknown",
      reason: "Explicit fixture observation",
      actor: actor.actor,
      at: "2000-01-01T00:00:00Z",
    }),
  );
}

test("selection precedes limits and unrelated receipt catalogues are never deserialized", async () => {
  const f = await orbit(),
    e = f.entities;
  try {
    await f.tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: Array.from({ length: 301 }, (_, index) => ({
          op: "relationship.create" as const,
          id: uuid(2000 + index),
          input: {
            type: "broad",
            source: e.focus.id,
            target: index === 300 ? e.rowC.id : e.aux.id,
            fields: {},
          },
        })),
      },
      actor,
    );
    const selected = await captureReceipt(f, e.evalA, [e.focus]);
    await f.repository.transaction(async (tx) => {
      for (let index = 0; index < 1005; index++)
        await tx.appendEvidence("receipt", e.evalOther.id, {
          ...selected,
          id: `unrelated-receipt-${index}`,
          output: e.evalOther,
          inputs: [{ entityId: e.otherAux.id, entity: e.otherAux, links: [] }],
        });
    });
    const offPage = await captureReceipt(f, e.evalA, [e.aux]);
    const service = new Tracer(
      guarded(f.repository, (tx) => ({
        ...tx,
        evidence: async () => {
          throw new Error("No global evidence census");
        },
        query: async () => {
          throw new Error("No fixture-wide native join");
        },
        getBaseline: async () => {
          throw new Error("No named baseline dependency");
        },
      })),
    );
    const result = await service.getWorkingContext(query(f, { receipts: { limit: 20 } }));
    assert.deepEqual(
      ids(result.receipts.page.items.map((value) => value.receipt)),
      ids([selected, offPage]),
    );
    const filtered = await service.getWorkingContext({
      focusId: e.focus.id,
      limit: 1,
      recipe: {
        members: { relationshipType: "broad", direction: "outgoing", type: "requirement" },
        routes: [],
      },
    });
    assert.equal(filtered.rows.total, 1);
    assert.equal(filtered.rows.page.items[0].entity.id, e.rowC.id);
  } finally {
    f.repository.close();
  }
});

test("storage failure and dangling selected topology fail explicitly without changing native or evidence state", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-working-context-integrity-")),
    database = join(directory, "project.sqlite");
  let f = await orbit(database);
  let open = true;
  try {
    await captureReceipt(f, f.entities.evalA, [f.entities.focus]);
    const before = await clocks(f);
    const unavailable = new Tracer(
      guarded(f.repository, (tx) => ({
        ...tx,
        workingRoute: async () => {
          throw new Error("Injected native read failure");
        },
      })),
    );
    await assert.rejects(unavailable.getWorkingContext(query(f)), { code: "storage" });
    assert.deepEqual(await clocks(f), before);
    const falseIndex = new Tracer(
      guarded(f.repository, (tx) => ({
        ...tx,
        workingReceipts: async (selected) => {
          const page = await tx.workingReceipts(selected);
          return {
            ...page,
            items: page.items.map((candidate) => ({
              ...candidate,
              inputs: [],
              receipt: { ...candidate.receipt, output: f.entities.evalOther },
            })),
          };
        },
      })),
    );
    await assert.rejects(falseIndex.getWorkingContext(query(f)), { code: "referential_integrity" });
    assert.deepEqual(await clocks(f), before);
    const e = f.entities;
    f.repository.close();
    open = false;
    const db = new DatabaseSync(database);
    db.exec("PRAGMA foreign_keys=OFF");
    db.prepare("DELETE FROM entities WHERE id=?").run(e.rowB.id);
    db.close();
    const repository = new SQLiteRepository(database);
    f = { repository, tracer: new Tracer(repository), entities: e, memberships: f.memberships };
    open = true;
    const corruptBefore = await clocks(f);
    await assert.rejects(f.tracer.getWorkingContext(query(f)), { code: "referential_integrity" });
    assert.deepEqual(await clocks(f), corruptBefore);
  } finally {
    if (open) f.repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("guarded connection captures reject stale endpoints and duplicate pairs while reuse exposes only actual direct or derived paths", async () => {
  const f = await fixture(),
    e = f.entities;
  try {
    await link(f, "realized_by", e.rowA, e.focus);
    const existingMapping = await f.tracer.createRelationship(
      {
        type: "evaluated_by",
        source: e.rowA.id,
        target: e.evalA.id,
        fields: { scope: "Existing criterion A" },
      },
      1,
      actor,
    );
    const saved = await f.tracer.createEntity(
      { type: "requirement", fields: { title: "New authored branch" } },
      1,
      actor,
    );
    await link(f, "realized_by", saved, e.focus);
    const operation = {
      op: "relationship.create" as const,
      input: {
        type: "evaluated_by",
        source: saved.id,
        target: e.evalA.id,
        fields: { scope: "Authored criterion B" },
      },
      expectedEndpoints: { sourceVersion: saved.version, targetVersion: e.evalA.version },
      rejectExisting: true,
    };
    const revised = await f.tracer.updateEntity(
      e.evalA.id,
      1,
      { fields: { title: "Current shared evaluation" } },
      1,
      actor,
    );
    const before = await clocks(f);
    await assert.rejects(
      f.tracer.applyChangeset({ expectedSchemaVersion: 1, operations: [operation] }, actor),
      { code: "conflict" },
    );
    assert.deepEqual(await clocks(f), before);
    operation.expectedEndpoints.targetVersion = revised.version;
    const linked = await f.tracer.applyChangeset(
      { expectedSchemaVersion: 1, operations: [operation] },
      actor,
    );
    const after = await clocks(f);
    await assert.rejects(
      f.tracer.applyChangeset({ expectedSchemaVersion: 1, operations: [operation] }, actor),
      { code: "conflict" },
    );
    assert.deepEqual(await clocks(f), after);
    const captured = await captureReceipt(f, revised, [e.aux]);
    const result = await f.tracer.getWorkingContext(query(f));
    assert.equal(result.rows.total, 2);
    const originalTrace = result.traces.find((trace) => trace.rowId === e.rowA.id)!;
    const authoredTrace = result.traces.find((trace) => trace.rowId === saved.id)!;
    assert.deepEqual(originalTrace.page.items[0].relationships, [existingMapping]);
    assert.equal(authoredTrace.total, 1);
    assert.deepEqual(
      authoredTrace.page.items[0].entities.map((value) => value.id),
      [saved.id, revised.id],
    );
    assert.deepEqual(authoredTrace.page.items[0].relationships, linked.results);
    assert.equal(authoredTrace.page.items[0].relationships[0].fields.scope, "Authored criterion B");
    assert.equal(
      new Set(result.traces.flatMap((trace) => trace.page.items.map((path) => path.entity.id)))
        .size,
      1,
    );
    assert.equal(result.receipts.total, 1);
    assert.equal(receipt(result, captured.id).matches.routes.length, 2);
    assert.equal(receipt(result, captured.id).focus.declared, false);
    const derived = await f.tracer.getWorkingContext({
      focusId: e.focus.id,
      recipe: {
        routes: [
          {
            key: "authored-branch",
            label: "Recorded two-edge path",
            receipts: true,
            steps: [query(f).recipe.members!, query(f).recipe.routes[0].steps[0]],
          },
        ],
      },
    });
    assert.deepEqual(
      derived.traces[0].page.items[0].entities.map((value) => value.id),
      [e.focus.id, derived.traces[0].page.items[0].entities[1].id, revised.id],
    );
    assert.equal(derived.traces[0].total, 1);
    const chosen = derived.traces[0].page.items[0];
    const expectedMapping =
      chosen.entities[1].id === e.rowA.id ? existingMapping : linked.results[0];
    assert.deepEqual(chosen.relationships[1], expectedMapping);
    assert.ok([e.rowA.id, saved.id].includes(chosen.entities[1].id));
    assert.deepEqual(
      await f.tracer.getWorkingContext({ focusId: e.focus.id, recipe: derived.recipe }),
      derived,
    );
    const nativeParent = await f.tracer.getConnections({ id: e.focus.id });
    assert.ok(nativeParent.items.every((value) => value.relationship.type !== "evaluated_by"));
    const directCapture = await captureReceipt(f, e.focus, [e.aux]);
    const direct = await f.tracer.getWorkingContext({
      focusId: e.focus.id,
      recipe: { routes: [] },
    });
    const own = receipt(direct, directCapture.id);
    assert.deepEqual(own.matches, { routes: [], inputIds: [], outputIds: [e.focus.id] });
    assert.equal(own.focus.declared, false);
    assert.equal(own.focus.comparison, null);
    const zeroStep = await f.tracer.getWorkingContext({
      focusId: e.focus.id,
      recipe: {
        routes: [{ key: "self", label: "Explicit self output", steps: [], receipts: true }],
      },
    });
    assert.equal(zeroStep.traces[0].stage, 0);
    assert.deepEqual(zeroStep.traces[0].stageCounts, []);
    assert.equal(zeroStep.traces[0].total, 1);
    assert.deepEqual(receipt(zeroStep, directCapture.id).matches.routes, [
      { rowId: e.focus.id, routeKey: "self" },
    ]);
  } finally {
    f.repository.close();
  }
});

test("receipt terminal identity bounds are explicit and never silently truncate counts or non-receipt traces", async () => {
  const f = await fixture(),
    row = f.entities.rowA;
  try {
    const operations: import("../src/application/commands.ts").Operation[] = [];
    for (let index = 0; index < 199; index++) {
      const id = uuid(1000 + index);
      operations.push(
        { op: "entity.create", id, input: { type: "evaluation", fields: {} } },
        {
          op: "relationship.create",
          input: { type: "evaluated_by", source: row.id, target: id, fields: {} },
        },
      );
    }
    await f.tracer.applyChangeset({ expectedSchemaVersion: 1, operations }, actor);
    const q = { focusId: row.id, recipe: { routes: query(f).recipe.routes } };
    const exact = await f.tracer.getWorkingContext(q);
    assert.equal(exact.traces[0].total, 199);
    assert.equal(exact.traces[0].page.items.length, 3);
    assert.ok(exact.traces[0].page.nextAfter);
    const extra = await f.tracer.createEntity({ type: "evaluation", fields: {} }, 1, actor);
    await link(f, "evaluated_by", row, extra);
    const before = await clocks(f);
    await assert.rejects(f.tracer.getWorkingContext(q), {
      code: "validation",
      message: /200.*narrow|200.*reduce/,
    });
    assert.deepEqual(await clocks(f), before);
    q.recipe.routes[0].receipts = false;
    const noReceipts = await f.tracer.getWorkingContext(q);
    assert.equal(noReceipts.traces[0].total, 200);
    assert.equal(noReceipts.receipts.total, 0);
  } finally {
    f.repository.close();
  }
});

test("working query shape, recipe bounds and exact cursor ownership reject incompatible scopes before presenting absence", async () => {
  const f = await orbit(),
    e = f.entities;
  try {
    await captureReceipt(f, e.evalA, [e.focus]);
    await captureReceipt(f, e.evalB, [e.rowA]);
    const q = query(f, {
      limit: 1,
      trace: { rowId: e.rowA.id, routeKey: "evaluations", limit: 1 },
      receipts: { limit: 1 },
    });
    const result = await f.tracer.getWorkingContext(q);
    const after = result.rows.page.nextAfter!;
    const invalid: unknown[] = [
      { ...q, limit: 0 },
      { ...q, limit: 1.5 },
      { ...q, unexpected: true },
      { ...q, receipts: { limit: 21 } },
      { ...q, trace: { ...q.trace, limit: 21 } },
      { ...q, trace: { ...q.trace, stage: 0 } },
      { ...q, trace: { ...q.trace, rowId: e.rowB.id } },
      {
        ...q,
        recipe: {
          routes: Array.from({ length: 5 }, (_, i) => ({ ...q.recipe.routes[0], key: String(i) })),
        },
      },
      { ...q, recipe: { routes: [q.recipe.routes[0], q.recipe.routes[0]] } },
      {
        ...q,
        recipe: {
          routes: [{ ...q.recipe.routes[0], steps: Array(5).fill(q.recipe.routes[0].steps[0]) }],
        },
      },
      {
        ...q,
        recipe: { ...q.recipe, routes: [{ ...q.recipe.routes[0], label: "New recipe scope" }] },
        after,
      },
      {
        ...q,
        recipe: { ...q.recipe, routes: [{ ...q.recipe.routes[0], receipts: false }] },
        after,
      },
      { ...q, trace: { ...q.trace, after } },
      { focusId: e.focus.id, recipe: { routes: [] }, after },
    ];
    const before = await clocks(f);
    for (const request of invalid)
      await assert.rejects(f.tracer.getWorkingContext(request as WorkingContextQuery), {
        code: "validation",
      });
    assert.deepEqual(await clocks(f), before);
  } finally {
    f.repository.close();
  }
});

test("receipt totals and inclusion reasons belong to the loaded row page rather than an unseen family row", async () => {
  const f = await orbit(),
    e = f.entities;
  try {
    await link(f, "evaluated_by", e.rowB, e.evalOther);
    const onlyFirst = await captureReceipt(f, e.evalB, [e.aux]);
    const onlySecond = await captureReceipt(f, e.evalOther, [e.aux]);
    const declaredSecond = await captureReceipt(f, e.evalB, [e.rowB]);
    const q = query(f, { limit: 1, receipts: { limit: 20 } });
    const first = await f.tracer.getWorkingContext(q);
    assert.equal(first.rows.total, 2);
    assert.deepEqual(
      first.rows.page.items.map((row) => row.entity.id),
      [e.rowA.id],
    );
    assert.deepEqual(
      ids(first.receipts.page.items.map((value) => value.receipt)),
      ids([onlyFirst, declaredSecond]),
    );
    assert.equal(first.receipts.total, 2);
    const second = await f.tracer.getWorkingContext({ ...q, after: first.rows.page.nextAfter });
    assert.deepEqual(
      second.rows.page.items.map((row) => row.entity.id),
      [e.rowB.id],
    );
    assert.deepEqual(
      ids(second.receipts.page.items.map((value) => value.receipt)),
      ids([onlySecond, declaredSecond]),
    );
    assert.equal(second.receipts.total, 2);
    const declared = receipt(second, declaredSecond.id);
    assert.deepEqual(declared.matches.routes, []);
    assert.deepEqual(declared.matches.inputIds, [e.rowB.id]);
    assert.equal(declared.rows[0].declared, true);
    const all = await f.tracer.getWorkingContext(query(f, { receipts: { limit: 20 } }));
    assert.equal(all.receipts.total, 3);
    assert.deepEqual(
      ids(all.receipts.page.items.map((value) => value.receipt)),
      ids([onlyFirst, onlySecond, declaredSecond]),
    );
  } finally {
    f.repository.close();
  }
});
