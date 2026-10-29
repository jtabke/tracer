import test from "node:test";
import assert from "node:assert/strict";
import { pairVerificationFixture, performVerification } from "./pair-verification-fixture.ts";
import { verificationActor as actor, verificationTargetInput } from "./verification-fixture.ts";
import { assessmentCommand, dispositionProposal } from "./application-model-fixture.ts";
import { assessmentSupportResolver } from "../src/application/assessment-support.ts";
import type { SupportReference } from "../src/core/change-assessment.ts";

test("pair assessment closes all 25 obligations despite its own history and refuses an oversized refreshed population without dropping any", async () => {
  const x = await pairVerificationFixture(),
    { f } = x;
  try {
    for (let i = 0; i < 24; i++)
      await f.tracer.evidence.recordReceipt(
        {
          outputId: f.method.id,
          outcome: `Unexecuted scoped item ${i}`,
          inputs: [
            { entityId: f.requirement.id, fields: [f.definition.requirement.fields.statement] },
          ],
          relationshipInputs: [],
        },
        actor,
      );
    await f.tracer.changeAssessments.refresh(await assessmentCommand(f, x.assessment), actor);
    const analysis = await f.tracer.changeAssessments.analyze(x.assessment);
    assert.equal(analysis.obligations.length, 25);
    for (const obligation of analysis.obligations)
      await f.tracer.changeAssessments.setDisposition(
        await dispositionProposal(f, x.assessment, obligation.subject),
        actor,
      );
    const closing = await assessmentCommand(f, x.assessment),
      closed = await f.tracer.changeAssessments.close(closing, actor);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(x.assessment)).completion.state,
      "completed",
    );
    await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "One more related result",
        inputs: [{ entityId: f.requirement.id }],
        relationshipInputs: [],
      },
      actor,
    );
    const changed = await f.tracer.changeAssessments.analyze(x.assessment);
    assert.equal(changed.discovery, "unknown");
    assert.match(changed.discoveryReason!, /25 candidates/);
    assert.equal(changed.completion.state, "needs_reassessment");
    assert.equal(changed.obligations.length, 25);
    await f.tracer.changeAssessments.reopen(await assessmentCommand(f, x.assessment), actor);
    const refresh = await assessmentCommand(f, x.assessment),
      snapshot = await f.tracer.exportProject();
    await assert.rejects(f.tracer.changeAssessments.refresh(refresh, actor), {
      code: "validation",
      message: /25 candidates/,
    });
    assert.equal(await f.tracer.evaluations.getOutcome(refresh.commandId), null);
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
    assert.deepEqual(await f.tracer.evaluations.getOutcome(closing.commandId), closed);
  } finally {
    f.close();
  }
});

test("target-proof resolution caches repeated references and exhausts its complete 25-proof bound", async () => {
  const x = await pairVerificationFixture(),
    { f } = x;
  try {
    const references: SupportReference[] = [];
    for (let i = 0; i < 26; i++) {
      const performed = await performVerification(f, x.after.id);
      references.push({
        kind: "receipt",
        id: performed.conclusion.receipt.id,
        mode: "configuration",
        configurationId: x.after.id,
      });
    }
    const view = await f.tracer.changeAssessments.get(x.assessment),
      snapshot = await f.tracer.exportProject();
    await f.repository.transaction(async (tx) => {
      const resolver = assessmentSupportResolver(tx, view.scope);
      const first = await resolver.resolve(references[0], true);
      for (let i = 0; i < 30; i++)
        assert.strictEqual(await resolver.resolve(references[0], true), first);
      for (const reference of references.slice(1, 25))
        assert.equal((await resolver.resolve(reference, true)).applicability, "applicable");
      await assert.rejects(resolver.resolve(references[25], true), {
        code: "validation",
        message: /25 distinct target verification proofs/,
      });
    });
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
  } finally {
    f.close();
  }
});

test("shared target-proof work budget rejects before native writes instead of resetting for every supporting conclusion", async () => {
  const x = await pairVerificationFixture(),
    { f } = x;
  try {
    const material = await f.tracer.createEntity(
      {
        type: "@resource",
        fields: { text: "x".repeat(900000) },
        resource: { label: "Large retained native engineering input" },
      },
      2,
      actor,
    );
    const input = await verificationTargetInput(f);
    input.members.push({ entityId: material.id, version: 1 });
    const target = await f.tracer.configurations.captureExact(input, actor),
      context = await f.tracer.applicationModels.resolve(x.pin);
    const opening = {
      ...x.opening,
      commandId: crypto.randomUUID(),
      assessmentId: crypto.randomUUID(),
      query: {
        ...x.opening.query,
        source: "configuration_pair" as const,
        beforeId: x.before.id,
        afterId: target.id,
        policy: "scoped-reference-dependencies-v1" as const,
      },
      expectedSchemaVersion: context.context.schemaVersion,
      expectedProjectRevision: context.context.projectRevision,
      expectedEvidenceRevision: context.context.evidenceRevision,
    };
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId },
      support: SupportReference[] = [];
    // Retained target context counts even when an execution does not declare this material.
    // Keep each operation below its response budget, then exhaust the shared proof budget.
    for (let i = 0; i < 20; i++) {
      const performed = await performVerification(f, target.id);
      support.push({
        kind: "receipt",
        id: performed.conclusion.receipt.id,
        mode: "configuration",
        configurationId: target.id,
      });
    }
    const request = await dispositionProposal(f, selection, {
      kind: "entity",
      id: f.requirement.id,
    });
    request.support = support.slice(0, 10);
    request.actions = [
      {
        id: "bounded-target-investigation",
        kind: "investigate",
        title: "Inspect remaining selected target conclusions",
        state: "done",
        resolution: "All supporting uses share the same bounded resolution session",
        support: support.slice(10),
      },
    ];
    const snapshot = await f.tracer.exportProject();
    await assert.rejects(f.tracer.changeAssessments.setDisposition(request, actor), {
      code: "validation",
      message: /work budget/,
    });
    assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
    const smaller = await dispositionProposal(f, selection, request.subject);
    smaller.support = [support[0]];
    await f.tracer.changeAssessments.setDisposition(smaller, actor);
    assert.equal(
      (await f.tracer.changeAssessments.disposition(selection, request.subject))!.data.support[0]
        .applicability,
      "applicable",
    );
  } finally {
    f.close();
  }
});
