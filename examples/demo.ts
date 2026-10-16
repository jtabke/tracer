import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";

const repository = new SQLiteRepository(process.argv[2] ?? ":memory:");
try {
  const tracer = new Tracer(repository);
  const actor = { actor: "demo", reason: "Prove domain independence" };
  const types = [
    "requirement",
    "design",
    "test",
    "hypothesis",
    "experiment",
    "dataset",
    "conclusion",
  ];
  await tracer.setSchema(
    {
      entityTypes: Object.fromEntries(
        types.map((type) => [type, { fields: { title: { type: "string", required: true } } }]),
      ),
      relationshipTypes: {
        implemented_by: { source: ["requirement"], target: ["design"], fields: {} },
        verified_by: { source: ["design"], target: ["test"], fields: {} },
        explored_by: { source: ["hypothesis"], target: ["experiment"], fields: {} },
        produces: { source: ["experiment"], target: ["dataset"], fields: {} },
        supports: { source: ["dataset"], target: ["conclusion"], fields: {} },
      },
    },
    0,
    actor,
  );
  const requirement = await tracer.createEntity(
    { type: "requirement", key: "REQ-001", fields: { title: "Authenticate users" } },
    1,
    actor,
  );
  const design = await tracer.createEntity(
    { type: "design", fields: { title: "Credential validation" } },
    1,
    actor,
  );
  const test = await tracer.createEntity(
    { type: "test", fields: { title: "Reject invalid credentials" } },
    1,
    actor,
  );
  const hypothesis = await tracer.createEntity(
    { type: "hypothesis", fields: { title: "Treatment improves yield" } },
    1,
    actor,
  );
  const experiment = await tracer.createEntity(
    { type: "experiment", fields: { title: "Controlled treatment trial" } },
    1,
    actor,
  );
  const dataset = await tracer.createEntity(
    { type: "dataset", fields: { title: "Trial observations" } },
    1,
    actor,
  );
  const conclusion = await tracer.createEntity(
    { type: "conclusion", fields: { title: "Treatment improves yield in tested conditions" } },
    1,
    actor,
  );
  await tracer.applyChangeset(
    {
      expectedSchemaVersion: 1,
      operations: [
        {
          op: "relationship.create",
          input: { type: "implemented_by", source: requirement.id, target: design.id, fields: {} },
        },
        {
          op: "relationship.create",
          input: { type: "verified_by", source: design.id, target: test.id, fields: {} },
        },
        {
          op: "relationship.create",
          input: { type: "explored_by", source: hypothesis.id, target: experiment.id, fields: {} },
        },
        {
          op: "relationship.create",
          input: { type: "produces", source: experiment.id, target: dataset.id, fields: {} },
        },
        {
          op: "relationship.create",
          input: { type: "supports", source: dataset.id, target: conclusion.id, fields: {} },
        },
      ],
    },
    actor,
  );
  console.log(
    JSON.stringify(
      {
        entities: (await tracer.queryEntities()).items,
        relationships: (await tracer.queryRelationships()).items,
        engineeringTrace: await tracer.traverse(requirement.id),
        researchTrace: await tracer.traverse(hypothesis.id),
        revisions: (await tracer.history()).items.length,
        changesets: (await tracer.changesets()).length,
      },
      null,
      2,
    ),
  );
} finally {
  repository.close();
}
