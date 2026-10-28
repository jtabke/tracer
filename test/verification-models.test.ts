import test from "node:test";
import assert from "node:assert/strict";
import { verificationFixture, verificationActor as actor } from "./verification-fixture.ts";
import { parseVerificationModel, verificationSchema } from "../src/core/verification-model.ts";
import type { VerificationModel } from "../src/core/verification-model.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: verification definitions stay pinned across native edits, deletion, schema changes and reopen`, async () => {
    const f = await verificationFixture(domain);
    try {
      const before = await f.tracer.exportProject(),
        value = await f.tracer.verification.resolveModel(f.input.model);
      assert.deepEqual(value.definition, f.definition);
      assert.equal(value.compatibility.writable, true);
      assert.deepEqual(await f.tracer.exportProject(), before);
      value.definition.states.open = "caller mutation";
      const updated = {
        ...f.definition,
        policy: { allowAssessedDesignChanges: !f.definition.policy.allowAssessedDesignChanges },
      };
      await f.tracer.updateEntity(f.profile.id, 1, { fields: { definition: updated } }, 1, actor);
      assert.deepEqual(
        (await f.tracer.verification.resolveModel(f.input.model)).definition,
        f.definition,
      );
      assert.deepEqual(
        (await f.tracer.verification.resolveModel({ ...f.input.model, version: 2 })).definition,
        updated,
      );
      await f.tracer.removeEntity(f.profile.id, 2, 1, actor);
      f.reopen();
      assert.equal(
        (await f.tracer.verification.resolveModel(f.input.model)).source.currentVersion,
        null,
      );
      const schema = structuredClone(f.schema);
      delete schema.entityTypes[f.definition.case.type].fields[f.definition.case.fields.conclusion];
      await f.tracer.setSchema(schema, 1, actor);
      const historical = await f.tracer.verification.resolveModel(f.input.model);
      assert.equal(historical.compatibility.writable, false);
      assert.equal(historical.pinnedSchemaVersion, 1);
      assert.equal(historical.context.schemaVersion, 2);
      assert.deepEqual(historical.definition, f.definition);
      assert.ok(
        historical.compatibility.issues.some((x) =>
          x.path.includes(f.definition.case.fields.conclusion),
        ),
      );
    } finally {
      f.close();
    }
  });

test("verification model rejects unsupported rules, aliased roles and ambiguous vocabulary", async () => {
  const f = await verificationFixture();
  try {
    const before = await f.tracer.exportProject(),
      d = f.definition;
    const invalid = [
      { ...d, version: 2 },
      { ...d, rules: [] },
      { ...d, policy: {} },
      { ...d, policy: { allowAssessedDesignChanges: true, acceptUnknown: true } },
      {
        ...d,
        requirement: { ...d.requirement, fields: { ...d.requirement.fields, acceptance: [] } },
      },
      {
        ...d,
        requirement: {
          ...d.requirement,
          fields: { ...d.requirement.fields, acceptance: [d.requirement.fields.statement] },
        },
      },
      { ...d, execution: { ...d.execution, type: d.case.type } },
      { ...d, case: { ...d.case, fields: { ...d.case.fields, selection: d.case.fields.basis } } },
      { ...d, outcomes: { ...d.outcomes, failed: d.outcomes.passed } },
      { ...d, relationships: { ...d.relationships, caseExecution: " " } },
    ];
    for (const value of invalid)
      assert.throws(() => parseVerificationModel(value), { code: "validation" });
    for (const pin of [
      { ...f.input.model, version: 0 },
      { ...f.input.model, extra: true },
      { ...f.input.model, field: "missing" },
    ])
      await assert.rejects(f.tracer.verification.resolveModel(pin), { code: "validation" });
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});

test("verification compatibility distinguishes existing method metadata from owned membership metadata", async () => {
  const f = await verificationFixture();
  try {
    await f.tracer.removeRelationship(f.relationship.id, f.relationship.version, 1, actor);
    const schema = structuredClone(f.schema);
    schema.entityTypes[f.definition.case.type].fields.reason = { type: "string", required: true };
    schema.relationshipTypes[f.definition.relationships.requirementMethod].fields.scope = {
      type: "string",
      required: true,
    };
    await f.tracer.setSchema(schema, 1, actor);
    const valid = await f.tracer.verification.resolveModel(f.input.model);
    assert.equal(valid.compatibility.writable, true);
    assert.deepEqual(valid.requiredFields.case, { reason: { type: "string", required: true } });
    schema.relationshipTypes[f.definition.relationships.caseExecution].fields.scope = {
      type: "string",
      required: true,
    };
    await f.tracer.setSchema(schema, 2, actor);
    assert.equal(
      (await f.tracer.verification.resolveModel(f.input.model)).compatibility.writable,
      false,
    );
    schema.relationshipTypes[f.definition.relationships.caseExecution].fields = {};
    schema.relationshipTypes[f.definition.relationships.requirementCase].target = [];
    await f.tracer.setSchema(schema, 3, actor);
    assert.equal(
      (await f.tracer.verification.resolveModel(f.input.model)).compatibility.writable,
      false,
    );
  } finally {
    f.close();
  }
});

test("verification schema construction owns prototype-like data names without mutating the descriptor", async () => {
  const f = await verificationFixture();
  try {
    const model: VerificationModel = structuredClone(f.definition);
    model.requirement.fields.acceptance = ["__proto__", "constructor"];
    const before = structuredClone(model),
      schema = verificationSchema(model);
    assert.ok(Object.hasOwn(schema.entityTypes[model.requirement.type].fields, "__proto__"));
    assert.deepEqual(schema.entityTypes[model.requirement.type].fields.__proto__, {
      type: "string",
      required: true,
    });
    assert.deepEqual(model, before);
    assert.equal(
      Object.getPrototypeOf(schema.entityTypes[model.requirement.type].fields),
      Object.prototype,
    );
  } finally {
    f.close();
  }
});

test("verification definitions enforce payload/metadata bounds and read external carriers as native annotations", async () => {
  const f = await verificationFixture();
  try {
    await f.tracer.evidence.bindExternal(
      { entityId: f.profile.id, system: "file", externalId: "profile.json", ownership: "external" },
      actor,
    );
    assert.deepEqual(
      (await f.tracer.verification.resolveModel(f.input.model)).definition,
      f.definition,
    );
    assert.throws(
      () =>
        parseVerificationModel({
          ...f.definition,
          outcomes: { ...f.definition.outcomes, passed: "x".repeat(65536) },
        }),
      /64 KiB/,
    );
    const schema = structuredClone(f.schema);
    for (let i = 0; i < 51; i++)
      schema.entityTypes[f.definition.execution.type].fields["required_" + i] = {
        type: "string",
        required: true,
      };
    await f.tracer.setSchema(schema, 1, actor);
    const before = await f.tracer.exportProject(),
      result = await f.tracer.verification.resolveModel(f.input.model);
    assert.equal(result.compatibility.writable, false);
    assert.equal(result.requiredFields.execution, null);
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});
