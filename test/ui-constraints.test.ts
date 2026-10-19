import "./register-ui.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { validateFields } from "../src/core/model.ts";
import type { SchemaObject, Field } from "../src/core/model.ts";
import { traceColumnKey } from "../src/core/presentation.ts";
import type { TraceColumn } from "../src/core/presentation.ts";
import { ApiError, read } from "../ui/api.ts";
import { write } from "../ui/write-transport.ts";
import { MutationController } from "../ui/mutation-controller.ts";
import type { MutationState } from "../ui/mutation-controller.ts";
import { readResult } from "../ui/use-read.ts";
import { decodeWrite } from "../src/interfaces/api-endpoints.ts";
import type { Editing } from "../ui/editing.ts";
const { fieldsFrom } = await import("../ui/fields.tsx");
const { useMappingDraft } = await import("./legacy-ui/components/use-mapping-draft.ts");
const schema: SchemaObject = {
  id: "project",
  version: 1,
  entityTypes: { item: { fields: {} } },
  relationshipTypes: { alpha: { fields: {} }, beta: { fields: {} } },
};
const source = { id: "item", version: 1, type: "item", fields: {} };
const editing: Editing = {
  busy: false,
  epoch: 0,
  commit: async () => false,
  mutate: async () => undefined,
  report(error) {
    throw error;
  },
};

