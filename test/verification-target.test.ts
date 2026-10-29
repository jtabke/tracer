import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { decodeRead, decodeWrite } from "../src/interfaces/api-endpoints.ts";
import { Tracer } from "../src/index.ts";
import type { VerificationSelection } from "../src/index.ts";
import {
  verificationFixture,
  verificationTargetInput as targetInput,
  verificationActor as actor,
  verificationOpening,
  verificationExecution,
  verificationResults,
  verificationMutation,
} from "./verification-fixture.ts";

type Fixture = Awaited<ReturnType<typeof verificationFixture>>;
async function conclude(
  f: Fixture,
  selection: VerificationSelection,
  inputs: Parameters<Tracer["verification"]["recordExecution"]>[0]["inputs"] = [],
) {
  const execution = await verificationExecution(f, selection);
  execution.inputs = inputs;
  await f.tracer.verification.recordExecution(execution, actor);
  await f.tracer.verification.selectResults(
    await verificationResults(f, selection, execution.executionId),
    actor,
  );
  await f.tracer.verification.conclude(await verificationMutation(f, selection), actor);
  return f.tracer.verification.analyze(selection);
}

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: controlled target verification remains bound to captured governing/content states while current-head cases reassess`, async () => {
    const f = await verificationFixture(domain);
    try {
      const material = await f.tracer.createEntity(
        {
          type: "@resource",
          fields: {},
          resource: {
            label: "Observed candidate input",
            source: { system: "file", externalId: "/synthetic/candidate-input" },
          },
        },
        1,
        actor,
      );
      const observe = new Tracer(f.repository, undefined, async () => ({
        availability: "available",
        hash: "sha256:" + "a".repeat(64),
      }));
      const observation = await observe.evidence.observe(
        { entityId: material.id, locator: { system: "file", path: "/synthetic/candidate-input" } },
        actor,
      );
      const capture = await targetInput(f);
      capture.members.push({ entityId: material.id, version: 1 });
      capture.content.push({ entityId: material.id, observationId: observation.id });
      const target = await f.tracer.configurations.captureExact(capture, actor);
      const opening = await verificationOpening(f);
      opening.targetConfigurationId = target.id;
      await f.tracer.verification.open(opening, actor);
      const selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
      const selected = await conclude(f, selection, [
        { entityId: material.id, facet: "content", observationId: observation.id },
      ]);
      assert.equal(selected.completion.state, "verified");
      assert.equal(selected.view.scope.target!.configurationId, target.id);
      const originalSupport = (
        await f.tracer.verification.execution(selection, selected.executions[0].id)
      ).targetSupport;
      assert.ok(!target.members.some((pin) => pin.entity.id === opening.caseId));
      assert.ok(!target.members.some((pin) => pin.entity.id === selected.executions[0].id));
      const currentOpening = await verificationOpening(f);
      await f.tracer.verification.open(currentOpening, actor);
      const currentSelection = {
        caseId: currentOpening.caseId,
        openingCommandId: currentOpening.commandId,
      };
      assert.equal(
        (
          await conclude(f, currentSelection, [
            { entityId: material.id, facet: "content", observationId: observation.id },
          ])
        ).completion.state,
        "verified",
      );
      const field = f.definition.requirement.fields.statement;
      await f.tracer.updateEntity(
        f.requirement.id,
        1,
        {
          fields: {
            ...f.requirement.fields,
            [field]: "A different later live governing requirement",
          },
        },
        1,
        actor,
      );
      const changed = new Tracer(f.repository, undefined, async () => ({
        availability: "available",
        hash: "sha256:" + "b".repeat(64),
      }));
      await changed.evidence.observe(
        { entityId: material.id, locator: observation.locator },
        actor,
      );
      f.reopen();
      const before = await f.tracer.exportProject(),
        analysis = await f.tracer.verification.analyze(selection);
      assert.equal(analysis.completion.state, "verified");
      assert.equal(analysis.basis.state, "current");
      assert.deepEqual(analysis.recordedConclusion, selected.recordedConclusion);
      assert.equal(analysis.basis.digest, selected.basis.digest);
      const detail = await f.tracer.verification.execution(selection, selected.executions[0].id);
      assert.deepEqual(detail.targetSupport, originalSupport);
      assert.equal(detail.comparison.record.state, "changed");
      assert.equal(detail.targetSupport!.target.configurationId, target.id);
      assert.equal(detail.targetSupport!.basisDigest, selected.basis.digest);
      assert.equal(detail.targetSupport!.layers.length, 1);
      assert.equal(detail.targetSupport!.layers[0].comparison.state, "current");
      assert.equal(
        detail.targetSupport!.layers[0].comparison.inputs[0].current.observation!.id,
        observation.id,
      );
      assert.equal(
        (await f.tracer.verification.analyze(currentSelection)).completion.state,
        "needs_reassessment",
      );
      assert.deepEqual(await f.tracer.exportProject(), before);
      await assert.rejects(
        f.tracer.verification.open({ ...opening, targetConfigurationId: "another-target" }, actor),
        { code: "conflict" },
      );
    } finally {
      f.close();
    }
  });

test("target genesis requires exact model/requirement/method/mapping selection and failed binding reserves no command identity", async () => {
  const f = await verificationFixture();
  try {
    const input = await targetInput(f);
    input.members = input.members.filter((e) => e.entityId !== f.profile.id);
    const incomplete = await f.tracer.configurations.captureExact(input, actor);
    const opening = await verificationOpening(f);
    opening.targetConfigurationId = incomplete.id;
    const before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.verification.open(opening, actor), {
      code: "validation",
      message: /exact interpretation model/,
    });
    assert.equal(await f.tracer.evaluations.getOutcome(opening.commandId), null);
    assert.deepEqual(await f.tracer.exportProject(), before);
    const complete = await f.tracer.configurations.captureExact(await targetInput(f), actor);
    opening.targetConfigurationId = complete.id;
    const context = await f.tracer.configurations.captureContext();
    opening.expectedEvidenceRevision = context.evidenceRevision;
    await f.tracer.verification.open(opening, actor);
    assert.equal(
      (
        await f.tracer.verification.get({
          caseId: opening.caseId,
          openingCommandId: opening.commandId,
        })
      ).scope.target!.configurationId,
      complete.id,
    );
    const missingLink = await targetInput(f);
    missingLink.relationships = [];
    const withoutLink = await f.tracer.configurations.captureExact(missingLink, actor),
      bad = await verificationOpening(f);
    bad.targetConfigurationId = withoutLink.id;
    await assert.rejects(f.tracer.verification.open(bad, actor), {
      code: "validation",
      message: /exact requirement-to-method mapping/,
    });
    const legacy = await f.tracer.configurations.capture(
      {
        name: "Legacy native scope",
        subjectId: f.requirement.id,
        expectedSubjectVersion: 1,
        members: [{ entityId: f.requirement.id, version: 1 }],
      },
      actor,
    );
    const old = await verificationOpening(f);
    old.targetConfigurationId = legacy.id;
    await assert.rejects(f.tracer.verification.open(old, actor), {
      code: "validation",
      message: /legacy scope/,
    });
  } finally {
    f.close();
  }
});

test("a target case cannot silently adopt a newer live requirement basis or an authored target", async () => {
  const f = await verificationFixture();
  try {
    const target = await f.tracer.configurations.captureExact(await targetInput(f), actor);
    const opening = await verificationOpening(f);
    opening.targetConfigurationId = target.id;
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
      view = await f.tracer.verification.get(selection);
    const fields = f.definition.case.fields;
    const entity = await f.tracer.getEntity(opening.caseId);
    await f.tracer.updateEntity(
      opening.caseId,
      view.case.version,
      {
        fields: {
          ...entity!.fields,
          [fields.basis]: {
            ...view.scope,
            target: { ...view.scope.target, configurationId: "forged" },
          },
        },
      },
      1,
      actor,
    );
    await assert.rejects(f.tracer.verification.analyze(selection), { code: "conflict" });
  } finally {
    f.close();
  }
});

test("target genesis recovers original intent through lost HTTP response, restart, later head changes and CLI", async () => {
  const f = await verificationFixture();
  let server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
  let posts = 0;
  try {
    const target = await f.tracer.configurations.captureExact(await targetInput(f), actor),
      opening = await verificationOpening(f);
    opening.targetConfigurationId = target.id;
    const client = createClient({
      baseUrl: server.origin,
      require: { features: ["configuration-bound-verification"] },
      fetch: async (...args) => {
        const response = await fetch(...args);
        if (args[1]?.method === "POST") {
          posts++;
          assert.equal(response.status, 200);
          throw Error("Lost committed target genesis response");
        }
        return response;
      },
    });
    await client.connect();
    await assert.rejects(client.write("/api/verifications/open", opening), {
      code: "outcome_unknown",
    });
    assert.equal(posts, 1);
    const original = await f.tracer.evaluations.getOutcome(opening.commandId);
    assert.ok(original);
    await server.close();
    f.reopen();
    await f.tracer.updateEntity(
      f.requirement.id,
      1,
      {
        fields: {
          ...f.requirement.fields,
          [f.definition.requirement.fields.title]: "Later annotation",
        },
      },
      1,
      actor,
    );
    server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
    const fresh = createClient({ baseUrl: server.origin });
    await fresh.connect();
    const before = await f.tracer.exportProject();
    assert.deepEqual(
      await fresh.read("/api/evaluation-outcome", { commandId: opening.commandId }),
      original,
    );
    assert.equal(
      (
        await fresh.read("/api/verification-case", {
          caseId: opening.caseId,
          openingCommandId: opening.commandId,
        })
      ).scope.target!.configurationId,
      target.id,
    );
    assert.deepEqual(await fresh.write("/api/verifications/open", opening), original);
    const cli = spawnSync(
      process.execPath,
      [
        "src/interfaces/cli.ts",
        "--db",
        f.database,
        "--actor",
        actor.actor,
        "--reason",
        actor.reason,
        "verification",
        "open",
        JSON.stringify(opening),
      ],
      { encoding: "utf8" },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), original);
    assert.throws(() =>
      decodeWrite("/api/verifications/open", original, {
        ...opening,
        targetConfigurationId: "different",
      }),
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    await server.close();
    f.close();
  }
});

for (const mode of ["current", "target"] as const)
  test(`${mode}: nested prior support retains original byte dependencies and one accepted layer cannot hide another changed layer`, async () => {
    const f = await verificationFixture("research");
    try {
      const resources = [];
      for (const name of ["a", "b"])
        resources.push(
          await f.tracer.createEntity(
            {
              type: "@resource",
              fields: {},
              resource: {
                label: `Source ${name}`,
                source: { system: "file", externalId: `/synthetic/${name}` },
              },
            },
            1,
            actor,
          ),
        );
      let changed = false;
      const observing = new Tracer(f.repository, undefined, async (locator) => ({
        availability: "available",
        hash:
          "sha256:" +
          (locator.system === "file" && locator.path.endsWith("a")
            ? changed
              ? "b"
              : "a"
            : changed
              ? "d"
              : "c"
          ).repeat(64),
      }));
      const observations = [];
      for (let i = 0; i < 2; i++)
        observations.push(
          await observing.evidence.observe(
            {
              entityId: resources[i].id,
              locator: { system: "file", path: `/synthetic/${i ? "b" : "a"}` },
            },
            actor,
          ),
        );
      const first = await verificationOpening(f);
      await f.tracer.verification.open(first, actor);
      const performed = await verificationExecution(f, {
        caseId: first.caseId,
        openingCommandId: first.commandId,
      });
      performed.inputs = [
        { entityId: resources[0].id, facet: "content", observationId: observations[0].id },
      ];
      const original = await f.tracer.verification.recordExecution(performed, actor);
      const parent = await verificationOpening(f);
      await f.tracer.verification.open(parent, actor);
      const interpretation = await verificationExecution(f, {
        caseId: parent.caseId,
        openingCommandId: parent.commandId,
      });
      interpretation.source = {
        kind: "prior_receipt",
        receiptId: original.receipt.id,
        rationale: "Explicit typed interpretation of original passing criterion scope",
      };
      interpretation.inputs = [
        { entityId: resources[1].id, facet: "content", observationId: observations[1].id },
      ];
      const intermediate = await f.tracer.verification.recordExecution(interpretation, actor);
      changed = true;
      const currentA = await observing.evidence.observe(
        { entityId: resources[0].id, locator: observations[0].locator },
        actor,
      );
      await observing.evidence.observe(
        { entityId: resources[1].id, locator: observations[1].locator },
        actor,
      );
      const compared = await f.tracer.evidence.compareReceipt(intermediate.receipt.id);
      assert.equal(compared.state, "changed");
      await f.tracer.evidence.review(
        {
          receiptId: intermediate.receipt.id,
          decision: "accepted",
          rationale: "Synthetic assessment of this layer's changed B input only",
          expectedComparison: compared.token,
        },
        actor,
      );
      const next = await verificationOpening(f);
      if (mode === "target") {
        const input = await targetInput(f);
        input.members.push(...resources.map((e) => ({ entityId: e.id, version: 1 })));
        input.content = [
          { entityId: resources[0].id, observationId: currentA.id },
          { entityId: resources[1].id, observationId: observations[1].id },
        ];
        const target = await f.tracer.configurations.captureExact(input, actor);
        next.targetConfigurationId = target.id;
      }
      const ctx = await f.tracer.configurations.captureContext();
      next.expectedProjectRevision = ctx.projectRevision;
      next.expectedEvidenceRevision = ctx.evidenceRevision;
      await f.tracer.verification.open(next, actor);
      const selection = { caseId: next.caseId, openingCommandId: next.commandId },
        reused = await verificationExecution(f, selection);
      reused.source = {
        kind: "prior_receipt",
        receiptId: intermediate.receipt.id,
        rationale: "Retain both original and intermediate source scope",
      };
      await f.tracer.verification.recordExecution(reused, actor);
      const analysis = await f.tracer.verification.analyze(selection);
      assert.equal(analysis.executions[0].support.unknown, false);
      assert.equal(analysis.executions[0].support.changed, true);
      assert.equal(analysis.ready, false);
      assert.deepEqual(
        analysis.executions[0].results.map((r) => r.outcome),
        ["passed", "passed"],
      );
      const before = await f.tracer.exportProject();
      const detail = await f.tracer.verification.execution(selection, reused.executionId);
      if (mode === "current") assert.equal(Object.hasOwn(detail, "targetSupport"), false);
      else {
        const support = detail.targetSupport!;
        assert.equal(support.basisDigest, analysis.basis.digest);
        assert.deepEqual(
          support.layers.map((x) => x.receiptId),
          [detail.receiptId, intermediate.receipt.id, original.receipt.id],
        );
        assert.deepEqual(
          support.layers.map((x) => x.comparison.state),
          ["current", "current", "changed"],
        );
        assert.deepEqual(
          support.layers[1].comparison.inputs.map((x) => x.entityId),
          [resources[1].id],
        );
        assert.deepEqual(
          support.layers[2].comparison.inputs.map((x) => x.entityId),
          [resources[0].id],
        );
        const query = { ...selection, executionId: reused.executionId };
        assert.deepEqual(decodeRead("/api/verification-execution", query, detail), detail);
        const truncated = structuredClone(detail);
        truncated.targetSupport!.layers.pop();
        assert.throws(() => decodeRead("/api/verification-execution", query, truncated));
        const contradictory = structuredClone(detail);
        contradictory.targetSupport!.layers[2].comparison.hasChanged = false;
        assert.throws(() => decodeRead("/api/verification-execution", query, contradictory));
        const server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
        try {
          const client = createClient({ baseUrl: server.origin });
          assert.deepEqual(await client.read("/api/verification-execution", query), detail);
        } finally {
          await server.close();
        }
        const cli = spawnSync(
          process.execPath,
          [
            "src/interfaces/cli.ts",
            "--db",
            f.database,
            "verification",
            "execution",
            JSON.stringify(query),
          ],
          { encoding: "utf8" },
        );
        assert.equal(cli.status, 0, cli.stderr);
        assert.deepEqual(JSON.parse(cli.stdout), detail);
        f.reopen();
        assert.deepEqual(
          (await f.tracer.verification.execution(selection, reused.executionId)).targetSupport,
          support,
        );
      }
      assert.deepEqual(await f.tracer.exportProject(), before);
    } finally {
      f.close();
    }
  });

test("target historical verification remains readable when the current schema blocks further application authoring", async () => {
  const f = await verificationFixture();
  try {
    const target = await f.tracer.configurations.captureExact(await targetInput(f), actor),
      opening = await verificationOpening(f);
    opening.targetConfigurationId = target.id;
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
    const original = await conclude(f, selection);
    const type = f.definition.requirement.type,
      field = f.definition.requirement.fields.statement;
    const fields = {
      ...f.schema.entityTypes[type].fields,
      [field]: { type: "json" as const, required: true },
    };
    await f.tracer.setSchema(
      { ...f.schema, entityTypes: { ...f.schema.entityTypes, [type]: { fields } } },
      1,
      actor,
    );
    const before = await f.tracer.exportProject(),
      analysis = await f.tracer.verification.analyze(selection);
    assert.equal(analysis.view.model.compatibility.writable, false);
    assert.equal(analysis.completion.state, "verified");
    assert.equal(analysis.basis.digest, original.basis.digest);
    assert.deepEqual(analysis.recordedConclusion, original.recordedConclusion);
    await assert.rejects(
      f.tracer.verification.reopen(await verificationMutation(f, selection), actor),
      { code: "conflict", message: /incompatible with the current schema/ },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});

test("unknown selected content blocks target conclusion despite passing outcomes and an accepted current-head review", async () => {
  const f = await verificationFixture("research");
  try {
    const material = await f.tracer.createEntity(
      {
        type: "@resource",
        fields: {},
        resource: {
          label: "Missing selected state",
          source: { system: "file", externalId: "/synthetic/unknown-target" },
        },
      },
      1,
      actor,
    );
    const observer = new Tracer(f.repository, undefined, async () => ({
      availability: "available",
      hash: "sha256:" + "a".repeat(64),
    }));
    const observation = await observer.evidence.observe(
      { entityId: material.id, locator: { system: "file", path: "/synthetic/unknown-target" } },
      actor,
    );
    const capture = await targetInput(f);
    capture.members.push({ entityId: material.id, version: 1 });
    capture.content.push({
      entityId: material.id,
      observationId: null,
      reason: "Deliberately unavailable at the selected candidate",
    });
    const target = await f.tracer.configurations.captureExact(capture, actor),
      opening = await verificationOpening(f);
    opening.targetConfigurationId = target.id;
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
      execution = await verificationExecution(f, selection);
    execution.inputs = [{ entityId: material.id, facet: "content", observationId: observation.id }];
    const result = await f.tracer.verification.recordExecution(execution, actor);
    const head = await f.tracer.evidence.compareReceipt(result.receipt.id);
    assert.equal(head.state, "current");
    await f.tracer.evidence.review(
      {
        receiptId: result.receipt.id,
        decision: "accepted",
        rationale: "Current-head review is separate from unknown selected target content",
        expectedComparison: head.token,
      },
      actor,
    );
    await f.tracer.verification.selectResults(
      await verificationResults(f, selection, execution.executionId),
      actor,
    );
    const analysis = await f.tracer.verification.analyze(selection);
    assert.equal(analysis.executions[0].support.unknown, true);
    assert.equal(analysis.executions[0].support.assessed, false);
    assert.equal(analysis.ready, false);
    const detail = await f.tracer.verification.execution(selection, execution.executionId);
    assert.equal(detail.comparison.record.state, "current");
    assert.equal(detail.targetSupport!.layers[0].comparison.state, "unknown");
    assert.equal(detail.targetSupport!.layers[0].comparison.inputs[0].current.observation, null);
    const before = await f.tracer.exportProject();
    await assert.rejects(
      f.tracer.verification.conclude(await verificationMutation(f, selection), actor),
      { code: "conflict" },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});

for (const initialMode of ["current", "target"] as const)
  test(`${initialMode}: explicit basis revision adopts a new target while retaining the earlier conclusion and requiring changed governing scope to execute again`, async () => {
    const f = await verificationFixture();
    try {
      const initialTarget = await f.tracer.configurations.captureExact(await targetInput(f), actor),
        opening = await verificationOpening(f);
      if (initialMode === "target") opening.targetConfigurationId = initialTarget.id;
      await f.tracer.verification.open(opening, actor);
      const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
        original = await conclude(f, selection);
      const field = f.definition.requirement.fields.statement;
      await f.tracer.updateEntity(
        f.requirement.id,
        1,
        {
          fields: {
            ...f.requirement.fields,
            [field]: "Explicit next candidate governing statement",
          },
        },
        1,
        actor,
      );
      const capture = await targetInput(f);
      capture.expectedSubjectVersion = 2;
      capture.members.find((x) => x.entityId === f.requirement.id)!.version = 2;
      const target = await f.tracer.configurations.captureExact(capture, actor);
      await f.tracer.verification.reopen(await verificationMutation(f, selection), actor);
      const revision = {
        ...(await verificationMutation(f, selection)),
        targetConfigurationId: target.id,
        basis: structuredClone(f.input),
        mapping: f.input.criteria.map((c) => ({ fromId: c.id, toId: c.id })),
      };
      revision.basis.requirement.version = 2;
      const revised = await f.tracer.verification.reviseBasis(revision, actor),
        analysis = await f.tracer.verification.analyze(selection);
      assert.equal(analysis.view.scope.target!.configurationId, target.id);
      assert.equal(analysis.recordedConclusion, null);
      assert.equal(analysis.recordedSelection, null);
      assert.deepEqual(analysis.executions[0].eligibleCriterionIds, []);
      assert.throws(() =>
        decodeWrite("/api/verifications/revise", revised, {
          ...revision,
          targetConfigurationId: initialTarget.id,
        }),
      );
      const oldOutcome = await f.tracer.evaluations.getOutcome(
        original.recordedConclusion!.commandId,
      );
      assert.ok(oldOutcome);
      const basisField = f.definition.case.fields.basis;
      const oldScope = oldOutcome.receipt.output.fields[basisField] as unknown as {
        target?: { configurationId: string };
      };
      assert.equal(
        oldScope.target?.configurationId,
        initialMode === "target" ? initialTarget.id : undefined,
      );
      const performed = await verificationExecution(f, selection);
      await f.tracer.verification.recordExecution(performed, actor);
      await f.tracer.verification.selectResults(
        await verificationResults(f, selection, performed.executionId, [original.executions[0].id]),
        actor,
      );
      await f.tracer.verification.conclude(await verificationMutation(f, selection), actor);
      const complete = await f.tracer.verification.analyze(selection);
      assert.equal(complete.completion.state, "verified");
      assert.equal(complete.view.scope.target!.configurationId, target.id);
      assert.equal(complete.executions.length, 2);
      assert.deepEqual(complete.executions[0].results, original.executions[0].results);
      assert.deepEqual(
        await f.tracer.evaluations.getOutcome(original.recordedConclusion!.commandId),
        oldOutcome,
      );
      assert.deepEqual(await f.tracer.verification.reviseBasis(revision, actor), revised);
    } finally {
      f.close();
    }
  });
