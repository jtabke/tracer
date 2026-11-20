import test from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { projectWorkspace } from "../ui/workbench/workspace-snapshot.ts";
import { snapshotAt } from "../ui/workbench/workspace-history.ts";
import { createWorkspaceIdentities } from "../ui/workbench/workspace-identities.ts";
import type { ViewRequest, readView } from "../ui/workbench/native-client.ts";
import { createWorkspaceReader } from "../ui/workbench/workspace-reader.ts";
import { groupedTraceRows, traceIndex } from "../ui/workbench/trace-table.ts";

const origin = { actor: "scope test" },
  schema = {
    entityTypes: { item: { fields: {} } },
    relationshipTypes: { connects: { fields: {} } },
  };
test("history, connections and retained selection follow ID through rename, key reuse and removal", async (t) => {
  const repo = new SQLiteRepository(":memory:");
  t.after(() => repo.close());
  const service = new Tracer(repo);
  await service.setSchema(schema, 0, origin);
  const source = await service.createEntity({ key: "OLD", type: "item", fields: {} }, 1, origin);
  const target = await service.createEntity({ key: "PRS-01", type: "item", fields: {} }, 1, origin);
  const relation = await service.createRelationship(
    { type: "connects", source: source.id, target: target.id, fields: {} },
    1,
    origin,
  );
  const old = await service.workspaceClock();
  await service.updateEntity(source.id, 1, { key: "NEW", fields: {} }, 1, origin);
  const other = await service.createEntity({ key: "OLD", type: "item", fields: {} }, 1, origin);
  const window = await service.workspaceWindow();
  const data = projectWorkspace(window, (await service.history()).items, window.changesets, "NEW");
  assert.equal(data.trace.root, "NEW", "a customer PRS-01 is not an example preset");
  const prior = snapshotAt(data, old),
    now = snapshotAt(data, window.projectRevision);
  assert.equal(prior.links[0].source, "OLD");
  assert.equal(now.links[0].source, "NEW");
  assert.equal(prior.links[0].sourceId, source.id);
  assert.equal(now.records.get("OLD")?.id, other.id);
  const state: Parameters<ReturnType<typeof createWorkspaceIdentities>>[0] = {
    selected: "OLD",
    visible: new Set(["OLD"]),
    baseScope: new Set(["OLD"]),
    matrixSubject: "OLD",
    historySubject: { key: "OLD", linkId: null },
    drafts: new Map([["OLD", "retained"]]),
    layout: new Map(),
  };
  const resolve = createWorkspaceIdentities();
  resolve(state, prior.records);
  const restored = structuredClone(state);
  createWorkspaceIdentities()(restored, now.records);
  assert.deepEqual([...restored.visible], ["NEW"]);
  assert.equal(restored.selectedId, source.id);
  resolve(state, now.records);
  assert.equal(state.selectedId, source.id);
  assert.equal(state.selected, "NEW");
  assert.deepEqual([...state.visible], ["NEW"]);
  assert.equal(state.drafts.get("NEW"), "retained");
  resolve(
    state,
    new Map([["NEW", { ...other, key: "NEW", title: "Another owner", statement: "" }]]),
  );
  assert.equal(state.selected, source.id);
  assert.equal(state.selectedId, source.id);
  resolve(state, now.records);
  assert.deepEqual([...state.visible], ["NEW"]);
  assert.equal(state.drafts.get("NEW"), "retained");
  const history = await service.workspaceEvent({
    revision: old,
    head: window.projectRevision,
    subject: source.id,
    limit: 1,
  });
  assert.equal(history.entries[0].id, relation.id);
  assert.equal(history.more, true);
  const older = await service.workspaceEvent({
    revision: old,
    head: window.projectRevision,
    subject: source.id,
    before: history.feed[0].projectRevision,
  });
  assert.ok(older.feed.every((r) => r.id !== other.id));
  assert.equal(
    (await service.workspacePage({ revision: old, kind: "entity", type: "item" })).entities.find(
      (e) => e.id === source.id,
    )?.key,
    "OLD",
  );
  await service.removeRelationship(relation.id, 1, 1, origin);
  await assert.rejects(service.workspaceEvent({ head: window.projectRevision, revision: old }), {
    code: "conflict",
  });
  assert.deepEqual(
    (await service.getGraph({ rootId: source.id, atRevision: old })).links.map((l) => l.id),
    [relation.id],
  );
  assert.deepEqual(
    (await service.getGraph({ rootId: source.id, atRevision: await service.workspaceClock() }))
      .links,
    [],
  );
});

