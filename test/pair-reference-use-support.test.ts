import test from "node:test";
import assert from "node:assert/strict";
import { referenceUseFixture } from "./reference-use-fixture.ts";
import { installAssessmentFixture } from "./pair-verification-fixture.ts";
import { assessmentCommand, dispositionProposal } from "./application-model-fixture.ts";
import {
  verificationActor as actor,
  verificationOpening,
  verificationExecution,
  verificationResults,
  verificationMutation,
} from "./verification-fixture.ts";
import type { SupportReference } from "../src/core/change-assessment.ts";

test("pair reverification keeps independently pinned native reference uses separate from the resource default and each other", async () => {
  const x = await referenceUseFixture("research", false),
    { f } = x;
  try {
    const { pin } = await installAssessmentFixture(f, "research");
    const before = await x.capture(),
      after = await x.capture();
    const source = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.requirement.id,
        outcome: "Original failed interpretation is retained",
        inputs: [x.input(0), x.input(1), x.input(2)],
        relationshipInputs: x.relationships([0, 1, 2]),
      },
      actor,
    );
    const context = await f.tracer.applicationModels.resolve(pin);
    const opening = {
      commandId: crypto.randomUUID(),
      assessmentId: crypto.randomUUID(),
      title: "Assess independent material uses",
      purpose: "Synthetic selected resource scope; quoted-passage relevance remains unknown",
      model: pin,
      query: {
        source: "configuration_pair" as const,
        beforeId: before.id,
        afterId: after.id,
        policy: "scoped-reference-dependencies-v1" as const,
        rootId: x.resource.id,
        direction: "outgoing" as const,
        relationshipTypes: [],
        depth: 1,
      },
      additionalFields: {},
      expectedSchemaVersion: context.context.schemaVersion,
      expectedProjectRevision: context.context.projectRevision,
      expectedEvidenceRevision: context.context.evidenceRevision,
    };
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    const subjects = [
      { kind: "entity" as const, id: x.resource.id },
      { kind: "receipt" as const, id: source.id },
    ];
    const verify = async (indices: number[]) => {
      const request = await verificationOpening(f);
      request.targetConfigurationId = after.id;
      request.targetPolicy = "target-reference-uses-v2";
      await f.tracer.verification.open(request, actor);
      const selected = { caseId: request.caseId, openingCommandId: request.commandId };
      const execution = await verificationExecution(f, selected);
      execution.inputs = indices.map(x.input);
      execution.relationshipInputs = x.relationships([0, 1, 2]);
      await f.tracer.verification.recordExecution(execution, actor);
      await f.tracer.verification.selectResults(
        await verificationResults(f, selected, execution.executionId),
        actor,
      );
      const result = await f.tracer.verification.conclude(
        await verificationMutation(f, selected),
        actor,
      );
      await f.tracer.changeAssessments.refresh(await assessmentCommand(f, selection), actor);
      return {
        kind: "receipt" as const,
        id: result.receipt.id,
        mode: "configuration" as const,
        configurationId: after.id,
      };
    };
    const onlyB = await verify([0]);
    for (const subject of subjects) {
      const proposal = await dispositionProposal(f, selection, subject);
      proposal.decision = "reverify";
      proposal.actions = [
        {
          id: "independent-use-check",
          kind: "reverify",
          title: "Verify this material scope",
          state: "done",
          resolution: "A B-only use does not establish C or another independent use",
          support: [onlyB],
        },
      ];
      await assert.rejects(f.tracer.changeAssessments.setDisposition(proposal, actor), {
        code: "validation",
        message: /related engineering scope/,
      });
    }
    const all: SupportReference = await verify([0, 1, 2]);
    const proposal = await dispositionProposal(f, selection, subjects[1]);
    proposal.decision = "reverify";
    proposal.actions = [
      {
        id: "all-selected-uses",
        kind: "reverify",
        title: "Verify all independent selections",
        state: "done",
        resolution:
          "All B/C/B reference identities are explicitly declared and known under the target policy",
        support: [all],
      },
    ];
    await f.tracer.changeAssessments.setDisposition(proposal, actor);
    const detail = await f.tracer.changeAssessments.disposition(selection, subjects[1]);
    assert.equal(detail!.data.basis.inputs.length, 3);
    assert.deepEqual(
      detail!.data.basis.inputs.map((i) => i.referenceId),
      [x.refs[0].id, x.refs[1].id, x.refs[2].id],
    );
    assert.deepEqual(
      detail!.data.basis.inputs.map((i) => i.revision),
      [1, 2, 1],
    );
    assert.equal((await f.tracer.evidence.getReceipt(source.id)).outcome, source.outcome);
  } finally {
    f.close();
  }
});
