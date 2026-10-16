import test from "node:test";
import assert from "node:assert/strict";
import { validateSchema } from "../src/core/model.ts";
import type { Schema } from "../src/core/model.ts";
import { projectTemplates } from "../src/core/project-templates.ts";
import { exampleWorkflow, workflowProposal } from "../src/core/workflow-presets.ts";
import { modelFlow } from "../ui/model-flow.ts";
import { medicalDeviceExample } from "../examples/medical-device-example.ts";
import { technologyExample } from "../examples/technology-example.ts";
import { integratedProductExample } from "../examples/integrated-product-example.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { seedWorkspace } from "../examples/seed-workspace.ts";

const schemaWithRoute = (route: unknown): Schema => ({
  entityTypes: { need: { fields: {} }, requirement: { fields: {} }, design: { fields: {} } },
  relationshipTypes: {
    contributes_to: {
      source: ["requirement"],
      target: ["need"],
      fields: {},
      workflow: [route] as never,
    },
  },
});
const reverseRoute = {
  source: "requirement",
  target: "need",
  direction: "reverse",
  label: "defines design inputs",
};

test("development flow can reverse a trace without reversing its native endpoints", () => {
  const schema = schemaWithRoute(reverseRoute);
  validateSchema(schema);
  const trace = modelFlow(schema, "trace").routes[0];
  const flow = modelFlow(schema, "workflow").routes[0];
  assert.deepEqual([trace.source.name, trace.target.name], ["requirement", "need"]);
  assert.deepEqual([flow.source.name, flow.target.name], ["need", "requirement"]);
  assert.equal(flow.label, "defines design inputs");
  assert.ok(flow.source.x < flow.target.x);
  assert.deepEqual(schema.relationshipTypes.contributes_to.source, ["requirement"]);
});

test("workflow metadata rejects invalid types, constraints, directions, labels and duplicate paths", () => {
  const invalid = [
    null,
    [],
    { ...reverseRoute, source: "missing" },
    { ...reverseRoute, source: "design" },
    { ...reverseRoute, target: "requirement" },
    { ...reverseRoute, direction: ["forward"] },
    { ...reverseRoute, direction: "sideways" },
    { ...reverseRoute, label: "  " },
    { ...reverseRoute, label: "x".repeat(121) },
    { ...reverseRoute, feedback: "true" },
  ];
  for (const route of invalid)
    assert.throws(() => validateSchema(schemaWithRoute(route)), { code: "validation" });
  const duplicate = schemaWithRoute(reverseRoute);
  duplicate.relationshipTypes.contributes_to.workflow!.push({ ...reverseRoute } as never);
  assert.throws(() => validateSchema(duplicate), { code: "validation" });
  duplicate.relationshipTypes.contributes_to.workflow = [];
  assert.doesNotThrow(() => validateSchema(duplicate));
  delete duplicate.relationshipTypes.contributes_to.workflow;
  assert.doesNotThrow(() => validateSchema(duplicate));
});

test("Any endpoints allow explicit workflow paths while None permits no path", () => {
  const schema = schemaWithRoute(reverseRoute);
  delete schema.relationshipTypes.contributes_to.source;
  delete schema.relationshipTypes.contributes_to.target;
  validateSchema(schema);
  assert.equal(modelFlow(schema, "trace").routes.length, 0);
  assert.equal(modelFlow(schema, "workflow").routes.length, 1);
  schema.relationshipTypes.contributes_to.source = [];
  assert.throws(() => validateSchema(schema), { code: "validation" });
});

test("engineering flow gives tests the design under test and requirement acceptance criteria", () => {
  const schema = projectTemplates.engineering.schema;
  validateSchema(schema);
  const paths = modelFlow(schema, "workflow").routes.map((route) => [
    route.source.name,
    route.target.name,
    route.label,
  ]);
  assert.deepEqual(paths, [
    ["intent", "requirement", "defines requirements"],
    ["requirement", "design", "design input"],
    ["requirement", "test", "acceptance criteria"],
    ["design", "test", "design under test"],
  ]);
  assert.equal(modelFlow(schema, "trace").routes[0].source.name, "requirement");
});

test("example workflows remain project owned, validate against permissions and retain fields", () => {
  for (const [name, example] of [
    ["medical", medicalDeviceExample],
    ["technology", technologyExample],
    ["integrated", integratedProductExample],
  ] as const) {
    const before = structuredClone(example.schema);
    const enriched = exampleWorkflow(example.schema, name);
    validateSchema(enriched);
    assert.deepEqual(example.schema, before);
    assert.deepEqual(enriched.entityTypes, before.entityTypes);
    for (const [key, definition] of Object.entries(before.relationshipTypes)) {
      const { workflow: _, ...permissions } = enriched.relationshipTypes[key];
      assert.deepEqual(permissions, definition);
    }
    assert.ok(modelFlow(enriched, "workflow").routes.length > 0);
    assert.deepEqual(workflowProposal(example.schema), enriched);
    assert.equal(workflowProposal(enriched), enriched);
  }
});

test("legacy enrichment is reviewable, leaves native state unchanged and preserves authored flow", async () => {
  const legacy = structuredClone(projectTemplates.engineering.schema);
  delete legacy.relationshipTypes.tested_by;
  for (const definition of Object.values(legacy.relationshipTypes)) delete definition.workflow;
  const before = structuredClone(legacy);
  const proposal = workflowProposal(legacy);
  assert.notEqual(proposal, legacy);
  validateSchema(proposal);
  assert.deepEqual(legacy, before);
  assert.deepEqual(
    proposal.relationshipTypes.mapped_to.fields,
    before.relationshipTypes.mapped_to.fields,
  );
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    await tracer.setSchema(legacy, 0, { actor: "workflow-test" });
    const head = (await tracer.timeline()).head;
    workflowProposal((await tracer.getSchema())!);
    assert.equal((await tracer.timeline()).head, head);
    assert.equal((await tracer.getSchema())?.relationshipTypes.tested_by, undefined);
  } finally {
    repository.close();
  }
  const authored = structuredClone(legacy);
  authored.relationshipTypes.mapped_to.workflow = [];
  assert.equal(workflowProposal(authored), authored);
  const arbitrary = schemaWithRoute(reverseRoute);
  delete arbitrary.relationshipTypes.contributes_to.workflow;
  assert.equal(workflowProposal(arbitrary), arbitrary);
  legacy.relationshipTypes.mapped_to.target = ["test", "design"];
  assert.equal(workflowProposal(legacy), legacy);
});

test("starter examples record a design or implementation under test without fabricating an execution result", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-workflow-seeds-"));
  try {
    for (const domain of ["engineering", "software"] as const) {
      const fixture = await seedWorkspace(join(directory, domain), domain);
      const repository = new SQLiteRepository(fixture.database);
      try {
        const tracer = new Tracer(repository);
        const graph = await tracer.getGraph({ rootId: fixture.requirements[0].id, depth: 3 });
        const testNode = fixture.outputs.at(-1)!;
        const tested = graph.links.filter((value) => value.type === "tested_by");
        assert.equal(tested.length, 1);
        assert.equal(tested[0].source, fixture.outputs[0].id);
        assert.equal(tested[0].target, testNode.id);
        assert.ok(
          graph.links.some((value) => value.type === "mapped_to" && value.target === testNode.id),
        );
        assert.ok(graph.nodes.some((value) => value.id === testNode.id));
        assert.deepEqual(tested[0].fields, {});
        assert.match(
          String(testNode.fields.statement),
          /No execution or passing result is recorded/,
        );
        assert.deepEqual(graph.evaluations, []);
      } finally {
        repository.close();
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
