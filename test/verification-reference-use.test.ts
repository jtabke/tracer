import test from "node:test";
import assert from "node:assert/strict";
import { referenceUseFixture } from "./reference-use-fixture.ts";
import {
  verificationActor as actor,
  verificationOpening,
  verificationExecution,
  verificationMutation,
  verificationResults,
} from "./verification-fixture.ts";
import { decodeRead, decodeWrite } from "../src/interfaces/api-endpoints.ts";

for (const [domain, external] of [
  ["engineering", true],
  ["research", false],
] as const)
  test(`${domain}: explicit V2 verifies independent uses after product capture and preserves exact state through later live changes`, async () => {
    const x = await referenceUseFixture(domain, external),
      { f } = x;
    try {
      const target = await x.capture(),
        opening = await verificationOpening(f);
      opening.targetConfigurationId = target.id;
      opening.targetPolicy = "target-reference-uses-v2";
      const opened = await f.tracer.verification.open(opening, actor);
      assert.deepEqual(decodeWrite("/api/verifications/open", opened, opening), opened);
      assert.throws(() =>
        decodeWrite("/api/verifications/open", opened, {
          ...opening,
          targetPolicy: "target-input-correspondence-v1",
        }),
      );
      const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
        activity = await verificationExecution(f, selection);
      activity.inputs = [0, 1, 2, 3].map(x.input);
      activity.relationshipInputs = x.relationships();
      const executed = await f.tracer.verification.recordExecution(activity, actor);
      const detail = await f.tracer.verification.execution(selection, activity.executionId),
        support = detail.targetSupport!;
      assert.deepEqual(
        support.layers[0].comparison.inputs.map((row) => row.state),
        ["current", "current", "current", "current"],
      );
      assert.deepEqual(
        support.layers[0].comparison.inputs.map((row) => row.referenceUse!.selection),
        [
          external ? "pinned-observation" : "pinned-revision",
          external ? "pinned-observation" : "pinned-revision",
          external ? "pinned-observation" : "pinned-revision",
          "resource-default",
        ],
      );
      for (const row of support.layers[0].comparison.inputs) {
        assert.equal(row.referenceUse!.resourceDefault.entity!.version, x.resource.version);
        assert.equal(row.referenceUse!.passage, "unknown");
        if (external) assert.equal(row.referenceUse!.resourceDefault.observation!.id, x.C!.id);
      }
      const raw = await f.tracer.configurations.compareReceipt({
        configurationId: target.id,
        receiptId: executed.receipt.id,
      });
      assert.deepEqual(
        raw.comparison.inputs.slice(-4).map((row) => row.state),
        ["changed", "current", "changed", "current"],
      );
      assert.equal(raw.comparison.hasChanged, true);
      assert.deepEqual(
        decodeRead(
          "/api/verification-execution",
          { ...selection, executionId: activity.executionId },
          detail,
        ),
        detail,
      );
      const malformed = structuredClone(detail);
      malformed.targetSupport!.layers[0].comparison.inputs[0].referenceUse!.resourceDefault.entity!.id =
        "another-resource";
      assert.throws(() =>
        decodeRead(
          "/api/verification-execution",
          { ...selection, executionId: activity.executionId },
          malformed,
        ),
      );
      await x.changeSource();
      await f.tracer.removeRelationship(x.refs[0].id, 1, 2, actor);
      assert.deepEqual(
        (await f.tracer.verification.execution(selection, activity.executionId)).targetSupport,
        support,
      );
      await f.tracer.verification.selectResults(
        await verificationResults(f, selection, activity.executionId),
        actor,
      );
      const conclusion = await f.tracer.verification.conclude(
        await verificationMutation(f, selection),
        actor,
      );
      assert.ok(conclusion.receipt.inputs.some((row) => row.referenceId === x.refs[3].id));
      assert.equal((await f.tracer.verification.analyze(selection)).completion.state, "verified");
      f.reopen();
      const before = await f.tracer.exportProject();
      assert.equal((await f.tracer.verification.analyze(selection)).completion.state, "verified");
      assert.deepEqual(await f.tracer.verification.open(opening, actor), opened);
      assert.deepEqual(await f.tracer.exportProject(), before);
    } finally {
      f.close();
    }
  });

