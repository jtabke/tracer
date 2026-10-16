import test from "node:test";
import assert from "node:assert/strict";
import { traceEmphasis } from "../../ui/map/trace-emphasis.ts";
const edge = (id, source, target) => ({ id, source, target, linkIds: [id] });
const graph = {
  nodes: ["root", "a", "b", "c", "other"].map((id) => ({ id })),
  edges: [
    edge("1", "root", "a"),
    edge("2", "a", "b"),
    edge("3", "b", "c"),
    edge("4", "root", "other"),
    edge("5", "other", "c"),
    edge("6", "c", "a"),
  ],
};
test("path emphasis retains a complete deterministic route and separates the next step from siblings", () => {
  const path = traceEmphasis(graph, ["root"], "b");
  assert.deepEqual(path.nodeIds, ["root", "a", "b"]);
  assert.deepEqual(path.edgeIds, ["1", "2"]);
  assert.deepEqual(path.nextEdgeIds, ["3"]);
  assert.equal(new Set(path.nodeIds).size, path.nodeIds.length);
  assert.deepEqual(traceEmphasis(graph, ["root"], "c").edgeIds, ["4", "5"]);
});
test("upstream/both routes keep recorded edge identity, and absent/allowed-only paths are never fabricated", () => {
  assert.deepEqual(traceEmphasis(graph, ["b"], "root", "upstream").edgeIds, ["2", "1"]);
  assert.equal(traceEmphasis(graph, ["b"], "root").found, false);
  assert.equal(traceEmphasis(graph, ["b"], "root", "both").found, true);
  assert.equal(traceEmphasis(graph, ["root"], null).found, false);
  assert.equal(
    traceEmphasis(
      { ...graph, edges: [{ ...edge("allowed", "root", "b"), linkIds: [] }] },
      ["root"],
      "b",
    ).found,
    false,
  );
  assert.deepEqual(traceEmphasis(graph, ["root"], "root").nextEdgeIds, ["1", "4"]);
  const filtered = { ...graph, edges: graph.edges.filter((edge) => edge.id !== "1") };
  assert.equal(traceEmphasis(filtered, ["root"], "b").edgeIds.includes("1"), false);
});

test("continuing along a linked item retains the followed route instead of switching to a shorter sibling shortcut", () => {
  const followed = traceEmphasis(graph, ["root"], "b");
  const next = traceEmphasis(graph, ["root"], "c", "downstream", followed);
  assert.deepEqual(next.edgeIds, ["1", "2", "3"]);
  assert.deepEqual(traceEmphasis(graph, ["root"], "a", "downstream", next).edgeIds, ["1"]);
  const filtered = { ...graph, edges: graph.edges.filter((edge) => edge.id !== "2") };
  assert.deepEqual(traceEmphasis(filtered, ["root"], "c", "downstream", next).edgeIds, ["4", "5"]);
});
