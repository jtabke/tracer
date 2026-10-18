import test from "node:test";
import assert from "node:assert/strict";
import { decodeRead } from "../src/interfaces/api-decoders.ts";
import { validateSchema, TracerError } from "../src/core/model.ts";
import { projectTemplates } from "../src/core/project-templates.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { resolve } from "node:path";

test("schema typos report their exact path throughout model definitions", () => {
  const paths: (string | number)[][] = [
    ["coverageExpectation"],
    ["entityTypes", "requirement", "field"],
    ["entityTypes", "requirement", "fields", "title", "requred"],
    ["relationshipTypes", "mapped_to", "sorce"],
    ["relationshipTypes", "mapped_to", "workflow", 0, "feedbak"],
    ["coverageExpectations", "tests", "minimumDistinctTarget"],
    ["coverageExpectations", "tests", "subject", "filtter"],
    ["coverageExpectations", "tests", "related", "filter", "equal"],
  ];
  for (const path of paths) {
    const schema = {
      ...structuredClone(projectTemplates.engineering.schema),
      coverageExpectations: {
        tests: {
          name: "Requirement tests",
          subject: { type: "requirement" },
          related: { type: "test", filter: { field: "title", equals: "Simulated" } },
          relationshipType: "mapped_to",
          direction: "outgoing",
          minimumDistinctTargets: 1,
        },
      },
    };
    let parent = schema as unknown as Record<string | number, unknown>;
    for (const key of path.slice(0, -1)) parent = parent[key] as typeof parent;
    parent[path.at(-1)!] = true;
    assert.throws(
      () => validateSchema(schema),
      (error) => {
        assert.ok(error instanceof TracerError);
        assert.equal(error.code, "validation");
        assert.deepEqual(error.details?.path, path);
        assert.ok(error.message.includes(path.join(".")));
        return true;
      },
    );
  }
  const legacy = {
    id: "project",
    version: 1,
    ...structuredClone(projectTemplates.engineering.schema),
    oldRootExtension: { retained: true },
  };
  Object.assign(legacy.entityTypes.requirement.fields.title, { oldFieldExtension: "retained" });
  assert.deepEqual(decodeRead("/api/schema", {}, legacy), legacy);
  assert.throws(() => validateSchema(legacy), { code: "validation" });
});

test("schema HTTP and preview reject misspelled coverage without dropping existing policy or adding history", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  const schema = {
    ...structuredClone(projectTemplates.engineering.schema),
    coverageExpectations: {
      tests: {
        name: "Requirement tests",
        subject: { type: "requirement" },
        related: { type: "test" },
        relationshipType: "mapped_to",
        direction: "outgoing" as const,
        minimumDistinctTargets: 1,
      },
    },
  };
  await tracer.setSchema(schema, 0, { actor: "test" });
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  try {
    const { token } = await (await fetch(server.origin + "/api/session")).json();
    const { coverageExpectations, ...base } = schema;
    const typo = { ...base, coverageExpectation: coverageExpectations };
    const before = await tracer.history();
    await assert.rejects(tracer.previewSchema({ schema: typo, expectedVersion: 1 }), {
      code: "validation",
      details: { path: ["coverageExpectation"] },
    });
    const response = await fetch(server.origin + "/api/schema", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: server.origin,
        "X-Tracer-Token": token,
      },
      body: JSON.stringify({ schema: typo, expectedVersion: 1 }),
    });
    assert.equal(response.status, 400);
    const error = await response.json();
    assert.deepEqual(error.details.path, ["coverageExpectation"]);
    assert.deepEqual((await tracer.getSchema())?.coverageExpectations, coverageExpectations);
    assert.deepEqual(await tracer.history(), before);
  } finally {
    await server.close();
    repository.close();
  }
});