test("missing selected reference remains unknown despite live availability; a pinned B use survives an unknown resource default", async () => {
  const x = await referenceUseFixture(),
    { f } = x;
  try {
    for (const missing of [true, false]) {
      const target = await x.capture(missing ? [0] : [], true),
        opening = await verificationOpening(f);
      opening.targetConfigurationId = target.id;
      opening.targetPolicy = "target-reference-uses-v2";
      await f.tracer.verification.open(opening, actor);
      const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
        activity = await verificationExecution(f, selection);
      activity.inputs = [x.input(0)];
      activity.relationshipInputs = x.relationships([0]);
      await f.tracer.verification.recordExecution(activity, actor);
      const detail = await f.tracer.verification.execution(selection, activity.executionId),
        row = detail.targetSupport!.layers[0].comparison.inputs[0];
      assert.equal(row.state, missing ? "unknown" : "current");
      assert.equal(row.referenceUse!.resourceDefault.observation, null);
      assert.equal(row.current.observation?.id ?? null, missing ? null : x.B!.id);
      assert.equal(
        (await f.tracer.verification.analyze(selection)).executions[0].support.unknown,
        missing,
      );
    }
  } finally {
    f.close();
  }
});

test("controlled policy revision is explicit, retires selection context and never changes raw V1 or original outcomes", async () => {
  const x = await referenceUseFixture("research"),
    { f } = x;
  try {
    const target = await x.capture(),
      opening = await verificationOpening(f);
    opening.targetConfigurationId = target.id;
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
      activity = await verificationExecution(f, selection);
    activity.inputs = [x.input(0)];
    activity.relationshipInputs = x.relationships([0]);
    const original = await f.tracer.verification.recordExecution(activity, actor);
    assert.equal(
      (await f.tracer.verification.analyze(selection)).executions[0].support.changed,
      true,
    );
    const layer = (await f.tracer.verification.execution(selection, activity.executionId))
      .targetSupport!.layers[0];
    const reviewCommand = {
      ...(await verificationMutation(f, selection)),
      executionId: activity.executionId,
      receiptId: original.receipt.id,
      expectedComparison: layer.token,
      decision: "accepted" as const,
    };
    await f.tracer.verification.reviewSupport(reviewCommand, actor);
    await f.tracer.verification.selectResults(
      await verificationResults(f, selection, activity.executionId),
      actor,
    );
    assert.equal((await f.tracer.verification.analyze(selection)).selection.state, "current");
    const oldReview = (await f.tracer.verification.execution(selection, activity.executionId))
      .targetSupport!.layers[0].review.decision!;
    const raw = await f.tracer.configurations.compareReceipt({
      configurationId: target.id,
      receiptId: original.receipt.id,
    });
    const mapping = f.input.criteria.map((row) => ({ fromId: row.id, toId: row.id }));
    await f.tracer.verification.reviseBasis(
      {
        ...(await verificationMutation(f, selection)),
        basis: f.input,
        mapping,
        targetPolicy: "target-reference-uses-v2",
      },
      actor,
    );
    assert.equal(
      (await f.tracer.verification.analyze(selection)).executions[0].support.changed,
      false,
    );
    assert.equal((await f.tracer.verification.analyze(selection)).selection.state, "none");
    assert.equal(
      (await f.tracer.verification.execution(selection, activity.executionId)).targetSupport!
        .layers[0].review.state,
      "unreviewed",
    );
    assert.deepEqual(
      await f.repository.transaction((tx) => tx.getEvidence("review", oldReview.id)),
      oldReview,
    );
    assert.equal(
      (await f.tracer.verification.get(selection)).scope.target!.policy,
      "target-reference-uses-v2",
    );
    await f.tracer.verification.reviseBasis(
      { ...(await verificationMutation(f, selection)), basis: f.input, mapping },
      actor,
    );
    assert.equal(
      (await f.tracer.verification.get(selection)).scope.target!.policy,
      "target-reference-uses-v2",
    );
    assert.deepEqual(
      await f.tracer.configurations.compareReceipt({
        configurationId: target.id,
        receiptId: original.receipt.id,
      }),
      raw,
    );
    assert.deepEqual(await f.tracer.evidence.getReceipt(original.receipt.id), original.receipt);
  } finally {
    f.close();
  }
});

