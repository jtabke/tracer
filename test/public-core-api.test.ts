import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";
import { Tracer, TracerError } from "@tracer-local/core";
import type { CreateEntityCommand, EntityQuery, RelationshipQuery } from "@tracer-local/core";
import { SQLiteRepository } from "@tracer-local/core/sqlite";
import { productModel } from "../examples/product-model-schema.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

const provenance = { actor: "public-api-test" };
const productInput = { type: "product", fields: { title: "Desk light" } };
const uuid = "00000000-0000-4000-8000-000000000001";
async function fixture(work: (tracer: Tracer) => Promise<void>) {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    await tracer.setSchema({ schema: productModel, expectedVersion: 0, provenance });
    await work(tracer);
  } finally {
    repository.close();
  }
}

test("public entry points support named and positional writes, exact reads and explicit replacement", async () => {
  await fixture(async (tracer) => {
    const context = { expectedSchemaVersion: 1, provenance };
    const product = await tracer.createEntity({ ...productInput, ...context, id: uuid });
    assert.equal(product.id, uuid);
    const requirement = await tracer.createEntity(
      { type: "requirement", fields: { title: "Light", statement: "Adjust brightness" } },
      1,
      provenance,
    );
    const link = await tracer.createRelationship({
      type: "has_requirement",
      source: product.id,
      target: requirement.id,
      fields: {},
      expectedEndpoints: { sourceVersion: 1, targetVersion: 1 },
      rejectExisting: true,
      ...context,
    });
    assert.deepEqual(await tracer.getEntity(product.id), product);
    assert.deepEqual(await tracer.getRelationship(link.id), link);
    const updated = await tracer.updateEntity({
      id: requirement.id,
      expectedVersion: 1,
      fields: { ...requirement.fields, title: "Brightness" },
      ...context,
    });
    assert.equal(updated.version, 2);
    const rel = await tracer.updateRelationship({
      ...link,
      fields: {},
      expectedVersion: 1,
      ...context,
    });
    assert.equal(rel.version, 2);
    await tracer.removeRelationship({ id: link.id, expectedVersion: 2, ...context });
    await tracer.removeEntity({ id: requirement.id, expectedVersion: 2, ...context });
    const withOptional = structuredClone(productModel);
    withOptional.entityTypes.product.fields.note = { type: "string" };
    await tracer.setSchema({ schema: withOptional, expectedVersion: 1, provenance });
    const withNote = await tracer.updateEntity(
      product.id,
      1,
      { fields: { title: "Desk light", note: "temporary" } },
      2,
      provenance,
    );
    const replaced = await tracer.replaceEntityFields({
      id: product.id,
      expectedVersion: withNote.version,
      expectedSchemaVersion: 2,
      fields: { title: "New title" },
      provenance,
    });
    assert.deepEqual(replaced.fields, { title: "New title" });
    await tracer.applyChangeset({
      expectedSchemaVersion: 2,
      provenance,
      operations: [
        {
          op: "entity.update",
          id: product.id,
          expectedVersion: replaced.version,
          input: { fields: { title: "Atomic edit" } },
        },
      ],
    });
    assert.equal((await tracer.getEntity(product.id)).fields.title, "Atomic edit");
  });
});

test("named writes capture caller intent, reject stale guards and make create retries inspectable", async () => {
  await fixture(async (tracer) => {
    const request: CreateEntityCommand = {
      ...productInput,
      fields: { title: "Captured" },
      id: uuid,
      expectedSchemaVersion: 1,
      provenance: { ...provenance },
    };
    const pending = tracer.createEntity(request);
    request.fields.title = "Mutated";
    request.provenance.actor = "Mutated";
    assert.equal((await pending).fields.title, "Captured");
    const original = await tracer.getEntity(uuid);
    const before = await tracer.changesets();
    await assert.rejects(
      tracer.createEntity({ ...productInput, id: uuid, expectedSchemaVersion: 1, provenance }),
      { code: "conflict" },
    );
    assert.deepEqual(await tracer.changesets(), before);
    assert.deepEqual(await tracer.getEntity(uuid), original);
    await tracer.updateEntity({
      id: uuid,
      expectedVersion: 1,
      expectedSchemaVersion: 1,
      fields: { title: "Updated" },
      provenance,
    });
    await assert.rejects(
      tracer.updateEntity({
        id: uuid,
        expectedVersion: 1,
        expectedSchemaVersion: 1,
        fields: { title: "Stale" },
        provenance,
      }),
      (error: unknown) => {
        assert.ok(error instanceof TracerError);
        assert.equal(error.code, "conflict");
        assert.deepEqual(error.details, {
          kind: "entity",
          id: uuid,
          expectedVersion: 1,
          actualVersion: 2,
        });
        return true;
      },
    );
    await assert.rejects(
      tracer.createRelationship({
        type: "has_requirement",
        source: uuid,
        target: uuid,
        fields: {},
        expectedSchemaVersion: 1,
        provenance,
      }),
      (error: unknown) =>
        error instanceof TracerError &&
        error.code === "validation" &&
        error.details?.kind === "relationship" &&
        error.details.path?.join(".") === "target",
    );
    await assert.rejects(
      tracer.createEntity({ type: "product", fields: {}, expectedSchemaVersion: 1, provenance }),
      (error: unknown) =>
        error instanceof TracerError && error.details?.path?.join(".") === "fields.title",
    );
    await assert.rejects(tracer.getEntity("missing"), {
      code: "not_found",
      details: { kind: "entity", id: "missing" },
    });
    await assert.rejects(tracer.getRelationship(""), { code: "validation" });
  });
});

