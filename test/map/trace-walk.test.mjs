import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeAsterFixture } from "../../docs/ux-artifacts/map-first/aster-fixture.mjs";
import { indexFixture } from "../../ui/map/model.ts";
import { studyOrganization } from "../../docs/ux-artifacts/map-first/organization.mjs";
import {
  appendWalkStep,
  connectionChoices,
  walkProjection,
  WALK_LIMIT,
} from "../../ui/map/trace-walk.ts";
import { layoutProjection } from "../../ui/map/layout.ts";
import { stableLayout } from "../../ui/map/stable-layout.ts";
const data = makeAsterFixture(
  JSON.parse(
    readFileSync(new URL("../../docs/ux-artifacts/map-first/fixture.json", import.meta.url)),
  ),
);
const index = indexFixture(data),
  organization = studyOrganization(data);
const id = (key) => data.entities.find((entity) => entity.key === key).id;
const via = (steps, key, type) => {
  const choice = connectionChoices(index, steps.at(-1).id, organization).find(
    ({ other, link }) => other.key === key && (!type || link.type === type),
  );
  assert.ok(choice, key);
  return appendWalkStep(index, steps, choice.link.id);
};

test("walking follows exact recorded links across folders without expanding siblings or rewriting native directions", () => {
  let steps = [{ id: id("PRS-BAT-03") }];
  for (const key of ["SYS-BAT-03A", "CMP-BAT-03A", "OUT-BAT-03", "OUT-REC-03", "VER-REC-03"])
    steps = via(steps, key);
  const graph = walkProjection(index, organization, steps);
  assert.equal(graph.nodes.length, 6);
  assert.equal(graph.edges.length, 5);
  assert.ok(graph.nodes.every((node) => node.kind === "item" && !node.parentId));
  assert.deepEqual(graph.nodes.find((node) => node.id === id("OUT-REC-03")).folderPath, [
    "Usability",
    "Result review",
  ]);
  const examination = graph.edges.find((edge) => edge.type === "examines_output");
  assert.equal(examination.source, id("VER-REC-03"));
  assert.equal(examination.target, id("OUT-REC-03"));
  assert.equal(examination.linkIds[0], steps.at(-1).via);
});

test("revisits reuse canonical nodes/link IDs, and branch selection retains only the chosen prefix", () => {
  let steps = [{ id: id("OUT-REC-03") }];
  steps = via(steps, "VER-REC-03");
  steps = via(steps, "OUT-REC-03");
  const graph = walkProjection(index, organization, steps);
  assert.equal(steps.length, 3);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.scopedLinks, 1);
  const branched = via(steps.slice(0, 1), "OUT-SUP-04");
  assert.deepEqual(walkProjection(index, organization, branched).scopeIds, [
    id("OUT-REC-03"),
    id("OUT-SUP-04"),
  ]);
  assert.throws(() => appendWalkStep(index, steps, "missing"));
  assert.throws(() =>
    walkProjection(index, organization, [
      { id: id("OUT-REC-03") },
      { id: id("OUT-SUP-04"), via: "missing" },
    ]),
  );
  assert.throws(
    () =>
      appendWalkStep(
        index,
        Array.from({ length: WALK_LIMIT }, () => steps[0]),
        steps[1].via,
      ),
    /30-step/,
  );
});

test("all native incoming/outgoing choices remain discoverable by folder/key/kind even when a map would hide their types", () => {
  const current = id("OUT-REC-03"),
    all = connectionChoices(index, current, organization);
  assert.ok(all.some((choice) => choice.outgoing && choice.other.key === "OUT-SUP-04"));
  assert.ok(all.some((choice) => !choice.outgoing && choice.other.key === "VER-REC-03"));
  assert.equal(
    connectionChoices(index, current, organization, "supply integrity", "depends_on")[0].other.key,
    "OUT-SUP-04",
  );
  assert.equal(connectionChoices(index, current, organization, "VER-REC-03").length, 1);
  assert.equal(connectionChoices(index, current, organization, "no such record").length, 0);
});

for (const direction of ["DOWN", "RIGHT"])
  test(`incremental path reveal keeps existing positions and honors the chosen next-item position (${direction})`, async () => {
    const first = [{ id: id("OUT-REC-03") }],
      display = { direction };
    const initial = await layoutProjection(walkProjection(index, organization, first), display);
    const source = initial.nodes[0];
    const position = {
      x: source.position.x + (direction === "RIGHT" ? 390 : 0),
      y: source.position.y + (direction === "DOWN" ? 226 : 0),
    };
    const next = connectionChoices(index, first[0].id, organization).find(
      ({ other }) => other.key === "OUT-SUP-04",
    );
    const steps = appendWalkStep(index, first, next.link.id, position);
    const layout = stableLayout(
      walkProjection(index, organization, steps),
      display,
      initial,
      first[0].id,
    );
    assert.deepEqual(layout.nodes[0].position, source.position);
    assert.deepEqual(layout.nodes[1].position, position);
    assert.equal(layout.nodes[1].height, 126);
    assert.equal(layout.nodes[1].width, 280);
  });
