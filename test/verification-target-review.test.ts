import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Tracer } from "../src/index.ts";
import type { ReviewVerificationSupport } from "../src/index.ts";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { decodeRead, decodeWrite } from "../src/interfaces/api-endpoints.ts";
import {
  verificationFixture,
  verificationActor as actor,
  verificationOpening,
  verificationExecution,
  verificationMutation,
  verificationResults,
} from "./verification-fixture.ts";

async function fixture(
  domain: "engineering" | "research" = "engineering",
  unknown = false,
  allow = true,
) {
  const f = await verificationFixture(domain);
  try {
    if (f.definition.policy.allowAssessedDesignChanges !== allow) {
      f.definition.policy.allowAssessedDesignChanges = allow;
      f.profile = await f.tracer.updateEntity(
        f.profile.id,
        1,
        { fields: { definition: f.definition } },
        1,
        actor,
      );
      f.input.model.version = f.profile.version;
    }
    const resource = await f.tracer.createEntity(
      {
        type: "@resource",
        fields: {},
        resource: {
          label: "Fixture support",
          source: { system: "file", externalId: "/synthetic/qualified-support" },
        },
      },
      1,
      actor,
    );
    let hash = "b";
    const observing = new Tracer(f.repository, undefined, async () => ({
      availability: "available",
      hash: "sha256:" + hash.repeat(64),
    }));
    const observe = () =>
      observing.evidence.observe(
        {
          entityId: resource.id,
          locator: { system: "file", path: "/synthetic/qualified-support" },
        },
        actor,
      );
    const original = await observe();
    hash = "c";
    const selected = await observe(),
      ctx = await f.tracer.configurations.captureContext();
    const target = await f.tracer.configurations.captureExact(
      {
        id: randomUUID(),
        name: "Qualified-review candidate",
        subjectId: f.requirement.id,
        expectedSubjectVersion: 1,
        members: [f.requirement, f.method, f.profile, resource].map((e) => ({
          entityId: e.id,
          version: e.version,
        })),
        relationships: [{ relationshipId: f.relationship.id, version: 1 }],
        content: [
          {
            entityId: resource.id,
            observationId: unknown ? null : selected.id,
            ...(unknown ? { reason: "Deliberately unavailable selected content" } : {}),
          },
        ],
        scope: {
          purpose: "Synthetic changed-support judgment",
          coverage: "complete",
          rationale: "No physical or representative-user validation claim",
        },
        expectedSchemaVersion: ctx.schema.version,
        expectedProjectRevision: ctx.projectRevision,
        expectedEvidenceRevision: ctx.evidenceRevision,
      },
      actor,
    );
    const opening = await verificationOpening(f);
    opening.targetConfigurationId = target.id;
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId },
      execution = await verificationExecution(f, selection);
    execution.inputs = [{ entityId: resource.id, facet: "content", observationId: original.id }];
    const result = await f.tracer.verification.recordExecution(execution, actor);
    return {
      f,
      resource,
      target,
      selection,
      execution,
      result,
      changeSource: async () => {
        hash = "d";
        return observe();
      },
    };
  } catch (error) {
    f.close();
    throw error;
  }
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function request(
  x: Fixture,
  decision: ReviewVerificationSupport["decision"] = "accepted",
): Promise<ReviewVerificationSupport> {
  const detail = await x.f.tracer.verification.execution(x.selection, x.execution.executionId);
  return {
    ...(await verificationMutation(x.f, x.selection)),
    executionId: x.execution.executionId,
    receiptId: x.result.receipt.id,
    decision,
    expectedComparison: detail.targetSupport!.layers[0].token,
    reason: "Synthetic scoped support judgment; no execution outcome is changed",
  };
}

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: authenticated target review enables allowed changed support, survives control/head changes and recovers exactly`, async () => {
    const x = await fixture(domain),
      { f } = x;
    try {
      const head = await f.tracer.evidence.compareReceipt(x.result.receipt.id);
      await f.tracer.evidence.review(
        {
          receiptId: x.result.receipt.id,
          decision: "accepted",
          rationale: "Head-only judgment",
          expectedComparison: head.token,
        },
        actor,
      );
      assert.equal(
        (await f.tracer.verification.analyze(x.selection)).executions[0].support.changed,
        true,
      );
      const command = await request(x),
        before = await f.tracer.exportProject();
      const result = await f.tracer.verification.reviewSupport(command, actor);
      assert.equal(result.native, null);
      assert.equal((await f.tracer.exportProject()).projectRevision, before.projectRevision);
      const support = (await f.tracer.verification.execution(x.selection, x.execution.executionId))
        .targetSupport!;
      assert.equal(support.layers[0].review.decision!.id, command.commandId);
      assert.equal(support.layers[0].review.state, "accepted");
      assert.equal(
        (await f.tracer.evidence.compareReceipt(x.result.receipt.id)).review.state,
        "accepted",
      );
      const analysis = await f.tracer.verification.analyze(x.selection);
      assert.equal(analysis.executions[0].support.changed, false);
      assert.equal(analysis.executions[0].support.assessed, true);
      await f.tracer.verification.selectResults(
        await verificationResults(f, x.selection, x.execution.executionId),
        actor,
      );
      await f.tracer.verification.conclude(await verificationMutation(f, x.selection), actor);
      assert.equal((await f.tracer.verification.analyze(x.selection)).completion.state, "verified");
      await x.changeSource();
      const later = await f.tracer.evidence.compareReceipt(x.result.receipt.id);
      await f.tracer.evidence.review(
        {
          receiptId: x.result.receipt.id,
          decision: "acknowledged",
          rationale: "A later head judgment remains separate",
          expectedComparison: later.token,
        },
        actor,
      );
      f.reopen();
      const saved = await f.tracer.exportProject();
      assert.deepEqual(
        (await f.tracer.verification.execution(x.selection, x.execution.executionId)).targetSupport,
        support,
      );
      assert.equal((await f.tracer.verification.analyze(x.selection)).completion.state, "verified");
      assert.deepEqual(await f.tracer.verification.reviewSupport(command, actor), result);
      assert.deepEqual(await f.tracer.exportProject(), saved);
      await assert.rejects(
        f.tracer.verification.reviewSupport({ ...command, reason: "Conflicting intent" }, actor),
        { code: "conflict" },
      );
    } finally {
      f.close();
    }
  });

test("target review rejects unknown acceptance, stale guards and unrelated receipts without reserving a command or partial review", async () => {
  const x = await fixture("research", true),
    { f } = x;
  try {
    const command = await request(x),
      before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.verification.reviewSupport(command, actor), {
      code: "validation",
      message: /unknown inputs/,
    });
    await assert.rejects(
      f.tracer.verification.reviewSupport(
        { ...command, decision: "acknowledged", receiptId: randomUUID() },
        actor,
      ),
      { code: "validation", message: /outside this execution/ },
    );
    await assert.rejects(
      f.tracer.verification.reviewSupport(
        { ...command, expectedEvidenceRevision: command.expectedEvidenceRevision - 1 },
        actor,
      ),
      { code: "conflict" },
    );
    assert.equal(await f.tracer.evaluations.getOutcome(command.commandId), null);
    assert.deepEqual(await f.tracer.exportProject(), before);
    await f.tracer.verification.reviewSupport({ ...command, decision: "acknowledged" }, actor);
    const analysis = await f.tracer.verification.analyze(x.selection);
    assert.equal(analysis.executions[0].support.unknown, true);
    assert.equal(analysis.executions[0].support.assessed, false);
    assert.equal(analysis.ready, false);
  } finally {
    f.close();
  }
});

test("accepted target judgments cannot override the pinned model policy", async () => {
  const x = await fixture("engineering", false, false),
    { f } = x;
  try {
    await f.tracer.verification.reviewSupport(await request(x), actor);
    const analysis = await f.tracer.verification.analyze(x.selection);
    assert.equal(analysis.executions[0].support.changed, true);
    assert.equal(analysis.executions[0].support.assessed, false);
  } finally {
    f.close();
  }
});

for (const outcome of ["failed", "not_run"] as const)
  test(`qualified support acceptance preserves a recorded ${outcome} outcome and blocks conclusion`, async () => {
    const x = await fixture(),
      { f } = x;
    try {
      const activity = await verificationExecution(f, x.selection);
      activity.inputs = structuredClone(x.execution.inputs);
      activity.results = activity.results.map((row) => ({ ...row, outcome }));
      const result = await f.tracer.verification.recordExecution(activity, actor);
      await f.tracer.verification.reviewSupport(
        await request({ ...x, execution: activity, result }),
        actor,
      );
      await f.tracer.verification.selectResults(
        await verificationResults(f, x.selection, activity.executionId, [x.execution.executionId]),
        actor,
      );
      const analysis = await f.tracer.verification.analyze(x.selection);
      assert.equal(analysis.executions[1].support.assessed, true);
      assert.ok(
        analysis.obligations.every(
          (row) => row.outcome === outcome && row.applicability === "assessed",
        ),
      );
      assert.equal(analysis.ready, false);
      const before = await f.tracer.exportProject();
      await assert.rejects(
        f.tracer.verification.conclude(await verificationMutation(f, x.selection), actor),
        { code: "conflict" },
      );
      assert.deepEqual(await f.tracer.exportProject(), before);
    } finally {
      f.close();
    }
  });

test("each source layer and controlled target revision requires its own qualified judgment", async () => {
  const x = await fixture("research"),
    { f } = x;
  try {
    await f.tracer.verification.reviewSupport(await request(x), actor);
    const opening = await verificationOpening(f);
    opening.targetConfigurationId = x.target.id;
    await f.tracer.verification.open(opening, actor);
    const selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
    const activity = await verificationExecution(f, selection);
    activity.source = {
      kind: "prior_receipt",
      receiptId: x.result.receipt.id,
      rationale: "Interpret exact original passing scope",
    };
    activity.inputs = structuredClone(x.execution.inputs);
    const result = await f.tracer.verification.recordExecution(activity, actor);
    const current = { ...x, selection, execution: activity, result };
    let detail = await f.tracer.verification.execution(selection, activity.executionId);
    assert.deepEqual(
      detail.targetSupport!.layers.map((row) => row.review.state),
      ["unreviewed", "unreviewed"],
    );
    await f.tracer.verification.reviewSupport(await request(current), actor);
    assert.equal(
      (await f.tracer.verification.analyze(selection)).executions[0].support.changed,
      true,
    );
    detail = await f.tracer.verification.execution(selection, activity.executionId);
    const source = detail.targetSupport!.layers[1];
    await f.tracer.verification.reviewSupport(
      {
        ...(await request(current)),
        receiptId: source.receiptId,
        expectedComparison: source.token,
      },
      actor,
    );
    assert.equal(
      (await f.tracer.verification.analyze(selection)).executions[0].support.changed,
      false,
    );
    const prior = (await f.tracer.verification.execution(selection, activity.executionId))
      .targetSupport!;
    const ctx = await f.tracer.configurations.captureContext();
    const target = await f.tracer.configurations.captureExact(
      {
        ...x.target.capture!.intent,
        id: randomUUID(),
        expectedProjectRevision: ctx.projectRevision,
        expectedEvidenceRevision: ctx.evidenceRevision,
      },
      actor,
    );
    await f.tracer.verification.reviseBasis(
      {
        ...(await verificationMutation(f, selection)),
        targetConfigurationId: target.id,
        basis: structuredClone(f.input),
        mapping: f.input.criteria.map((row) => ({ fromId: row.id, toId: row.id })),
      },
      actor,
    );
    const changed = (await f.tracer.verification.execution(selection, activity.executionId))
      .targetSupport!;
    assert.deepEqual(
      changed.layers.map((row) => row.review.state),
      ["unreviewed", "unreviewed"],
    );
    assert.notEqual(
      changed.layers[0].qualification.basisDigest,
      prior.layers[0].qualification.basisDigest,
    );
    assert.equal(
      (await f.tracer.verification.analyze(selection)).executions[0].support.changed,
      true,
    );
    for (const layer of prior.layers)
      assert.deepEqual(
        await f.repository.transaction((tx) => tx.getEvidence("review", layer.review.decision!.id)),
        layer.review.decision,
      );
  } finally {
    f.close();
  }
});

test("a stored qualification label without authenticated command origin cannot establish applicability", async () => {
  const x = await fixture(),
    { f } = x;
  try {
    const detail = await f.tracer.verification.execution(x.selection, x.execution.executionId),
      layer = detail.targetSupport!.layers[0];
    const input = await request(x),
      before = await f.tracer.exportProject();
    await assert.rejects(
      f.tracer.verification.reviewSupport(
        { ...input, expectedComparison: "sha256:" + "0".repeat(64) },
        actor,
      ),
      { code: "conflict" },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
    await f.repository.transaction((tx) =>
      tx.appendEvidence("review", layer.receiptId, {
        ...actor,
        id: randomUUID(),
        at: new Date().toISOString(),
        receiptId: layer.receiptId,
        decision: "accepted",
        rationale: "Untrusted stored label is not command authority",
        comparison: layer.comparison,
        qualification: layer.qualification,
        token: layer.token,
      }),
    );
    await assert.rejects(f.tracer.verification.analyze(x.selection), {
      code: "storage",
      message: /no durable command origin/,
    });
  } finally {
    f.close();
  }
});

test("lost committed target-review response performs one POST and recovers original intent after restart through core, HTTP and CLI", async () => {
  const x = await fixture(),
    { f } = x;
  let server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
  try {
    const command = await request(x);
    let posts = 0;
    const client = createClient({
      baseUrl: server.origin,
      fetch: async (url, init) => {
        const response = await fetch(url, init);
        if (init?.method === "POST") {
          posts++;
          assert.equal(response.status, 200);
          throw Error("Lost committed response");
        }
        return response;
      },
    });
    await client.connect();
    await assert.rejects(client.write("/api/verifications/review-support", command), {
      code: "outcome_unknown",
    });
    assert.equal(posts, 1);
    const original = await f.tracer.evaluations.getOutcome(command.commandId);
    assert.ok(original);
    assert.deepEqual(decodeWrite("/api/verifications/review-support", original, command), original);
    await server.close();
    f.reopen();
    server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
    const fresh = createClient({ baseUrl: server.origin });
    await fresh.connect();
    const before = await f.tracer.exportProject();
    assert.deepEqual(await fresh.write("/api/verifications/review-support", command), original);
    const query = { ...x.selection, executionId: x.execution.executionId };
    const detail = await fresh.read("/api/verification-execution", query);
    assert.equal(detail.targetSupport!.layers[0].review.state, "accepted");
    const malformed = structuredClone(detail);
    malformed.targetSupport!.layers[0].review.decision!.qualification!.ownerId = "other-case";
    assert.throws(() => decodeRead("/api/verification-execution", query, malformed));
    const cli = spawnSync(
      process.execPath,
      ["src/interfaces/cli.ts", "--db", f.database, "evaluation", "outcome", command.commandId],
      { encoding: "utf8" },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), original);
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    await server.close();
    f.close();
  }
});
