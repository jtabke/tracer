import test from "node:test";
import assert from "node:assert/strict";
import { snapshotInput } from "../src/core/input-snapshot.ts";

test("input snapshots deeply detach ordinary/null-prototype data, preserve shared aliases and optional undefined", () => {
  const shared = { text: "Original 😃", nested: [null, true, 1.25, -0] };
  const dictionary = Object.assign(Object.create(null), { shared, optional: undefined });
  const input = { first: shared, second: shared, dictionary, optional: undefined };
  const captured = snapshotInput(input);
  assert.notEqual(captured, input);
  assert.notEqual(captured.first, shared);
  assert.equal(captured.first, captured.second);
  assert.equal(captured.dictionary.shared, captured.first);
  assert.equal(Object.getPrototypeOf(captured.dictionary), null);
  assert.equal(Object.hasOwn(captured, "optional"), true);
  assert.equal(captured.optional, undefined);
  assert.equal(Object.is(captured.first.nested[3], -0), true);
  shared.text = "Mutated";
  shared.nested.push(2);
  assert.equal(captured.first.text, "Original 😃");
  assert.equal(captured.first.nested.length, 4);
  captured.first.text = "Detached result";
  assert.equal(shared.text, "Mutated");
  const prototypeKey = JSON.parse('{"__proto__":{"polluted":true},"constructor":"native key"}');
  const copy = snapshotInput(prototypeKey);
  assert.equal(Object.hasOwn(copy, "__proto__"), true);
  assert.equal(copy.__proto__.polluted, true);
  assert.equal(Object.getPrototypeOf(copy), Object.prototype);
  assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
});

test("input snapshots reject all own accessors without evaluating user code, including hidden and nested getters", () => {
  let reads = 0;
  for (const enumerable of [true, false]) {
    const accessor = Object.defineProperty({}, "payload", {
      enumerable,
      get() {
        reads++;
        throw new Error("Caller code must never execute");
      },
    });
    for (const value of [accessor, { nested: accessor }, [accessor]])
      assert.throws(() => snapshotInput(value), { code: "validation" });
  }
  const setter = Object.defineProperty({}, "writeOnly", {
    set() {
      reads++;
    },
  });
  assert.throws(() => snapshotInput(setter), { code: "validation" });
  assert.equal(reads, 0);
});

test("input snapshots reject non-data values, cyclic/sparse containers and unsafe Unicode without coercion", () => {
  class Custom {
    value = "custom";
  }
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const arrayCycle: unknown[] = [];
  arrayCycle.push(arrayCycle);
  const symbolKey = { [Symbol("hidden")]: "value" };
  const invalid = [
    new Custom(),
    new Date(),
    new Map(),
    new Set(),
    /value/,
    new Uint8Array([1]),
    () => "function",
    Symbol("value"),
    1n,
    Infinity,
    -Infinity,
    NaN,
    cycle,
    arrayCycle,
    new Array(3),
    [1, , 3],
    symbolKey,
    "\uD800",
    "\uDC00",
    { "\uD800": "bad key" },
  ];
  for (const value of invalid) assert.throws(() => snapshotInput(value), { code: "validation" });
  assert.equal(snapshotInput(undefined), undefined);
  assert.equal(snapshotInput(null), null);
  assert.equal(snapshotInput("Paired 😃"), "Paired 😃");
  assert.equal(snapshotInput(false), false);
});

test("input snapshot nesting is bounded by a validation error rather than a recursive stack crash", () => {
  const nested = (depth: number) => {
    let value: Record<string, unknown> = { leaf: "data" };
    for (let i = 0; i < depth; i++) value = { next: value };
    return value;
  };
  assert.deepEqual(snapshotInput(nested(32)), nested(32));
  assert.throws(() => snapshotInput(nested(300)), { code: "validation" });
});
