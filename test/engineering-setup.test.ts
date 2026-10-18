import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { projectTemplates } from "../src/core/project-templates.ts";
import { validateSchema } from "../src/core/model.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

const starter = projectTemplates.engineering;
const setup = () => ({
  schema: structuredClone(starter.schema),
  initialViews: structuredClone(starter.views!),
  expectedVersion: 0,
  provenance: { actor: "setup-test" },
});

test("Engineering setup persists editable schema, explicit coverage and legal recipes together across reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-setup-"));
  const path = join(directory, "project.sqlite");
  let repository = new SQLiteRepository(path);
  try {
    let tracer = new Tracer(repository);
    const command = setup();
    validateSchema(command.schema);
    const saved = await tracer.setSchema(command);
    assert.equal(saved.entityTypes.requirement.fields.acceptance.type, "string");
    assert.equal(saved.entityTypes.test.fields.method.type, "string");
    assert.equal(saved.entityTypes.design.fields.build.required, undefined);
    assert.equal(saved.relationshipTypes.mapped_to.fields.scope.required, false);
    const views = await tracer.savedViews.list();
    assert.equal(views.length, 3);
    assert.equal((await tracer.timeline()).head, 1);
    assert.equal((await tracer.history()).items.length, 1);
    const req = await tracer.createEntity(
      {
        type: "requirement",
        fields: { title: "CO₂ measurement", acceptance: "Within ±50 ppm in a simulated fixture" },
      },
      1,
      { actor: "engineer" },
    );
    const missing = await tracer.coverage.evaluate({ expectationId: "requirement_design" });
    assert.equal(missing.rows.items[0].state, "missing");
    const design = await tracer.createEntity(
      { type: "design", fields: { title: "Sensor design" } },
      1,
      { actor: "engineer" },
    );
    await tracer.createRelationship(
      { type: "mapped_to", source: req.id, target: design.id, fields: {} },
      1,
      { actor: "engineer" },
    );
    assert.equal(
      (await tracer.coverage.evaluate({ expectationId: "requirement_design" })).rows.items[0].state,
      "covered",
    );
    repository.close();
    repository = new SQLiteRepository(path);
    tracer = new Tracer(repository);
    assert.deepEqual(await tracer.savedViews.list(), views);
    assert.deepEqual(await tracer.getSchema(), saved);
    assert.deepEqual((await tracer.coverage.list()).expectations, saved.coverageExpectations);
    const { id: _, version: __, ...schema } = saved;
    schema.entityTypes.requirement.fields.owner = { type: "string" };
    await tracer.setSchema(schema, 1, { actor: "customize" });
    assert.deepEqual(await tracer.savedViews.list(), views);
  } finally {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("failed initial views roll back the model, history and every view; retries and competing setup are guarded", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    const bad = setup();
    bad.initialViews[1].definition = { kind: "chain", type: "missing", steps: [] };
    await assert.rejects(tracer.setSchema(bad), { code: "validation" });
    assert.equal(await tracer.getSchema(), undefined);
    assert.deepEqual(await tracer.savedViews.list(), []);
    assert.equal((await tracer.timeline()).head, 0);
    assert.deepEqual((await tracer.history()).items, []);
    const duplicate = setup();
    duplicate.initialViews[1].name = duplicate.initialViews[0].name;
    await assert.rejects(tracer.setSchema(duplicate), { code: "validation" });
    assert.deepEqual(await tracer.savedViews.list(), []);
    const command = setup();
    await tracer.setSchema(command);
    const before = await tracer.getProjectSnapshot();
    await assert.rejects(tracer.setSchema(command), { code: "schema_conflict" });
    await assert.rejects(tracer.setSchema({ ...command, expectedVersion: 1 }), {
      code: "validation",
    });
    assert.deepEqual(await tracer.getProjectSnapshot(), before);
    assert.equal((await tracer.savedViews.list()).length, 3);
  } finally {
    repository.close();
  }
});

test("HTTP initial setup validates envelope properties and saves through the guarded schema route", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  try {
    const { token } = await (await fetch(server.origin + "/api/session")).json();
    const { provenance: _, ...input } = setup();
    const post = (value: unknown, suppliedToken = token) =>
      fetch(server.origin + "/api/schema", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: server.origin,
          "X-Tracer-Token": suppliedToken,
        },
        body: JSON.stringify(value),
      });
    assert.equal((await post(input, "wrong")).status, 403);
    assert.equal((await post({ ...input, initialVeiws: [] })).status, 400);
    assert.equal((await post(input)).status, 200);
    assert.equal((await tracer.savedViews.list()).length, 3);
    assert.equal((await post(input)).status, 409);
    assert.equal((await tracer.timeline()).head, 1);
  } finally {
    await server.close();
    repository.close();
  }
});