test("optional configurable names never read inherited draft values; explicit names retain their types", () => {
  assert.deepEqual(
    fieldsFrom(
      {},
      { title: { type: "string", required: true } },
      { keepEmptyRequiredStrings: true },
    ),
    { title: "" },
  );
  for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    for (const [type, raw, value] of [
      ["string", "text", "text"],
      ["number", "42", 42],
      ["boolean", "true", true],
      ["json", "null", null],
    ] as const) {
      const definitions = Object.fromEntries([[name, { type } as Field]]);
      assert.deepEqual(fieldsFrom({}, definitions), {});
      const fields = fieldsFrom(Object.fromEntries([[name, raw]]), definitions);
      validateFields({ fields: definitions }, fields);
      assert.equal(Object.hasOwn(fields, name), true);
      assert.deepEqual(fields[name], value);
      assert.equal(Object.getPrototypeOf(fields), Object.prototype);
    }
  }
});
test("mapping and column identity ignore property order and do not collide on delimiters", () => {
  const canonical: TraceColumn = {
    relationshipType: "beta",
    targetType: "item",
    direction: "incoming",
  };
  const reordered: TraceColumn = {
    direction: "incoming",
    targetType: "item",
    relationshipType: "beta",
  };
  assert.equal(traceColumnKey(canonical), traceColumnKey(reordered));
  assert.notEqual(
    traceColumnKey({ ...canonical, relationshipType: "a:b", targetType: "c" }),
    traceColumnKey({ ...canonical, relationshipType: "a", targetType: "b:c" }),
  );
  function Probe({ slot }: { slot: TraceColumn }) {
    const draft = useMappingDraft(source, schema, editing, false, () => {}, slot);
    return createElement("span", null, `${draft.direction}:${draft.meaning}`);
  }
  const render = (slot: TraceColumn) => renderToStaticMarkup(createElement(Probe, { slot }));
  assert.equal(render(canonical), "<span>incoming:beta</span>");
  assert.equal(render(reordered), render(canonical));
});
test("only a matching successful read authorizes writing, including before refresh effects run", () => {
  const snapshot = { statement: "Retained draft context" };
  const state = { status: "ready" as const, scope: "items", generation: 1, data: snapshot };
  assert.equal(readResult(state, "items", 1).ready, true);
  const refreshing = readResult(state, "items", 2);
  assert.equal(refreshing.ready, false);
  assert.equal(refreshing.loading, true);
  assert.equal(refreshing.data, snapshot);
  const failed = readResult(
    {
      status: "failed",
      scope: "items",
      generation: 2,
      retained: snapshot,
      error: Error("Unavailable"),
    },
    "items",
    2,
  );
  assert.equal(failed.ready, false);
  assert.equal(failed.data, undefined);
  assert.equal(failed.retained, snapshot);
  assert.equal(readResult(state, "other", 1).retained, undefined);
  assert.equal(readResult(state, undefined, 1).loading, false);
});
test("unknown writes retain the submitted command and require the newest successful read plus acknowledgement", async () => {
  let calls = 0;
  const errors: unknown[] = [];
  const controller = new MutationController(
    async () => {
      calls++;
      throw new ApiError("outcome_unknown", "Response lost");
    },
    (error) => errors.push(error),
  );
  const proposal = { schema: structuredClone(schema), expectedVersion: 0 };
  await controller.run("/api/schema", proposal);
  proposal.schema.entityTypes.item.fields.changed = { type: "string" };
  const state: MutationState = controller.snapshot();
  assert.equal(state.status, "unknown");
  if (state.status !== "unknown" || state.attempt.path !== "/api/schema")
    assert.fail("Expected retained schema proposal");
  assert.deepEqual(state.attempt.input.schema.entityTypes.item.fields, {});
  controller.acknowledge();
  await controller.run("/api/schema", proposal);
  assert.equal(calls, 1);
  const olderRead = controller.beginReconciliation();
  const latestRead = controller.beginReconciliation();
  olderRead();
  controller.acknowledge();
  assert.equal(controller.snapshot().status, "unknown");
  latestRead();
  assert.equal(controller.snapshot().status, "unknown");
  controller.acknowledge();
  assert.equal(controller.snapshot().status, "idle");
  await controller.run("/api/schema", proposal);
  latestRead();
  controller.acknowledge();
  assert.equal(controller.snapshot().status, "unknown");
  assert.equal(calls, 2);
  assert.equal(errors.length, 2);
});
test("the shared write lock prevents concurrent dispatch and confirmed rejections remain retryable", async () => {
  let release = () => {};
  let calls = 0;
  const controller = new MutationController(
    async (path) => {
      calls++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return decodeWrite(path, schema);
    },
    () => {},
  );
  const first = controller.run("/api/schema", { schema, expectedVersion: 0 });
  assert.equal(await controller.run("/api/schema", { schema, expectedVersion: 0 }), undefined);
  assert.equal(calls, 1);
  release();
  assert.equal((await first)?.version, 1);
  assert.equal(controller.snapshot().status, "committed");
  const rejected = new MutationController(
    async () => {
      throw new ApiError("conflict", "Changed");
    },
    () => {},
  );
  await rejected.run("/api/schema", { schema, expectedVersion: 0 });
  assert.equal(rejected.snapshot().status, "rejected");
});
test("typed transport rejects malformed successful responses and preserves uncertain write outcomes", async (context) => {
  let value: unknown = { items: [{ id: "broken" }] };
  let requests = 0;
  const fetch = context.mock.method(globalThis, "fetch", async () => {
    requests++;
    return new Response(JSON.stringify(value), { status: 200 });
  });
  await assert.rejects(read("/api/entities", {}), { code: "read_failed" });
  value = { id: "not-a-schema", version: 1 };
  await assert.rejects(write("/api/schema", { schema, expectedVersion: 0 }), {
    code: "outcome_unknown",
  });
  value = schema;
  assert.equal((await read("/api/schema", {}))?.version, 1);
  const cyclic = structuredClone(schema);
  (cyclic as unknown as { self: unknown }).self = cyclic;
  assert.throws(() => write("/api/schema", { schema: cyclic, expectedVersion: 0 }), {
    code: "validation",
  });
  assert.equal(requests, 3);
  fetch.mock.restore();
});

test("typed transport preserves structured conflict details from the core", async (context) => {
  const details = { kind: "entity", id: "captured-item", expectedVersion: 2, actualVersion: 3 };
  context.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          error: "conflict",
          message: "Captured item changed",
          details,
        }),
        { status: 409 },
      ),
  );
  await assert.rejects(read("/api/entities", {}), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, "conflict");
    assert.deepEqual(error.details, details);
    return true;
  });
});