test("named link guards, duplicate policy and cascades remain atomic", async () => {
  await fixture(async (tracer) => {
    const context = { expectedSchemaVersion: 1, provenance };
    const source = await tracer.createEntity({ ...productInput, ...context });
    const target = await tracer.createEntity({
      type: "requirement",
      fields: { title: "R", statement: "S" },
      ...context,
    });
    const input = {
      type: "has_requirement",
      source: source.id,
      target: target.id,
      fields: {},
      ...context,
    };
    await assert.rejects(
      tracer.createRelationship({
        ...input,
        expectedEndpoints: { sourceVersion: 2, targetVersion: 1 },
      }),
      { code: "conflict" },
    );
    const link = await tracer.createRelationship({ ...input, rejectExisting: true });
    await assert.rejects(tracer.createRelationship({ ...input, rejectExisting: true }), {
      code: "conflict",
    });
    await assert.rejects(tracer.removeEntity({ id: source.id, expectedVersion: 1, ...context }), {
      code: "referential_integrity",
    });
    assert.deepEqual(await tracer.getRelationship(link.id), link);
    await tracer.removeEntity({ id: source.id, expectedVersion: 1, cascade: true, ...context });
    await assert.rejects(tracer.getRelationship(link.id), { code: "not_found" });
    assert.equal((await tracer.getEntity(target.id)).version, 1);
  });
});

test("model preview reports all incompatible records with bounded issues and never writes", async () => {
  await fixture(async (tracer) => {
    const context = { expectedSchemaVersion: 1, provenance };
    const product = await tracer.createEntity({ ...productInput, ...context });
    const requirement = await tracer.createEntity({
      type: "requirement",
      fields: { title: "R", statement: "S" },
      ...context,
    });
    await tracer.createRelationship({
      type: "has_requirement",
      source: product.id,
      target: requirement.id,
      fields: {},
      ...context,
    });
    const before = await tracer.getProjectSnapshot();
    const history = await tracer.history();
    const changed = structuredClone(productModel);
    changed.entityTypes.product.fields.cost = { type: "number", required: true };
    changed.relationshipTypes.has_requirement.target = ["component"];
    changed.relationshipTypes.has_requirement.workflow = [];
    const preview = await tracer.previewSchema({ schema: changed, expectedVersion: 1, limit: 1 });
    assert.equal(preview.valid, false);
    assert.deepEqual(preview.checked, { entities: 2, relationships: 1 });
    assert.equal(preview.totalIssues, 2);
    assert.equal(preview.issues.length, 1);
    assert.equal(preview.truncated, true);
    assert.deepEqual(preview.issues[0].path, ["fields", "cost"]);
    assert.ok(preview.changes.some((x) => x.name === "has_requirement" && x.change === "changed"));
    await assert.rejects(tracer.setSchema(changed, 1, provenance), { code: "validation" });
    assert.deepEqual(await tracer.getProjectSnapshot(), before);
    assert.deepEqual(await tracer.history(), history);
    const compatible = structuredClone(productModel);
    compatible.entityTypes.product.fields.note = { type: "string" };
    assert.equal(
      (await tracer.previewSchema({ schema: compatible, expectedVersion: 1 })).valid,
      true,
    );
    await tracer.setSchema(compatible, 1, provenance);
    await assert.rejects(tracer.previewSchema({ schema: compatible, expectedVersion: 1 }), {
      code: "schema_conflict",
      details: { kind: "schema", id: "project", expectedVersion: 1, actualVersion: 2 },
    });
    await assert.rejects(
      tracer.previewSchema({ schema: compatible, expectedVersion: 2, limit: 0 }),
      { code: "validation" },
    );
  });
});

