import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Entity } from "../src/core/model.ts";
import type { WorkingContext, WorkingContextQuery } from "../src/core/working-context.ts";
import { captureReceipt, clocks, orbit, query } from "./working-context-fixture.ts";

function cli(database: string) {
  const invoke = (tokens: string[]) =>
    spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        resolve("src/interfaces/cli.ts"),
        "--db",
        database,
        "--actor",
        "working-context-cli-qa",
        ...tokens,
      ],
      { encoding: "utf8" },
    );
  return {
    get(q: WorkingContextQuery): WorkingContext {
      return this.command(["working-context", "get", JSON.stringify(q)]);
    },
    command<T>(tokens: string[]): T {
      const result = invoke(tokens);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      return JSON.parse(result.stdout) as T;
    },
    error(code: string, tokens: string[]) {
      const result = invoke(tokens);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr.trim().split("\n").length, 1);
      assert.equal(JSON.parse(result.stderr).error, code);
    },
  };
}

test("working-context CLI preserves native page unions and existing guarded authoring and review round trips", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-working-context-cli-"));
  const database = join(directory, "project.sqlite");
  const f = await orbit(database);
  const command = cli(database);
  try {
    await captureReceipt(f, f.entities.evalA, [f.entities.focus]);
    await captureReceipt(f, f.entities.evalB, [f.entities.rowA]);
    const q = query(f, {
      limit: 1,
      receipts: { limit: 1 },
      trace: { rowId: f.entities.rowA.id, routeKey: "evaluations", limit: 1 },
    });
    const before = await clocks(f);
    const first = command.get(q);
    assert.deepEqual(first, await f.tracer.getWorkingContext(q));
    for (const next of [
      { ...q, after: first.rows.page.nextAfter, trace: undefined },
      { ...q, trace: { ...q.trace!, after: first.traces[0].page.nextAfter } },
      { ...q, receipts: { limit: 1, after: first.receipts.page.nextAfter } },
    ])
      assert.deepEqual(command.get(next), await f.tracer.getWorkingContext(next));
    command.error("usage", ["working-context", "get", "{"]);
    command.error("usage", ["working-context", "get"]);
    command.error("usage", ["working-context", "get", JSON.stringify(q), "extra"]);
    command.error("validation", ["working-context", "get", JSON.stringify({ ...q, limit: 13 })]);
    command.error("validation", [
      "working-context",
      "get",
      JSON.stringify({ ...q, focusId: f.entities.otherFocus.id, after: first.rows.page.nextAfter }),
    ]);
    assert.deepEqual(await clocks(f), before);

    const saved = command.command<Entity>([
      "--schema-version",
      "1",
      "entity",
      "create",
      JSON.stringify({
        type: "requirement",
        key: "CLI-REQ",
        fields: { title: "Independent saved requirement" },
      }),
    ]);
    assert.equal(command.get(query(f)).rows.total, 2);
    assert.deepEqual((await f.tracer.getNativePin(saved.id, 1)).entity, saved);
    command.error("validation", [
      "--schema-version",
      "1",
      "relationship",
      "create",
      JSON.stringify({
        type: "realized_by",
        source: f.entities.aux.id,
        target: f.entities.focus.id,
        fields: {},
      }),
    ]);
    command.command([
      "--schema-version",
      "1",
      "relationship",
      "create",
      JSON.stringify({
        type: "realized_by",
        source: saved.id,
        target: f.entities.focus.id,
        fields: {},
      }),
    ]);
    const connected = command.get(query(f));
    assert.equal(connected.rows.total, 3);
    assert.ok(connected.rows.page.items.some((row) => row.entity.id === saved.id));
    assert.deepEqual((await f.tracer.getNativePin(saved.id, 1)).entity, saved);
    const card = connected.receipts.page.items[0];
    assert.ok(card.comparison);
    command.command([
      "review",
      "record",
      JSON.stringify({
        receiptId: card.receipt.id,
        decision: "accepted",
        rationale: "CLI exact comparison review",
        expectedComparison: card.comparison.token,
      }),
    ]);
    const reviewed = command
      .get(query(f))
      .receipts.page.items.find((value) => value.receipt.id === card.receipt.id)!;
    assert.equal(reviewed.comparison!.review.state, "accepted");
    assert.equal(reviewed.comparison!.state, card.comparison.state);
    assert.deepEqual(reviewed.receipt, card.receipt);
    command.error("conflict", [
      "working-context",
      "get",
      JSON.stringify({ ...q, after: first.rows.page.nextAfter }),
    ]);
  } finally {
    f.repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
