import test from "node:test";
import assert from "node:assert/strict";
import { applicationModelFixture } from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";
import {
  parseChangeAssessmentModel,
  applicationModelLimits,
} from "../src/core/application-model.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: production model resolution pins meaning through edits, deletion, reopen and schema changes`, async () => {
    const f = await applicationModelFixture(domain);
    try {
      const before = await f.tracer.exportProject(),
        resolved = await f.tracer.applicationModels.resolve(f.pin);
      assert.deepEqual(resolved.definition, f.definition);
      assert.equal(resolved.compatibility.writable, true);
      assert.equal(resolved.pinnedSchemaVersion, 2);
      assert.equal(resolved.source.currentVersion, 1);
      assert.equal(resolved.context.projectRevision, before.projectRevision);
      assert.equal(resolved.context.evidenceRevision, before.evidenceRevision);
      assert.deepEqual(await f.tracer.exportProject(), before);
      resolved.definition.policy.allowUnknown = true;
      assert.equal(
        (await f.tracer.applicationModels.resolve(f.pin)).definition.policy.allowUnknown,
        false,
      );
      await f.tracer.updateEntity(
        f.profile.id,
        1,
        {
          fields: {
            ...f.profile.fields,
            [f.pin.field]: { ...f.definition, policy: { allowUnknown: true } },
          },
        },
        2,
        actor,
      );
      assert.equal((await f.tracer.applicationModels.resolve(f.pin)).source.currentVersion, 2);
      assert.equal(
        (await f.tracer.applicationModels.resolve(f.pin)).definition.policy.allowUnknown,
        false,
      );
      assert.equal(
        (await f.tracer.applicationModels.resolve({ ...f.pin, version: 2 })).definition.policy
          .allowUnknown,
        true,
      );
      await f.tracer.removeEntity(f.profile.id, 2, 2, actor);
      f.base.reopen();
      assert.equal((await f.tracer.applicationModels.resolve(f.pin)).source.currentVersion, null);
      assert.deepEqual((await f.tracer.applicationModels.resolve(f.pin)).definition, f.definition);
      const schema = structuredClone(f.schema);
      delete schema.entityTypes[f.definition.assessment.type].fields[
        f.definition.assessment.fields.closure
      ];
      await f.tracer.setSchema(schema, 2, actor);
      const changed = await f.tracer.applicationModels.resolve(f.pin);
      assert.equal(changed.context.schemaVersion, 3);
      assert.equal(changed.pinnedSchemaVersion, 2);
      assert.equal(changed.compatibility.writable, false);
      assert.deepEqual(changed.compatibility.issues[0].path, ["assessment", "fields", "closure"]);
      assert.deepEqual(changed.definition, f.definition);
    } finally {
      f.close();
    }
  });