test("resource query contracts reject invalid filters at compile time and runtime", async () => {
  const invalidEntity: EntityQuery = {
    // @ts-expect-error relationship-only filter
    source: "id",
  };
  const invalidRelationship: RelationshipQuery = {
    // @ts-expect-error entity-only filter
    key: "key",
  };
  await fixture(async (tracer) => {
    await assert.rejects(tracer.queryEntities(invalidEntity), { code: "validation" });
    await assert.rejects(tracer.queryRelationships(invalidRelationship), { code: "validation" });
  });
  const options: ts.CompilerOptions = {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    allowImportingTsExtensions: true,
  };
  const program = ts.createProgram([resolve("test/public-core-api.test.ts")], options);
  assert.deepEqual(
    ts
      .getPreEmitDiagnostics(program)
      .map((x) => ts.flattenDiagnosticMessageText(x.messageText, "\n")),
    [],
  );
});

test("HTTP and CLI preserve structured errors and CLI preview allocates no revisions", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-public-api-"));
  const database = join(directory, "project.sqlite");
  const repository = new SQLiteRepository(database);
  const tracer = new Tracer(repository);
  await tracer.setSchema(productModel, 0, provenance);
  const product = await tracer.createEntity(productInput, 1, provenance);
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  try {
    const { token } = await (await fetch(server.origin + "/api/session")).json();
    const response = await fetch(server.origin + "/api/changesets", {
      method: "POST",
      headers: {
        Origin: server.origin,
        "Content-Type": "application/json",
        "X-Tracer-Token": token,
      },
      body: JSON.stringify({
        expectedSchemaVersion: 1,
        operations: [
          {
            op: "entity.update",
            id: product.id,
            expectedVersion: 99,
            input: { fields: product.fields },
          },
        ],
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 409);
    assert.deepEqual(body.details, {
      kind: "entity",
      id: product.id,
      expectedVersion: 99,
      actualVersion: 1,
    });
    const args = [
      "--disable-warning=ExperimentalWarning",
      "src/interfaces/cli.ts",
      "--db",
      database,
    ];
    const read = spawnSync(process.execPath, [...args, "entity", "get", product.id], {
      encoding: "utf8",
    });
    assert.equal(read.status, 0, read.stderr);
    assert.deepEqual(JSON.parse(read.stdout), product);
    const before = await tracer.changesets();
    const preview = spawnSync(
      process.execPath,
      [...args, "schema", "preview", JSON.stringify({ schema: productModel, expectedVersion: 1 })],
      { encoding: "utf8" },
    );
    assert.equal(preview.status, 0, preview.stderr);
    assert.equal(JSON.parse(preview.stdout).valid, true);
    assert.deepEqual(await tracer.changesets(), before);
    const missing = spawnSync(process.execPath, [...args, "entity", "get", "missing"], {
      encoding: "utf8",
    });
    assert.equal(missing.status, 1);
    assert.deepEqual(JSON.parse(missing.stderr), {
      error: "not_found",
      message: "Object not found",
      details: { kind: "entity", id: "missing" },
    });
  } finally {
    await server.close();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a compatible preview is not a reservation and definition order is insignificant", async () => {
  await fixture(async (tracer) => {
    const reordered = {
      ...productModel,
      entityTypes: Object.fromEntries(Object.entries(productModel.entityTypes).reverse()),
    };
    assert.deepEqual(
      (await tracer.previewSchema({ schema: reordered, expectedVersion: 1 })).changes,
      [],
    );
    const candidate = structuredClone(productModel);
    candidate.entityTypes.product.fields.note = { type: "string", required: true };
    assert.equal(
      (await tracer.previewSchema({ schema: candidate, expectedVersion: 1 })).valid,
      true,
    );
    await tracer.createEntity(productInput, 1, provenance);
    await assert.rejects(tracer.setSchema({ schema: candidate, expectedVersion: 1, provenance }), {
      code: "validation",
    });
    assert.equal((await tracer.getSchema())?.version, 1);
    const deleted = structuredClone(productModel);
    delete deleted.entityTypes.component;
    delete deleted.relationshipTypes.allocated_to;
    const preview = await tracer.previewSchema({ schema: deleted, expectedVersion: 1 });
    assert.equal(preview.valid, true);
    assert.equal(preview.changes.filter((x) => x.change === "removed").length, 2);
    await assert.rejects(
      tracer.previewSchema({
        schema: {
          entityTypes: {},
          relationshipTypes: { bad: { source: ["missing"], fields: {} } },
        },
        expectedVersion: 1,
      }),
      { code: "validation" },
    );
  });
});
