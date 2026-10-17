import test from "node:test";
import assert from "node:assert/strict";
import { changedText, suggestedKey, requiredField } from "../../ui/workbench/authoring-policy.ts";
import { reachableTrace, recordedRoute } from "../../ui/workbench/trace-context.mjs";

test("workbench authoring preserves schema requirements, unique keys, literal diffs and exact routes", () => {
  const records = new Map([
    ["PRS-01", { key: "PRS-01", type: "requirement" }],
    ["PRS-09", { key: "PRS-09", type: "requirement" }],
    ["OUT-01", { key: "OUT-01", type: "output" }],
    ["VER-01", { key: "VER-01", type: "verification" }],
  ]);
  assert.equal(suggestedKey(records, "requirement"), "PRS-10");
  const schema = {
    entityTypes: { requirement: { fields: { statement: { required: true } } } },
    relationshipTypes: {
      realized_by: { fields: { scope: { required: true } } },
      references: { fields: {} },
    },
  };
  assert.equal(requiredField(schema, "entityTypes", "requirement", "statement"), true);
  assert.equal(requiredField(schema, "relationshipTypes", "references", "scope"), false);
  const links = [
    { id: "a", source: "PRS-01", target: "OUT-01", type: "realized_by" },
    { id: "b", source: "OUT-01", target: "VER-01", type: "verified_by" },
    { id: "c", source: "VER-01", target: "PRS-01", type: "references" },
  ];
  const steps = [
    { type: "realized_by", targetType: "output" },
    { type: "verified_by", targetType: "verification" },
  ];
  assert.deepEqual(reachableTrace({ records, links: links.slice(0, 2) }, "PRS-01", steps).entries, [
    { key: "VER-01", keys: ["PRS-01", "OUT-01", "VER-01"], links: ["a", "b"] },
  ]);
  assert.equal(
    reachableTrace(
      {
        records,
        links: [...links, { id: "d", source: "PRS-01", target: "VER-01", type: "verified_by" }],
      },
      "PRS-01",
      steps,
    ).entries.length,
    0,
  );
  assert.deepEqual(
    recordedRoute(links, "PRS-01", "VER-01", new Set(["a", "b"])).map((l) => l.id),
    ["a", "b"],
  );
  assert.deepEqual(recordedRoute(links, "PRS-01", "VER-01", new Set(["b"])), []);
  for (const [a, b] of [
    ["Operating temperature: 15–35°C", "Operating temperature: 10–40°C"],
    ["abc", ""],
    ["", "new"],
    ["same", "same"],
    ["<script>x</script>", "<script>y</script>"],
  ]) {
    const diff = changedText(a, b);
    assert.equal(Object.values(diff.before).join(""), a);
    assert.equal(Object.values(diff.after).join(""), b);
  }
  const range = changedText("Operating temperature: 15–35°C", "Operating temperature: 10–40°C");
  assert.equal(range.before.change, "15–35");
  assert.equal(range.after.change, "10–40");
  console.log(
    "Authoring policy passed: schema-required fields, unique suggestions, literal diffs, configured indirect routes, direct exclusion and scoped path explanations.",
  );
});
