import "./register-ui.ts";
import test from "node:test";
import assert from "node:assert/strict";
import type { SchemaObject } from "../src/core/model.ts";
const { workingChoices } = await import("./legacy-ui/components/work.tsx");
const { connectionFields } = await import("../ui/work-item.tsx");
const schema: SchemaObject = {
  id: "project",
  version: 3,
  entityTypes: {
    item: { fields: { title: { type: "string" }, number: { type: "number" } } },
    target: { fields: {} },
  },
  relationshipTypes: {
    any: { fields: {} },
    none: { source: [], target: [], fields: {} },
    scoped: { source: ["item"], target: ["target"], fields: {} },
  },
};
test("working filters retain native Any/None and exact text-field eligibility", () => {
  const choices = workingChoices(schema, "item", "none");
  assert.deepEqual(choices.textFields, ["title"]);
  assert.deepEqual(choices.meanings, ["any", "scoped"]);
  assert.deepEqual(choices.targetTypes, []);
  assert.deepEqual(workingChoices(schema, undefined, "any").targetTypes, ["item", "target"]);
  assert.deepEqual(workingChoices(schema, "target", "scoped").meanings, ["any"]);
});
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
