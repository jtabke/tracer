import test from "node:test";
import assert from "node:assert/strict";
import { parseActions, parseCandidate, parseSupport } from "../src/core/assessment-disposition.ts";

// JSON-compatible lookalikes must not pass validation and then miss strict-equality guards.
function lookalikes(value: string): unknown[] {
  return [[value], [[value]], { value }, null, true, 1];
}

test("assessment action discriminators are literal strings, never coerced values", () => {
  for (const kind of ["revise", "reverify", "investigate"]) {
    for (const state of ["open", "done", "waived"]) {
      const action = {
        id: "obligation",
        kind,
        state,
        title: "Explicit obligation",
        resolution: state === "open" ? "" : "Recorded resolution",
        support: [{ kind: "entity", id: "criterion", version: 1, mode: "historical" }],
      };
      assert.deepEqual(parseActions([action]), [action]);
      for (const invalid of lookalikes(kind))
        assert.throws(() => parseActions([{ ...action, kind: invalid }]), { code: "validation" });
      for (const invalid of lookalikes(state))
        assert.throws(() => parseActions([{ ...action, state: invalid }]), { code: "validation" });
    }
  }
});

test("candidate discriminators cannot bypass kind-specific validation", () => {
  for (const kind of ["entity", "relationship", "receipt"]) {
    const candidate = { kind, id: "candidate" };
    assert.deepEqual(parseCandidate(candidate), candidate);
    for (const invalid of lookalikes(kind))
      assert.throws(() => parseCandidate({ ...candidate, kind: invalid }), { code: "validation" });
  }
});

test("support discriminators cannot bypass kind-specific validation", () => {
  for (const kind of ["entity", "relationship", "receipt", "observation"]) {
    for (const mode of ["historical", "current"]) {
      const reference = {
        kind,
        id: "support",
        mode,
        ...(kind === "entity" || kind === "relationship" ? { version: 1 } : {}),
      };
      assert.deepEqual(parseSupport([reference]), [reference]);
      for (const invalid of lookalikes(kind))
        assert.throws(() => parseSupport([{ ...reference, kind: invalid }]), {
          code: "validation",
        });
      for (const invalid of lookalikes(mode))
        assert.throws(() => parseSupport([{ ...reference, mode: invalid }]), {
          code: "validation",
        });
    }
  }
  const selected = {
    kind: "receipt",
    id: "support",
    mode: "configuration",
    configurationId: "after",
  };
  assert.deepEqual(parseSupport([selected]), [selected]);
  for (const mode of lookalikes("configuration"))
    assert.throws(() => parseSupport([{ ...selected, mode }]), { code: "validation" });
});
