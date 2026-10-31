import "./register-ui.ts";
import test from "node:test";
import assert from "node:assert/strict";
const { connectionFields } = await import("../ui/records/details.tsx");
test("connection field serialization retains required empty strings and rejects invalid numeric/JSON drafts", () => {
  const definition = {
    fields: {
      rationale: { type: "string" as const, required: true },
      note: { type: "string" as const },
      amount: { type: "number" as const },
      context: { type: "json" as const },
    },
  };
  assert.deepEqual(
    connectionFields(definition, {
      rationale: "",
      note: "",
      amount: "2",
      context: '{"unknown":true}',
    }),
    { rationale: "", amount: 2, context: { unknown: true } },
  );
  assert.throws(() => connectionFields(definition, { amount: "not numeric" }));
  assert.throws(() => connectionFields(definition, { context: "{incomplete" }));
});
