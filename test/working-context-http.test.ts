import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { decodeRead } from "../src/interfaces/api-endpoints.ts";
import { url as readUrl } from "../ui/api.ts";
import type { WorkingContext } from "../src/core/working-context.ts";
import { actor, captureReceipt, clocks, orbit, query, uuid } from "./working-context-fixture.ts";

test("working-context HTTP has strict JSON query boundaries and exact native parity without read writes", async () => {
  const f = await orbit();
  const captured = await captureReceipt(f, f.entities.evalA, [f.entities.focus]);
  await captureReceipt(f, f.entities.evalB, [f.entities.rowA]);
  const server = await startLocalServer(f.tracer, resolve("ui"), 0);
  try {
    const q = query(f, { limit: 1, receipts: { limit: 1 } });
    const encoded = new URLSearchParams({ query: JSON.stringify(q) }).toString();
    const endpoint = server.origin + "/api/working-context";
    const before = await clocks(f);
    const response = await fetch(server.origin + readUrl("/api/working-context", q));
    assert.equal(response.status, 200);
    const result = decodeRead("/api/working-context", q, await response.json());
    assert.deepEqual(result, await f.tracer.getWorkingContext(q));
    for (const suffix of [
      "",
      "?query={",
      "?query=[]",
      "?" + encoded + "&query={}",
      "?" + encoded + "&limit=1",
    ]) {
      assert.equal((await fetch(endpoint + suffix)).status, 400, suffix);
    }
    for (const invalid of [
      { ...q, limit: 13 },
      { ...q, unexpected: true },
    ]) {
      const response = await fetch(
        endpoint + "?" + new URLSearchParams({ query: JSON.stringify(invalid) }),
      );
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, "validation");
    }
    const missing = await fetch(
      endpoint +
        "?" +
        new URLSearchParams({ query: JSON.stringify({ ...q, focusId: uuid(9000) }) }),
    );
    assert.equal(missing.status, 404);
    assert.deepEqual(await clocks(f), before);
    assert.ok(result.rows.page.nextAfter);
    const comparison = await f.tracer.evidence.compareReceipt(captured.id);
    await f.tracer.evidence.review(
      {
        receiptId: captured.id,
        decision: "accepted",
        rationale: "HTTP clock guard",
        expectedComparison: comparison.token,
      },
      actor,
    );
    const stale = { ...q, after: result.rows.page.nextAfter };
    const failed = await fetch(
      endpoint + "?" + new URLSearchParams({ query: JSON.stringify(stale) }),
    );
    assert.equal(failed.status, 409);
    assert.equal((await failed.json()).error, "conflict");
  } finally {
    await server.close();
    f.repository.close();
  }
});

test("working-context response decoder rejects plausible cross-field topology and evidence corruption", async () => {
  const f = await orbit();
  try {
    await captureReceipt(f, f.entities.evalA, [f.entities.focus]);
    const q = query(f);
    const result = await f.tracer.getWorkingContext(q);
    assert.deepEqual(decodeRead("/api/working-context", q, result), result);
    const corruptions: Record<string, (value: WorkingContext) => void> = {
      "duplicate row identity": (value) => {
        value.rows.page.items[1] = structuredClone(value.rows.page.items[0]);
      },
      "duplicate terminal identity": (value) => {
        value.traces[0].page.items.push(structuredClone(value.traces[0].page.items[0]));
      },
      "duplicate receipt identity": (value) => {
        value.receipts.total++;
        value.receipts.page.items.push(structuredClone(value.receipts.page.items[0]));
      },
      "invented output match": (value) => {
        value.receipts.page.items[0].matches.outputIds = [value.focus.id];
      },
      "invented input match": (value) => {
        value.receipts.page.items[0].matches.inputIds.push(f.entities.aux.id);
      },
      "duplicate route match": (value) => {
        const routes = value.receipts.page.items[0].matches.routes;
        routes.push(structuredClone(routes[0]));
      },
      "wrong compact input version": (value) => {
        value.receipts.page.items[0].focus.capturedVersion = 2;
      },
      "wrong compact input flags": (value) => {
        value.receipts.page.items[0].focus.comparison!.hasChanged = true;
      },
      "missing trace": (value) => {
        value.traces.pop();
      },
      "duplicate trace": (value) => {
        value.traces.push(structuredClone(value.traces[0]));
      },
      "inconsistent current snapshot": (value) => {
        value.traces[0].page.items[0].entities[0].fields.title = "Contradictory row";
      },
      "different focus": (value) => {
        value.focus.id = uuid(9000);
      },
      "different recipe": (value) => {
        value.recipe.routes[0].label = "Other scope";
      },
      "schema clock": (value) => {
        value.context.schemaVersion++;
      },
      "negative clock": (value) => {
        value.context.evidenceRevision = -1;
      },
      "fractional total": (value) => {
        value.rows.total = 0.5;
      },
      "wrong membership target": (value) => {
        value.rows.page.items[0].membership[0].target = f.entities.otherFocus.id;
      },
      "wrong membership type": (value) => {
        value.rows.page.items[0].membership[0].type = "dependency";
      },
      "invalid stage": (value) => {
        value.traces[0].stage = 0;
      },
      "stage total mismatch": (value) => {
        value.traces[0].stageCounts[0]++;
      },
      "wrong route link": (value) => {
        value.traces[0].page.items[0].relationships[0].type = "dependency";
      },
      "wrong route endpoint": (value) => {
        value.traces[0].page.items[0].relationships[0].target = f.entities.aux.id;
      },
      "wrong endpoint type": (value) => {
        value.traces[0].page.items[0].entities[1].type = "aux";
      },
      "missing row fact": (value) => {
        value.receipts.page.items[0].rows.pop();
      },
      "wrong row fact": (value) => {
        value.receipts.page.items[0].rows[0].entityId = f.entities.rowC.id;
      },
      "undeclared captured version": (value) => {
        value.receipts.page.items[0].rows[0].capturedVersion = 1;
      },
      "declared without version": (value) => {
        delete value.receipts.page.items[0].focus.capturedVersion;
      },
      "wrong comparison receipt": (value) => {
        value.receipts.page.items[0].comparison!.receiptId = uuid(9999);
      },
      "wrong input count": (value) => {
        value.receipts.page.items[0].inputCount++;
      },
      "unexplained unavailable comparison": (value) => {
        value.receipts.page.items[0].comparison = null;
      },
      "loaded unavailable comparison": (value) => {
        value.receipts.page.items[0].comparisonUnavailable = "input_budget";
      },
    };
    for (const [label, mutate] of Object.entries(corruptions)) {
      const invalid = structuredClone(result);
      mutate(invalid);
      assert.throws(() => decodeRead("/api/working-context", q, invalid), label);
    }
  } finally {
    f.repository.close();
  }
});
