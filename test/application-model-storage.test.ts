import test from "node:test";
import assert from "node:assert/strict";
import type { Schema } from "../src/core/model.ts";
import { evaluationFixture, evaluationActor as actor } from "./evaluation-fixture.ts";
for (const domain of ["engineering", "research"] as const)
  test(`${domain}: ordinary native model pins retain application vocabulary without a new storage primitive`, async () => {
    const f = await evaluationFixture(domain);
    try {
      const t = f.tracer,
        old = await t.getSchema(),
        names =
          domain === "engineering"
            ? {
                assessment: "change_assessment",
                disposition: "change_disposition",
                state: "state",
                scope: "scope",
                model: "model",
                member: "has_disposition",
                target: "concerns",
                definition: "definition",
              }
            : {
                assessment: "investigation",
                disposition: "interpretation",
                state: "progress",
                scope: "population",
                model: "method_model",
                member: "includes_interpretation",
                target: "interprets",
                definition: "rules",
              };
      assert.ok(old);
      const schema: Schema = {
        entityTypes: {
          ...old.entityTypes,
          application_model: {
            fields: {
              title: { type: "string", required: true },
              [names.definition]: { type: "json", required: true },
            },
          },
          [names.assessment]: {
            fields: {
              title: { type: "string", required: true },
              [names.state]: { type: "string", required: true },
              [names.scope]: { type: "json", required: true },
              [names.model]: { type: "json", required: true },
            },
          },
          [names.disposition]: {
            fields: {
              title: { type: "string", required: true },
              decision: { type: "string", required: true },
              rationale: { type: "string", required: true },
              actions: { type: "json", required: true },
            },
          },
        },
        relationshipTypes: {
          ...old.relationshipTypes,
          [names.member]: { source: [names.assessment], target: [names.disposition], fields: {} },
          [names.target]: { source: [names.disposition], resourceTarget: true, fields: {} },
        },
      };
      await t.setSchema(schema, 1, actor);
      const definition = {
        contract: "change_assessment",
        version: 1,
        assessment: {
          type: names.assessment,
          fields: { title: "title", state: names.state, scope: names.scope, model: names.model },
        },
        disposition: {
          type: names.disposition,
          fields: { decision: "decision", rationale: "rationale", actions: "actions" },
        },
        relationships: { member: names.member, candidate: names.target },
        policy: { allowUnresolvedUnknown: false },
      };
      const profile = await t.createEntity(
          {
            type: "application_model",
            fields: { title: domain + " model", [names.definition]: definition },
          },
          2,
          actor,
        ),
        pin = { entityId: profile.id, version: profile.version, field: names.definition };
      // Constructive storage/binding prototype only. This is not a production application resolver.
      const resolve = async (selection: { entityId: string; version: number; field: string }) => {
        const native = await t.getNativePin(selection.entityId, selection.version),
          model = native.entity.fields[selection.field] as typeof definition;
        assert.equal(model.contract, "change_assessment");
        assert.equal(model.version, 1);
        for (const role of [model.assessment, model.disposition]) {
          assert.ok(native.schema.entityTypes[role.type]);
          for (const field of Object.values(role.fields))
            assert.ok(native.schema.entityTypes[role.type].fields[field], field);
        }
        return model;
      };
      assert.deepEqual(await resolve(pin), definition);
      const before = await t.exportProject(),
        assessment = await t.createEntity(
          {
            type: names.assessment,
            fields: {
              title: "Assess the selected criterion",
              [names.state]: "open",
              [names.scope]: {
                baselineId: f.baseline.id,
                rootId: f.criterion.id,
                candidateIds: [f.criterion.id],
                nativeRevision: before.projectRevision,
                evidenceRevision: before.evidenceRevision,
              },
              [names.model]: pin,
            },
          },
          2,
          actor,
        );
      const disposition = await t.createEntity(
        {
          type: names.disposition,
          fields: {
            title: "Criterion disposition",
            decision: "no_action",
            rationale: "Prototype storage claim only, not engineering verification",
            actions: [],
          },
        },
        2,
        actor,
      );
      await t.applyChangeset(
        {
          expectedSchemaVersion: 2,
          operations: [
            {
              op: "relationship.create",
              input: {
                type: names.member,
                source: assessment.id,
                target: disposition.id,
                fields: {},
              },
            },
            {
              op: "relationship.create",
              input: {
                type: names.target,
                source: disposition.id,
                target: f.criterion.id,
                fields: {},
              },
            },
          ],
        },
        actor,
      );
      await t.updateEntity(
        profile.id,
        1,
        {
          fields: {
            ...profile.fields,
            [names.definition]: { ...definition, policy: { allowUnresolvedUnknown: true } },
          },
        },
        2,
        actor,
      );
      assert.deepEqual(await resolve(pin), definition);
      await t.removeEntity(profile.id, 2, 2, actor);
      assert.deepEqual(await resolve(pin), definition);
      await t.updateEntity(
        assessment.id,
        1,
        { fields: { ...assessment.fields, [names.state]: "closed" } },
        2,
        actor,
      );
      assert.equal((await t.evidence.list("receipt", { subject: assessment.id })).items.length, 0);
      const reopened = f.reopen();
      assert.deepEqual(
        (await reopened.getNativePin(pin.entityId, pin.version)).entity.fields[pin.field],
        definition,
      );
    } finally {
      f.close();
    }
  });
