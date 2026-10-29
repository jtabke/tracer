import test from "node:test";
import assert from "node:assert/strict";
import { pairVerificationFixture, performTargetVerification } from "./pair-verification-fixture.ts";
import { assessmentCommand, dispositionProposal } from "./application-model-fixture.ts";
import {
  verificationActor as actor,
  verificationMutation,
  verificationExecution,
  verificationTargetInput,
} from "./verification-fixture.ts";
import { assessmentSupportResolver } from "../src/application/assessment-support.ts";
import type { SupportReference } from "../src/core/change-assessment.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: pair reverification requires a real complete controlled after-target conclusion and retains original failed facts`, async () => {
    const x = await pairVerificationFixture(domain),
      { f } = x;
    try {
      const subject = { kind: "entity" as const, id: f.requirement.id };
      const initial = await dispositionProposal(f, x.assessment, subject);
      initial.decision = "reverify";
      initial.actions = [
        {
          id: "repeat-selected-candidate",
          kind: "reverify",
          title: "Perform target verification",
          state: "open",
          resolution: "",
          support: [],
        },
      ];
      await f.tracer.changeAssessments.setDisposition(initial, actor);
      const old = await f.tracer.evidence.recordReceipt(
        {
          outputId: f.method.id,
          outcome: "failed",
          inputs: [{ entityId: f.requirement.id }],
          relationshipInputs: [],
        },
        actor,
      );
      const wrong = await performTargetVerification(x, x.before.id),
        right = await performTargetVerification(x);
      const badReferences: SupportReference[] = [
        { kind: "receipt", id: old.id, mode: "configuration", configurationId: x.after.id },
        {
          kind: "receipt",
          id: right.activity.receipt.id,
          mode: "configuration",
          configurationId: x.after.id,
        },
        {
          kind: "receipt",
          id: wrong.conclusion.receipt.id,
          mode: "configuration",
          configurationId: x.after.id,
        },
        {
          kind: "receipt",
          id: right.conclusion.receipt.id,
          mode: "configuration",
          configurationId: x.before.id,
        },
        { kind: "receipt", id: old.id, mode: "current" },
      ];
      for (const reference of badReferences) {
        const proposal = await dispositionProposal(f, x.assessment, subject);
        proposal.decision = "reverify";
        proposal.actions = [
          {
            ...initial.actions[0],
            state: "done",
            resolution: "Explicit attempted follow-through",
            support: [reference],
          },
        ];
        const snapshot = await f.tracer.exportProject();
        await assert.rejects(f.tracer.changeAssessments.setDisposition(proposal, actor));
        assert.equal(await f.tracer.evaluations.getOutcome(proposal.commandId), null);
        assert.deepEqual(await f.tracer.exportProject(), snapshot);
      }
      const reference: SupportReference = {
        kind: "receipt",
        id: right.conclusion.receipt.id,
        mode: "configuration",
        configurationId: x.after.id,
      };
      const proposal = await dispositionProposal(f, x.assessment, subject);
      proposal.decision = "reverify";
      proposal.actions = [
        {
          ...initial.actions[0],
          state: "done",
          resolution:
            "Performed complete verification under the exact selected after configuration",
          support: [reference],
        },
      ];
      await f.tracer.changeAssessments.setDisposition(proposal, actor);
      const analysis = await f.tracer.changeAssessments.analyze(x.assessment);
      for (const obligation of analysis.obligations) {
        if (obligation.subject.id === subject.id) continue;
        const next = await dispositionProposal(f, x.assessment, obligation.subject);
        if (obligation.subject.kind === "receipt" && obligation.subject.id === old.id) {
          next.decision = "reverify";
          next.actions = [
            {
              id: "replace-original-result",
              kind: "reverify",
              title: "Replace original failed result with performed target verification",
              state: "done",
              resolution:
                "New controlled conclusion covers this declared after-target scope; the original outcome stays failed",
              support: [reference],
            },
          ];
        }
        await f.tracer.changeAssessments.setDisposition(next, actor);
      }
      const closing = await assessmentCommand(f, x.assessment),
        closed = await f.tracer.changeAssessments.close(closing, actor);
      assert.equal(
        (await f.tracer.changeAssessments.analyze(x.assessment)).completion.state,
        "completed",
      );
      assert.equal((await f.tracer.evidence.getReceipt(old.id)).outcome, "failed");
      assert.ok(!x.after.members.some((m) => m.entity.id === right.execution.executionId));
      await f.tracer.updateEntity(
        f.requirement.id,
        1,
        {
          fields: {
            ...f.requirement.fields,
            [f.definition.requirement.fields.statement]:
              "Later live statement outside the fixed target",
          },
        },
        2,
        actor,
      );
      assert.equal(
        (await f.tracer.changeAssessments.analyze(x.assessment)).completion.state,
        "completed",
      );
      await f.tracer.verification.reopen(await verificationMutation(f, right.selection), actor);
      const failed = await verificationExecution(f, right.selection);
      failed.results = failed.results.map((r) => ({ ...r, outcome: "failed" }));
      await f.tracer.verification.recordExecution(failed, actor);
      const stale = await f.tracer.changeAssessments.analyze(x.assessment);
      assert.equal(stale.completion.state, "needs_reassessment");
      assert.equal(
        stale.obligations.find((o) => o.subject.id === subject.id)!.state,
        "stale_basis",
      );
      assert.deepEqual(await f.tracer.evaluations.getOutcome(closing.commandId), closed);
      assert.equal(
        (await f.tracer.evidence.getReceipt(right.conclusion.receipt.id)).id,
        reference.id,
      );
    } finally {
      f.close();
    }
  });