test("V2 changed reference state requires its own qualified assessment and preserves the originally used B state", async () => {
  const x = await referenceUseFixture("research"),
    { f } = x;
  try {
    const before = x.refs[0];
    x.refs[0] = await f.tracer.updateRelationship(
      before.id,
      1,
      {
        type: before.type,
        source: before.source,
        target: before.target,
        fields: before.fields,
        reference: { ...before.reference!, state: { mode: "pinned", observationId: x.C!.id } },
      },
      2,
      actor,
    );
    const target = await x.capture(),
      opening = await verificationOpening(f);
    opening.targetConfigurationId = target.id;
    opening.targetPolicy = "target-reference-uses-v2";
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
      activity = await verificationExecution(f, selection);
    activity.inputs = [x.input(0)];
    activity.relationshipInputs = [{ id: before.id, revision: 1 }];
    const original = await f.tracer.verification.recordExecution(activity, actor);
    const layer = (await f.tracer.verification.execution(selection, activity.executionId))
      .targetSupport!.layers[0];
    assert.equal(layer.comparison.inputs[0].recorded.observation!.id, x.B!.id);
    assert.equal(layer.comparison.inputs[0].current.observation!.id, x.C!.id);
    assert.equal(layer.comparison.state, "changed");
    await f.tracer.verification.reviewSupport(
      {
        ...(await verificationMutation(f, selection)),
        executionId: activity.executionId,
        receiptId: original.receipt.id,
        expectedComparison: layer.token,
        decision: "accepted",
      },
      actor,
    );
    const analysis = await f.tracer.verification.analyze(selection);
    assert.equal(analysis.executions[0].support.assessed, true);
    assert.equal(analysis.executions[0].support.changed, false);
    await f.tracer.verification.selectResults(
      await verificationResults(f, selection, activity.executionId),
      actor,
    );
    await f.tracer.verification.conclude(await verificationMutation(f, selection), actor);
    assert.equal((await f.tracer.verification.analyze(selection)).completion.state, "verified");
    assert.deepEqual(await f.tracer.evidence.getReceipt(original.receipt.id), original.receipt);
  } finally {
    f.close();
  }
});

test("V2 resolves a legacy declared terminal reference path without rewriting the prior receipt or raw comparison", async () => {
  const x = await referenceUseFixture("research"),
    { f } = x;
  try {
    const target = await x.capture(),
      definition = f.definition;
    const prior = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.requirement.id,
        outcome: "Synthetic original report; typed results are attested separately",
        inputs: [
          {
            entityId: f.requirement.id,
            facet: "native",
            fields: [
              definition.requirement.fields.statement,
              ...definition.requirement.fields.acceptance,
            ],
          },
          {
            entityId: f.method.id,
            facet: "native",
            fields: [definition.method.fields.procedure, definition.method.fields.expected],
          },
          {
            entityId: x.resource.id,
            facet: "content",
            observationId: x.B!.id,
            path: [x.refs[0].id],
          },
        ],
      },
      actor,
    );
    const raw = await f.tracer.configurations.compareReceipt({
      configurationId: target.id,
      receiptId: prior.id,
    });
    assert.equal(raw.comparison.inputs[2].state, "changed");
    const opening = await verificationOpening(f);
    opening.targetConfigurationId = target.id;
    opening.targetPolicy = "target-reference-uses-v2";
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
      activity = await verificationExecution(f, selection);
    activity.source = {
      kind: "prior_receipt",
      receiptId: prior.id,
      rationale: "Explicit interpretation retaining the original declared path",
    };
    await f.tracer.verification.recordExecution(activity, actor);
    const detail = await f.tracer.verification.execution(selection, activity.executionId);
    const source = detail.targetSupport!.layers[1].comparison.inputs[0];
    assert.equal(source.state, "current");
    assert.equal(source.referenceUse!.relationshipId, x.refs[0].id);
    assert.equal(source.current.observation!.id, x.B!.id);
    assert.equal(source.referenceUse!.resourceDefault.observation!.id, x.C!.id);
    assert.deepEqual(await f.tracer.evidence.getReceipt(prior.id), prior);
    assert.deepEqual(
      await f.tracer.configurations.compareReceipt({
        configurationId: target.id,
        receiptId: prior.id,
      }),
      raw,
    );
  } finally {
    f.close();
  }
});

