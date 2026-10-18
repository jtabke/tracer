import test from "node:test";
import assert from "node:assert/strict";
import { focusedNeighborhood } from "../../ui/workbench/workspace-journeys.mjs";
import { wheelIntent } from "../../ui/workbench/canvas-input.ts";
test("neighborhood depth, stored direction and explicit relationship filter remain distinct", () => {
  const model = {
    records: new Map(["A", "B", "C", "V"].map((key) => [key, { key }])),
    links: [
      { id: "ab", source: "A", target: "B", type: "decomposes_into" },
      { id: "bc", source: "B", target: "C", type: "decomposes_into" },
      { id: "av", source: "A", target: "V", type: "verified_by" },
    ],
  };
  assert.deepEqual(focusedNeighborhood(model, "A", { depth: 0 }).keys, ["A"]);
  assert.deepEqual(
    focusedNeighborhood(model, "A", { depth: 1, relationshipType: "decomposes_into" }).keys,
    ["A", "B"],
  );
  assert.deepEqual(focusedNeighborhood(model, "A", { depth: 2 }).keys, ["A", "B", "V", "C"]);
  assert.deepEqual(focusedNeighborhood(model, "C", { depth: 2, direction: "upstream" }).keys, [
    "C",
    "B",
    "A",
  ]);
  assert.deepEqual(focusedNeighborhood(model, "B", { depth: 1, direction: "both" }).keys, [
    "B",
    "A",
    "C",
  ]);
});
test("wheel intent preserves line/page scaling, pinch zoom and horizontal pan", () => {
  assert.deepEqual(wheelIntent({ deltaX: 0, deltaY: 2, deltaMode: 1 }, 800), {
    kind: "zoom",
    delta: 32,
  });
  assert.deepEqual(wheelIntent({ deltaX: 0, deltaY: 1, deltaMode: 2 }, 800), {
    kind: "zoom",
    delta: 800,
  });
  assert.deepEqual(wheelIntent({ deltaX: 0, deltaY: 5, ctrlKey: true }, 800), {
    kind: "zoom",
    delta: 5,
  });
  assert.deepEqual(wheelIntent({ deltaX: 5, deltaY: 0 }, 800), { kind: "pan", x: 5, y: 0 });
  assert.deepEqual(wheelIntent({ deltaX: 0, deltaY: 5, shiftKey: true }, 800), {
    kind: "pan",
    x: 5,
    y: 0,
  });
});