for (const interveningWork of [false, true])
  test(`configuration proof ${interveningWork ? "cannot resurrect after new same-target work" : "survives a clean explicit move to a different target"}`, async () => {
    const x = await pairVerificationFixture(),
      { f } = x;
    try {
      const right = await performTargetVerification(x),
        view = await f.tracer.changeAssessments.get(x.assessment);
      const reference: SupportReference = {
        kind: "receipt",
        id: right.conclusion.receipt.id,
        mode: "configuration",
        configurationId: x.after.id,
      };
      const original = await f.repository.transaction((tx) =>
        assessmentSupportResolver(tx, view.scope).resolve(reference, true),
      );
      await f.tracer.updateEntity(
        f.requirement.id,
        1,
        {
          fields: {
            ...f.requirement.fields,
            [f.definition.requirement.fields.statement]: "Next design's governing statement",
          },
        },
        2,
        actor,
      );
      const input = await verificationTargetInput(f);
      input.expectedSubjectVersion = 2;
      input.members.find((x) => x.entityId === f.requirement.id)!.version = 2;
      const next = await f.tracer.configurations.captureExact(input, actor);
      await f.tracer.verification.reopen(await verificationMutation(f, right.selection), actor);
      if (interveningWork) {
        const execution = await verificationExecution(f, right.selection);
        execution.results = execution.results.map((x) => ({ ...x, outcome: "failed" }));
        await f.tracer.verification.recordExecution(execution, actor);
      }
      await f.tracer.verification.reviseBasis(
        {
          ...(await verificationMutation(f, right.selection)),
          basis: { ...f.input, requirement: { entityId: f.requirement.id, version: 2 } },
          mapping: f.input.criteria.map((x) => ({ fromId: x.id, toId: x.id })),
          targetConfigurationId: next.id,
        },
        actor,
      );
      const current = await f.repository.transaction((tx) =>
        assessmentSupportResolver(tx, view.scope).resolve(reference),
      );
      if (interveningWork) {
        assert.notEqual(current.digest, original.digest);
        await assert.rejects(
          f.repository.transaction((tx) =>
            assessmentSupportResolver(tx, view.scope).resolve(reference, true),
          ),
          { code: "conflict" },
        );
      } else {
        assert.equal(current.digest, original.digest);
        assert.equal(current.hasUnknown, false);
      }
    } finally {
      f.close();
    }
  });