test("matrix connection pages retain creation and parallel-link order across a head advance", async (t) => {
  const repo = new SQLiteRepository(":memory:");
  t.after(() => repo.close());
  const tracer = new Tracer(repo);
  await tracer.setSchema(schema, 0, origin);
  const source = await tracer.createEntity({ type: "item", fields: {} }, 1, origin),
    target = await tracer.createEntity({ type: "item", fields: {} }, 1, origin);
  const link = { type: "connects", source: source.id, target: target.id, fields: {} };
  const ids = [3, 1, 2].map((i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
  await tracer.applyChangeset(
    {
      expectedSchemaVersion: 1,
      operations: ids.map((id) => ({ op: "relationship.create", id, input: link })),
    },
    origin,
  );
  const head = await tracer.workspaceClock(),
    query = { kind: "relationship" as const, revision: head, type: "connects" };
  assert.deepEqual(
    (await tracer.workspaceWindow()).relationships.map((l) => l.id),
    ids,
  );
  assert.deepEqual(
    (await tracer.workspacePage(query)).relationships.map((l) => l.id),
    ids,
  );
  const page = await repo.transaction((tx) => tx.orderedRelationships(undefined, { limit: 1 }), {
    readOnly: true,
  });
  await tracer.removeRelationship(ids[1], 1, 1, origin);
  assert.deepEqual(
    (await tracer.workspacePage({ ...query, after: page.nextAfter })).relationships.map(
      (l) => l.id,
    ),
    ids.slice(1),
  );
  assert.deepEqual(
    (await tracer.workspacePage({ ...query, revision: head + 1 })).relationships.map((l) => l.id),
    [ids[0], ids[2]],
  );
  await assert.rejects(tracer.workspacePage({ ...query, after: "bogus" }), { code: "validation" });
});

test("grouped projection retains parallel links and caps terminals without rebuilding the index for each row", () => {
  const records = new Map([
      ["a", { type: "item" }],
      ["b", { type: "item" }],
    ]),
    links = Array.from({ length: 120 }, (_, i) => ({
      source: "a",
      target: "b",
      id: String(i),
      fields: {},
      type: "connects",
      scope: "",
      version: 1,
    }));
  assert.equal(traceIndex(records, links), traceIndex(records, links));
  const result = groupedTraceRows(
    records,
    links,
    ["a"],
    [{ type: "connects", targetType: "item" }],
  );
  assert.equal(result.truncated, true);
  assert.equal(result.rows[0].terminals.length, 100);
  assert.equal(result.rows[0].terminals[99].linkId, "99");
});

test("a slower superseded view cannot unlock edits or replace the installed revision", async () => {
  const snapshot = { schema: null, projectRevision: 1, entities: [], relationships: [] },
    opening = { ...projectWorkspace(snapshot, [], []), modelRevision: 1 };
  type Result = Awaited<ReturnType<typeof readView>>;
  const flights: { resolve(value: Result): void; reject(error: Error): void }[] = [];
  const published: number[] = [];
  let busy = false,
    error: unknown,
    ready = 0;
  const reader = createWorkspaceReader(
    {
      readView: () =>
        new Promise<Result>((resolve, reject) => {
          flights.push({ resolve, reject });
        }),
      restoreWindow: () => {},
      installView: () => {},
    },
    opening,
    {
      replace: (data) => {
        published.push(data.modelRevision!);
      },
      busy: (value) => {
        busy = value;
      },
      failed: (value) => {
        error = value;
      },
      ready: () => {
        ready++;
      },
    },
  );
  const request: ViewRequest = {
    revision: 1,
    scope: "project",
    entityTypes: [],
    linkTypes: [],
    limit: 30,
  };
  const older = reader.prepare(request);
  assert.equal(reader.prepare(request), older);
  const latest = reader.prepare({ ...request, scope: "matrix" });
  flights[0].resolve({ current: snapshot, data: opening });
  assert.equal(await older, false);
  assert.equal(busy, true);
  assert.deepEqual(published, []);
  flights[1].resolve({ current: snapshot, data: opening });
  assert.equal(await latest, true);
  assert.equal(ready, 1);
  assert.equal(busy, false);
  const failed = reader.prepare({ ...request, scope: "catalog" });
  flights[2].reject(new Error("head moved"));
  assert.equal(await failed, false);
  assert.match(String(error), /head moved/);
  assert.deepEqual(published, [1]);
  const superseded = reader.prepare(request);
  reader.reset(opening);
  reader.prepare({ ...request, scope: "opening" });
  flights[3].reject(new Error("obsolete"));
  assert.equal(await superseded, false);
  assert.match(String(error), /head moved/);
  assert.deepEqual(published, [1, 1]);
  assert.equal(busy, false);
});

test("workspace reads reject invalid bounds and return complete continuation pages at the requested revision", async (t) => {
  const repo = new SQLiteRepository(":memory:");
  t.after(() => repo.close());
  const tracer = new Tracer(repo);
  await tracer.setSchema(schema, 0, origin);
  for (const count of [1000, 1])
    await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: Array.from({ length: count }, () => ({
          op: "entity.create" as const,
          input: { type: "item", fields: {} },
        })),
      },
      origin,
    );
  const head = await tracer.workspaceClock(),
    first = await tracer.workspacePage({ revision: head, kind: "entity" });
  assert.equal(first.entities.length, 1000);
  const last = await tracer.workspacePage({
    revision: head,
    kind: "entity",
    after: first.nextAfter,
  });
  assert.equal(last.entities.length, 1);
  await tracer.removeEntity(last.entities[0].id, 1, 1, origin);
  assert.deepEqual(
    await tracer.workspacePage({ revision: head, kind: "entity", after: first.nextAfter }),
    last,
  );
  const focus = await tracer.workspaceWindow({ ids: [first.entities[4].id] });
  assert.equal(focus.partial, true);
  assert.equal(focus.entities[0].id, first.entities[4].id);
  await assert.rejects(tracer.workspaceWindow({ keys: Array(61).fill("item") }), {
    code: "validation",
  });
  await assert.rejects(tracer.workspacePage({ revision: head + 2, kind: "entity" }), {
    code: "validation",
  });
  await assert.rejects(tracer.workspaceEvent({ head: head + 1, revision: head, limit: 201 }), {
    code: "validation",
  });
});