test("model contract rejects unknown rules, aliasing and unsupported versions without writes", async () => {
  const f = await applicationModelFixture();
  try {
    const before = await f.tracer.exportProject();
    const cases = [
      { ...f.definition, version: 2 },
      { ...f.definition, unknownRule: true },
      { ...f.definition, policy: { allowUnknown: "false" } },
      { ...f.definition, policy: { allowUnknown: false, approveAutomatically: true } },
      { ...f.definition, states: { open: "same", closed: "same" } },
      {
        ...f.definition,
        assessment: {
          ...f.definition.assessment,
          fields: {
            ...f.definition.assessment.fields,
            scope: f.definition.assessment.fields.model,
          },
        },
      },
      {
        ...f.definition,
        disposition: { ...f.definition.disposition, type: f.definition.assessment.type },
      },
      {
        ...f.definition,
        decisions: { ...f.definition.decisions, revise: f.definition.decisions.no_action },
      },
      { ...f.definition, relationships: { member: "" } },
      { ...f.definition, policy: null },
      { ...f.definition, oversized: "x".repeat(applicationModelLimits.definitionBytes) },
    ];
    for (const value of cases)
      assert.throws(() => parseChangeAssessmentModel(value), { code: "validation" });
    for (const pin of [
      { ...f.pin, version: 0 },
      { ...f.pin, version: 0.5 },
      { ...f.pin, field: "" },
      { ...f.pin, extra: 1 },
      { ...f.pin, entityId: " " },
    ])
      await assert.rejects(f.tracer.applicationModels.resolve(pin), { code: "validation" });
    await assert.rejects(f.tracer.applicationModels.resolve({ ...f.pin, field: "title" }), {
      code: "validation",
    });
    await assert.rejects(f.tracer.applicationModels.resolve({ ...f.pin, version: 99 }), {
      code: "not_found",
    });
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});

test("model compatibility checks exact fields, endpoint permissions and authorable membership metadata", async () => {
  const f = await applicationModelFixture();
  try {
    const mutations = [
      (s: typeof f.schema) => {
        s.entityTypes[f.definition.assessment.type].fields[
          f.definition.assessment.fields.scope
        ].type = "string";
      },
      (s: typeof f.schema) => {
        s.relationshipTypes[f.definition.relationships.member].source = [];
      },
      (s: typeof f.schema) => {
        s.relationshipTypes[f.definition.relationships.member].target = [
          f.definition.assessment.type,
        ];
      },
      (s: typeof f.schema) => {
        s.relationshipTypes[f.definition.relationships.member].reference = true;
      },
      (s: typeof f.schema) => {
        s.relationshipTypes[f.definition.relationships.member].fields.scope = {
          type: "string",
          required: true,
        };
      },
      (s: typeof f.schema) => {
        delete s.relationshipTypes[f.definition.relationships.member];
      },
      (s: typeof f.schema) => {
        delete s.entityTypes[f.definition.disposition.type];
        delete s.relationshipTypes[f.definition.relationships.member];
      },
    ];
    let version = 2;
    for (const mutate of mutations) {
      const schema = structuredClone(f.schema);
      mutate(schema);
      await f.tracer.setSchema(schema, version++, actor);
      const actual = await f.tracer.applicationModels.resolve(f.pin);
      assert.equal(actual.compatibility.writable, false);
      assert.ok(actual.compatibility.issues.length > 0);
    }
    const extra = structuredClone(f.schema);
    extra.entityTypes[f.definition.assessment.type].fields.owner = {
      type: "string",
      required: true,
    };
    await f.tracer.setSchema(extra, version++, actor);
    const result = await f.tracer.applicationModels.resolve(f.pin);
    assert.equal(result.compatibility.writable, true);
    assert.deepEqual(result.requiredFields.assessment, {
      owner: { type: "string", required: true },
    });
    delete extra.relationshipTypes[f.definition.relationships.member].source;
    delete extra.relationshipTypes[f.definition.relationships.member].target;
    await f.tracer.setSchema(extra, version++, actor);
    assert.equal((await f.tracer.applicationModels.resolve(f.pin)).compatibility.writable, true);
    for (let i = 0; i <= applicationModelLimits.extraRequiredFields; i++)
      extra.entityTypes[f.definition.assessment.type].fields["extra" + i] = {
        type: "string",
        required: true,
      };
    await f.tracer.setSchema(extra, version++, actor);
    const exceeded = await f.tracer.applicationModels.resolve(f.pin);
    assert.equal(exceeded.compatibility.writable, false);
    assert.equal(exceeded.requiredFields.assessment, null);
  } finally {
    f.close();
  }
});

test("model definitions must be valid against the schema that governed their exact native revision", async () => {
  const f = await applicationModelFixture();
  try {
    const invalid = { ...f.definition, relationships: { member: "not_declared" } };
    const bad = await f.tracer.createEntity(
      { type: f.profile.type, fields: { title: "Invalid binding", [f.pin.field]: invalid } },
      2,
      actor,
    );
    await assert.rejects(f.tracer.applicationModels.resolve({ ...f.pin, entityId: bad.id }), {
      code: "validation",
    });
    const goodLater = structuredClone(f.schema);
    goodLater.relationshipTypes.not_declared = {
      source: [f.definition.assessment.type],
      target: [f.definition.disposition.type],
      fields: {},
    };
    await f.tracer.setSchema(goodLater, 2, actor);
    await assert.rejects(f.tracer.applicationModels.resolve({ ...f.pin, entityId: bad.id }), {
      code: "validation",
    });
  } finally {
    f.close();
  }
});

test("model selection snapshots before queueing and external capabilities do not cause source IO", async () => {
  const f = await applicationModelFixture();
  let release!: () => void;
  try {
    const calls = f.base.observations;
    await f.tracer.updateEntity(
      f.profile.id,
      1,
      {
        fields: f.profile.fields,
        resource: {
          label: "Native model annotations",
          source: { system: "file", externalId: "model-annotations-only" },
        },
      },
      2,
      actor,
    );
    const selected = { ...f.pin, version: 2 };
    let entered!: () => void;
    const ready = new Promise<void>((r) => {
        entered = r;
      }),
      gate = new Promise<void>((r) => {
        release = r;
      });
    const held = f.repository.transaction(async (tx) => {
      await tx.headRevision();
      entered();
      await gate;
    });
    await ready;
    const pending = f.tracer.applicationModels.resolve(selected);
    selected.version = 999;
    selected.field = "caller changed";
    release();
    await held;
    const result = await pending;
    assert.equal(result.pin.version, 2);
    assert.equal(result.pin.field, f.pin.field);
    assert.equal(f.base.observations, calls);
    let accessors = 0;
    const bad = {
      ...f.pin,
      get version() {
        accessors++;
        return 2;
      },
    };
    await assert.rejects(f.tracer.applicationModels.resolve(bad), { code: "validation" });
    assert.equal(accessors, 0);
  } finally {
    release?.();
    f.close();
  }
});

test("model metadata bounds reject oversized role schemas without returning a partial required-field list", async () => {
  const f = await applicationModelFixture();
  try {
    let version = 2;
    for (const target of ["records", "relationship", "field_name"]) {
      const schema = structuredClone(f.schema);
      if (target === "records")
        for (let i = 0; i <= applicationModelLimits.roleFields; i++)
          schema.entityTypes[f.definition.assessment.type].fields["optional" + i] = {
            type: "string",
          };
      if (target === "relationship")
        for (let i = 0; i <= applicationModelLimits.roleFields; i++)
          schema.relationshipTypes[f.definition.relationships.member].fields["optional" + i] = {
            type: "string",
          };
      if (target === "field_name")
        schema.entityTypes[f.definition.assessment.type].fields["a".repeat(201)] = {
          type: "string",
          required: true,
        };
      await f.tracer.setSchema(schema, version++, actor);
      const result = await f.tracer.applicationModels.resolve(f.pin);
      assert.equal(result.compatibility.writable, false);
      if (target !== "relationship") assert.equal(result.requiredFields.assessment, null);
    }
  } finally {
    f.close();
  }
});

test("required metadata treats prototype-like names as owned data and bounds total resolved bytes", async () => {
  const f = await applicationModelFixture();
  try {
    const schema = structuredClone(f.schema);
    Object.defineProperty(schema.entityTypes[f.definition.assessment.type].fields, "__proto__", {
      value: { type: "json", required: true },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    await f.tracer.setSchema(schema, 2, actor);
    const result = await f.tracer.applicationModels.resolve(f.pin);
    assert.ok(result.requiredFields.assessment);
    assert.equal(Object.hasOwn(result.requiredFields.assessment, "__proto__"), true);
    assert.equal(Object.getPrototypeOf(result.requiredFields.assessment), Object.prototype);
    assert.deepEqual(result.requiredFields.assessment["__proto__"], {
      type: "json",
      required: true,
    });
    const type = "model_" + "x".repeat(applicationModelLimits.responseBytes);
    schema.entityTypes[type] = schema.entityTypes.project_method;
    await f.tracer.setSchema(schema, 3, actor);
    const profile = await f.tracer.createEntity({ type, fields: f.profile.fields }, 4, actor);
    const before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.applicationModels.resolve({ ...f.pin, entityId: profile.id }), {
      code: "validation",
      message: "Resolved application model exceeds 128 KiB",
    });
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});
