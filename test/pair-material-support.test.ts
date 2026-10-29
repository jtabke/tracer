import test from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/index.ts";
import type { Entity } from "../src/core/model.ts";
import type { Configuration } from "../src/core/configuration.ts";
import { pairVerificationFixture, performTargetVerification } from "./pair-verification-fixture.ts";
import { verificationTargetInput, verificationActor as actor } from "./verification-fixture.ts";
import { dispositionProposal, assessmentCommand } from "./application-model-fixture.ts";

type Fixture = Awaited<ReturnType<typeof pairVerificationFixture>>;
async function materialCapture(x: Fixture, material: Entity, observationId: string | null) {
  const input = await verificationTargetInput(x.f);
  input.members.push({ entityId: material.id, version: 1 });
  input.content = [
    {
      entityId: material.id,
      observationId,
      ...(observationId ? {} : { reason: "Deliberately unavailable default content" }),
    },
  ];
  return x.f.tracer.configurations.captureExact(input, actor);
}
async function materialAssessment(
  x: Fixture,
  before: Configuration,
  after: Configuration,
  rootId: string,
) {
  const context = await x.f.tracer.applicationModels.resolve(x.pin);
  const request = {
    ...x.opening,
    commandId: crypto.randomUUID(),
    assessmentId: crypto.randomUUID(),
    query: {
      source: "configuration_pair" as const,
      beforeId: before.id,
      afterId: after.id,
      policy: "scoped-reference-dependencies-v1" as const,
      rootId,
      direction: "outgoing" as const,
      relationshipTypes: [],
      depth: 1,
    },
    expectedSchemaVersion: context.context.schemaVersion,
    expectedProjectRevision: context.context.projectRevision,
    expectedEvidenceRevision: context.context.evidenceRevision,
  };
  await x.f.tracer.changeAssessments.open(request, actor);
  return { assessmentId: request.assessmentId, openingCommandId: request.commandId };
}
test("native-only target verification cannot resolve unavailable external material; a known performed replacement retains historical uncertainty", async () => {
  const x = await pairVerificationFixture(),
    { f } = x;
  try {
    const material = await f.tracer.createEntity(
      {
        type: "@resource",
        fields: {},
        resource: {
          label: "Observed engineering input",
          source: { system: "file", externalId: "/synthetic/pair-material" },
        },
      },
      2,
      actor,
    );
    const unknown = await materialCapture(x, material, null);
    const first = await materialAssessment(x, x.before, unknown, material.id);
    const native = await performTargetVerification(
      { ...x, after: unknown, assessment: first },
      unknown.id,
      [{ entityId: material.id, facet: "native" }],
    );
    const subject = { kind: "entity" as const, id: material.id };
    const failed = await dispositionProposal(f, first, subject);
    failed.decision = "reverify";
    failed.actions = [
      {
        id: "material-follow-through",
        kind: "reverify",
        title: "Resolve material verification",
        state: "done",
        resolution: "Native annotations alone do not establish external bytes",
        support: [
          {
            kind: "receipt",
            id: native.conclusion.receipt.id,
            mode: "configuration",
            configurationId: unknown.id,
          },
        ],
      },
    ];
    const snapshot = await f.tracer.exportProject();
    await assert.rejects(f.tracer.changeAssessments.setDisposition(failed, actor), {
      code: "validation",
      message: /related engineering scope/,
    });
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
    const observer = new Tracer(f.repository, undefined, async () => ({
      availability: "available",
      hash: "sha256:" + "b".repeat(64),
    }));
    const observation = await observer.evidence.observe(
      { entityId: material.id, locator: { system: "file", path: "/synthetic/pair-material" } },
      actor,
    );
    const known = await materialCapture(x, material, observation.id);
    const second = await materialAssessment(x, unknown, known, material.id);
    const performed = await performTargetVerification(
      { ...x, before: unknown, after: known, assessment: second },
      known.id,
      [{ entityId: material.id, facet: "content", observationId: observation.id }],
    );
    const proposal = await dispositionProposal(f, second, subject);
    proposal.decision = "reverify";
    proposal.actions = [
      {
        id: "known-after-replacement",
        kind: "reverify",
        title: "Perform verification with known after input",
        state: "done",
        resolution:
          "Known observed input and complete controlled after-target conclusion replace the unfinished work; historical unknown is retained",
        support: [
          {
            kind: "receipt",
            id: performed.conclusion.receipt.id,
            mode: "configuration",
            configurationId: known.id,
          },
        ],
      },
    ];
    await f.tracer.changeAssessments.setDisposition(proposal, actor);
    const analysis = await f.tracer.changeAssessments.analyze(second);
    const nativeObligation = analysis.obligations.find((x) => x.subject.id === subject.id)!;
    assert.equal(nativeObligation.hasUnknown, true);
    assert.equal(nativeObligation.state, "accounted");
    const detail = await f.tracer.changeAssessments.disposition(second, subject);
    assert.equal(detail!.data.basis.hasUnknown, true);
    assert.equal(detail!.data.actionSupport[0].support[0].hasUnknown, false);
    assert.equal(detail!.data.actionSupport[0].support[0].applicability, "applicable");
    for (const obligation of analysis.obligations)
      if (obligation.subject.id !== subject.id)
        await f.tracer.changeAssessments.setDisposition(
          await dispositionProposal(f, second, obligation.subject),
          actor,
        );
    await f.tracer.changeAssessments.close(await assessmentCommand(f, second), actor);
    assert.equal((await f.tracer.changeAssessments.analyze(second)).completion.state, "completed");
    const changed = new Tracer(f.repository, undefined, async () => ({
      availability: "available",
      hash: "sha256:" + "c".repeat(64),
    }));
    await changed.evidence.observe(
      { entityId: material.id, locator: { system: "file", path: "/synthetic/pair-material" } },
      actor,
    );
    assert.equal((await f.tracer.changeAssessments.analyze(second)).completion.state, "completed");
    assert.equal(
      (await f.tracer.configurations.get(unknown.id)).capture!.content[0].observation,
      null,
    );
  } finally {
    f.close();
  }
});
