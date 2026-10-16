import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Tracer, TracerError } from "@tracer-local/core";
import { SQLiteRepository } from "@tracer-local/core/sqlite";
import { productModel } from "./product-model-schema.ts";

// Run from the checkout: node examples/product-model.ts
// Disposable database only: no owner database is opened or modified.
const directory = mkdtempSync(join(tmpdir(), "tracer-product-model-"));
const database = join(directory, "project.sqlite");
const provenance = { actor: "product-model-example", reason: "Fictional tutorial" };
let productId: string;
let requirementId: string;
try {
  const repository = new SQLiteRepository(database);
  try {
    const tracer = new Tracer(repository);
    assert.equal(await tracer.getSchema(), undefined);
    const schema = await tracer.setSchema({ schema: productModel, expectedVersion: 0, provenance });
    const context = { expectedSchemaVersion: schema.version, provenance };
    const product = await tracer.createEntity({
      type: "product",
      key: "PROD-001",
      fields: { title: "Desk light" },
      ...context,
    });
    const requirement = await tracer.createEntity({
      type: "requirement",
      key: "REQ-001",
      fields: { title: "Adjustable brightness", statement: "The user can adjust brightness." },
      ...context,
    });
    const component = await tracer.createEntity({
      type: "component",
      key: "COMP-001",
      fields: { title: "LED controller" },
      ...context,
    });
    await tracer.applyChangeset({
      provenance,
      expectedSchemaVersion: schema.version,
      operations: [
        {
          op: "relationship.create",
          input: {
            type: "has_requirement",
            source: product.id,
            target: requirement.id,
            fields: {},
          },
        },
        {
          op: "relationship.create",
          input: {
            type: "allocated_to",
            source: requirement.id,
            target: component.id,
            fields: {},
          },
        },
      ],
    });
    const updated = await tracer.replaceEntityFields({
      id: requirement.id,
      expectedVersion: requirement.version,
      fields: { ...requirement.fields, title: "User-adjustable brightness" },
      ...context,
    });
    assert.equal(updated.version, requirement.version + 1);
    await assert.rejects(
      tracer.updateEntity({
        id: requirement.id,
        expectedVersion: requirement.version,
        fields: requirement.fields,
        ...context,
      }),
      (error: unknown) => error instanceof TracerError && error.code === "conflict",
    );
    const page = await tracer.queryEntities({ type: "requirement", limit: 1 });
    assert.equal(page.items[0].id, requirement.id);
    assert.equal(page.nextAfter, undefined);
    const trace = await tracer.traverse(product.id, { direction: "forward", maxDepth: 2 });
    assert.equal(trace.length, 2);
    productId = product.id;
    requirementId = requirement.id;
  } finally {
    repository.close();
  }
  const reopened = new SQLiteRepository(database);
  try {
    const tracer = new Tracer(reopened);
    const snapshot = await tracer.getProjectSnapshot();
    assert.equal(snapshot.entities.length, 3);
    assert.equal(snapshot.relationships.length, 2);
    assert.equal(snapshot.entities.find((item) => item.id === productId)?.key, "PROD-001");
    assert.equal(
      snapshot.entities.find((item) => item.id === requirementId)?.fields.title,
      "User-adjustable brightness",
    );
    console.log("Verified: model, 3 items, 2 links, version conflict, trace and database reopen.");
  } finally {
    reopened.close();
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