for (const external of [true, false])
  test(`${external ? "observed" : "native"}: target result selection/conclusion retains explicit reference states after live resource deletion`, async () => {
    const x = await referenceUseFixture("research", external),
      { f } = x;
    try {
      const target = await x.capture(),
        opening = await verificationOpening(f);
      opening.targetConfigurationId = target.id;
      opening.targetPolicy = "target-reference-uses-v2";
      await f.tracer.verification.open(opening, actor);
      const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
        activity = await verificationExecution(f, selection);
      activity.inputs = [x.input(0), x.input(3)];
      activity.relationshipInputs = x.relationships([0, 3]);
      await f.tracer.verification.recordExecution(activity, actor);
      await f.tracer.removeEntity(x.resource.id, x.resource.version, 2, actor, true);
      const before = await f.tracer.verification.execution(selection, activity.executionId);
      assert.ok(
        before.targetSupport!.layers[0].comparison.inputs.every((row) => row.state === "current"),
      );
      await f.tracer.verification.selectResults(
        await verificationResults(f, selection, activity.executionId),
        actor,
      );
      const conclusion = await f.tracer.verification.conclude(
        await verificationMutation(f, selection),
        actor,
      );
      assert.ok(conclusion.receipt.inputs.some((row) => row.referenceId === x.refs[3].id));
      assert.equal((await f.tracer.verification.analyze(selection)).completion.state, "verified");
      f.reopen();
      assert.equal((await f.tracer.verification.analyze(selection)).completion.state, "verified");
      assert.deepEqual(
        (await f.tracer.verification.execution(selection, activity.executionId)).targetSupport,
        before.targetSupport,
      );
    } finally {
      f.close();
    }
  });

for (const policy of ["target-input-correspondence-v1", "target-reference-uses-v2"] as const)
  test(`${policy}: an unassociated selected content dependency remains capturable after native identity deletion`, async () => {
    const x = await referenceUseFixture(),
      { f } = x;
    try {
      const target = await x.capture(),
        opening = await verificationOpening(f);
      opening.targetConfigurationId = target.id;
      opening.targetPolicy = policy;
      await f.tracer.verification.open(opening, actor);
      const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
        activity = await verificationExecution(f, selection);
      activity.inputs = [{ entityId: x.resource.id, facet: "content", observationId: x.C!.id }];
      await f.tracer.verification.recordExecution(activity, actor);
      await f.tracer.removeEntity(x.resource.id, 1, 2, actor, true);
      await f.tracer.verification.selectResults(
        await verificationResults(f, selection, activity.executionId),
        actor,
      );
      const conclusion = await f.tracer.verification.conclude(
        await verificationMutation(f, selection),
        actor,
      );
      const captured = conclusion.receipt.inputs.find(
        (row) => row.entityId === x.resource.id && row.facet === "content",
      )!;
      assert.equal(captured.observation!.id, x.C!.id);
      assert.equal(captured.pin!.entity.version, 1);
      assert.equal(captured.contentRetention, "external-content-not-retained");
      assert.equal((await f.tracer.verification.analyze(selection)).completion.state, "verified");
    } finally {
      f.close();
    }
  });
