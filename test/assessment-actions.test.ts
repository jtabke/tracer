import test from "node:test";
import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import {
  applicationModelFixture,
  assessmentOpenRequest,
  assessmentCommand as command,
  dispositionProposal as proposal,
} from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";
import type { OpenChangeAssessment } from "../src/core/change-assessment.ts";

test("invalid decisions, stale basis and action deletion reject atomically without reserving success", async () => {
  const f = await applicationModelFixture();
  try {
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId },
      subject = { kind: "entity" as const, id: f.criterion.id };
    const initial = await proposal(f, selection, subject);
    initial.decision = "investigate";
    initial.actions = [
      {
        id: "work",
        kind: "investigate",
        title: "Examine consequence",
        state: "open",
        resolution: "",
        support: [],
      },
    ];
    await f.tracer.changeAssessments.setDisposition(initial, actor);
    const request = await proposal(f, selection, subject),
      before = await f.tracer.exportProject();
    const samples = [
      { ...request, actions: [] },
      { ...request, decision: "no_action" as const },
      { ...request, decision: "reverify" as const },
      { ...request, expectedBasisDigest: "sha256:" + "0".repeat(64) },
      { ...request, expectedDispositionVersion: 99 },
      { ...request, additionalFields: { [f.definition.disposition.fields.decision]: "forged" } },
      {
        ...request,
        actions: [
          {
            ...initial.actions[0],
            state: "done" as const,
            resolution: "claimed",
            support: [
              {
                kind: "entity" as const,
                id: f.criterion.id,
                version: 1,
                mode: "historical" as const,
              },
            ],
          },
        ],
      },
      {
        ...request,
        actions: [
          {
            ...initial.actions[0],
            state: "waived" as const,
            resolution: "claimed exception",
            support: [
              {
                kind: "entity" as const,
                id: f.criterion.id,
                version: 1,
                mode: "historical" as const,
              },
            ],
          },
        ],
      },
    ];
    for (const sample of samples) {
      await assert.rejects(f.tracer.changeAssessments.setDisposition(sample, actor));
      assert.deepEqual(await f.tracer.exportProject(), before);
      assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
    }
    request.decision = "investigate";
    request.actions = [
      {
        ...initial.actions[0],
        state: "done",
        resolution: "Synthetic examination documented against current facts",
        support: [{ kind: "entity", id: f.criterion.id, version: 1, mode: "current" }],
      },
    ];
    await f.tracer.changeAssessments.setDisposition(request, actor);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).obligations[0].state,
      "accounted",
    );
  } finally {
    f.close();
  }
});

for (const mode of ["historical", "current"] as const)
  test(`${mode} supporting native states retain distinct applicability`, async () => {
    const f = await applicationModelFixture();
    try {
      const opening = await assessmentOpenRequest(f);
      await f.tracer.changeAssessments.open(opening, actor);
      const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
      const request = await proposal(f, selection, { kind: "entity", id: f.criterion.id });
      request.support = [{ kind: "entity", id: f.article.id, version: 1, mode }];
      await f.tracer.changeAssessments.setDisposition(request, actor);
      await f.tracer.changeAssessments.close(await command(f, selection), actor);
      await f.tracer.updateEntity(
        f.article.id,
        1,
        { fields: { ...f.article.fields, [f.model.articleRevision]: "B" } },
        2,
        actor,
      );
      assert.equal(
        (await f.tracer.changeAssessments.analyze(selection)).completion.state,
        mode === "historical" ? "completed" : "needs_reassessment",
      );
    } finally {
      f.close();
    }
  });

test("current observed support ignores repeated observation identity and annotation edits but exposes unknown content", async () => {
  const f = await applicationModelFixture();
  try {
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    const request = await proposal(f, selection, { kind: "entity", id: f.criterion.id });
    request.support = [{ kind: "observation", id: f.spec.observation.id, mode: "current" }];
    await f.tracer.changeAssessments.setDisposition(request, actor);
    await f.tracer.changeAssessments.close(await command(f, selection), actor);
    await f.tracer.updateEntity(
      f.spec.entity.id,
      1,
      {
        fields: f.spec.entity.fields,
        resource: { ...f.spec.entity.resource!, label: "Presentation-only label" },
      },
      2,
      actor,
    );
    const next = await f.tracer.evidence.observe(
      { entityId: f.spec.entity.id, locator: { system: "file", path: f.specFile } },
      actor,
    );
    assert.notEqual(next.id, f.spec.observation.id);
    assert.equal(next.hash, f.spec.observation.hash);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).completion.state,
      "completed",
    );
    unlinkSync(f.specFile);
    await f.tracer.evidence.observe(
      { entityId: f.spec.entity.id, locator: { system: "file", path: f.specFile } },
      actor,
    );
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).completion.state,
      "needs_reassessment",
    );
  } finally {
    f.close();
  }
});

test("a judgment cannot manufacture current supporting evidence by changing its own scope", async () => {
  const f = await applicationModelFixture();
  try {
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    const self = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "Synthetic scope observation",
        inputs: [
          {
            entityId: opening.assessmentId,
            facet: "native",
            fields: [f.definition.assessment.fields.scope],
          },
        ],
      },
      actor,
    );
    const request = await proposal(f, selection, { kind: "entity", id: f.criterion.id });
    request.decision = "investigate";
    request.actions = [
      {
        id: "review",
        kind: "investigate",
        title: "Inspect current criteria",
        state: "done",
        resolution: "Synthetic inspection",
        support: [{ kind: "receipt", id: self.id, mode: "current" }],
      },
    ];
    const before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.changeAssessments.setDisposition(request, actor), {
      code: "conflict",
    });
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal(await f.tracer.evaluations.getOutcome(request.commandId), null);
    request.actions[0].support = [
      { kind: "receipt", id: self.id, mode: "historical" },
      { kind: "entity", id: f.criterion.id, version: 1, mode: "current" },
    ];
    await f.tracer.changeAssessments.setDisposition(request, actor);
  } finally {
    f.close();
  }
});

test("closure rejects evidence that its own state transition would immediately make stale", async () => {
  const f = await applicationModelFixture();
  try {
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    const self = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "SIMULATED observation of open state",
        inputs: [
          {
            entityId: opening.assessmentId,
            facet: "native",
            fields: [f.definition.assessment.fields.state],
          },
        ],
      },
      actor,
    );
    const request = await proposal(f, selection, { kind: "entity", id: f.criterion.id });
    request.support = [{ kind: "receipt", id: self.id, mode: "current" }];
    await f.tracer.changeAssessments.setDisposition(request, actor);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).obligations[0].state,
      "accounted",
    );
    const closing = await command(f, selection),
      before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.changeAssessments.close(closing, actor), { code: "conflict" });
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal(await f.tracer.evaluations.getOutcome(closing.commandId), null);
    const stable = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "SIMULATED stable title context",
        inputs: [
          {
            entityId: opening.assessmentId,
            facet: "native",
            fields: [f.definition.assessment.fields.title],
          },
        ],
      },
      actor,
    );
    const revised = await proposal(f, selection, { kind: "entity", id: f.criterion.id });
    revised.support = [{ kind: "receipt", id: stable.id, mode: "current" }];
    await f.tracer.changeAssessments.setDisposition(revised, actor);
    await f.tracer.changeAssessments.close(await command(f, selection), actor);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).completion.state,
      "completed",
      "Unchanged selected fields remain valid across unrelated state writes",
    );
  } finally {
    f.close();
  }
});

for (const allowed of [false, true])
  test(`unknown acknowledgment requires selected policy (${allowed}) and preserves uncertainty`, async () => {
    const f = await applicationModelFixture();
    try {
      const definition = { ...f.definition, policy: { allowUnknown: allowed } };
      await f.tracer.updateEntity(
        f.profile.id,
        1,
        { fields: { ...f.profile.fields, [f.pin.field]: definition } },
        2,
        actor,
      );
      unlinkSync(f.specFile);
      await f.tracer.evidence.observe(
        { entityId: f.spec.entity.id, locator: { system: "file", path: f.specFile } },
        actor,
      );
      const opening = await assessmentOpenRequest(f);
      opening.model = { ...opening.model, version: 2 };
      opening.query.rootId = f.spec.entity.id;
      await f.tracer.changeAssessments.open(opening, actor);
      const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
      const request = await proposal(f, selection, { kind: "entity", id: f.spec.entity.id });
      await assert.rejects(f.tracer.changeAssessments.setDisposition(request, actor), {
        code: "validation",
      });
      request.decision = "acknowledge_unknown";
      if (!allowed) {
        await assert.rejects(f.tracer.changeAssessments.setDisposition(request, actor), {
          code: "validation",
        });
        return;
      }
      await f.tracer.changeAssessments.setDisposition(request, actor);
      await f.tracer.changeAssessments.close(await command(f, selection), actor);
      const analysis = await f.tracer.changeAssessments.analyze(selection);
      assert.equal(analysis.completion.state, "completed");
      assert.equal(analysis.obligations[0].hasUnknown, true);
      assert.equal(analysis.obligations[0].disposition?.decision, "acknowledge_unknown");
    } finally {
      f.close();
    }
  });

test("action waivers are explicit selected-model exceptions with retained rationale and support", async () => {
  const f = await applicationModelFixture();
  try {
    await f.tracer.updateEntity(
      f.profile.id,
      1,
      {
        fields: {
          ...f.profile.fields,
          [f.pin.field]: {
            ...f.definition,
            policy: { allowUnknown: false, allowActionWaiver: true },
          },
        },
      },
      2,
      actor,
    );
    const opening = await assessmentOpenRequest(f);
    opening.model = { ...opening.model, version: 2 };
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    const request = await proposal(f, selection, { kind: "entity", id: f.criterion.id });
    request.decision = "investigate";
    request.actions = [
      {
        id: "exception",
        kind: "investigate",
        title: "Reconsider unnecessary investigation",
        state: "waived",
        resolution: "Synthetic explicit scope exception under the selected policy",
        support: [{ kind: "entity", id: f.profile.id, version: 2, mode: "historical" }],
      },
    ];
    await f.tracer.changeAssessments.setDisposition(request, actor);
    await f.tracer.changeAssessments.close(await command(f, selection), actor);
    const analysis = await f.tracer.changeAssessments.analyze(selection);
    assert.equal(analysis.obligations[0].waivedActions, 1);
    assert.equal(analysis.completion.state, "completed");
  } finally {
    f.close();
  }
});

test("controlled judgments reject edited fields and duplicate/foreign membership", async () => {
  const f = await applicationModelFixture();
  try {
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    const request = await proposal(f, selection, { kind: "entity", id: f.criterion.id });
    await f.tracer.changeAssessments.setDisposition(request, actor);
    const item = await f.tracer.getEntity(request.dispositionId);
    await f.tracer.updateEntity(
      item.id,
      1,
      {
        fields: {
          ...item.fields,
          [f.definition.disposition.fields.rationale]: "Uncontrolled changed rationale",
        },
      },
      2,
      actor,
    );
    await assert.rejects(f.tracer.changeAssessments.analyze(selection), { code: "conflict" });
    await f.tracer.updateEntity(item.id, 2, { fields: item.fields }, 2, actor);
    const second = await assessmentOpenRequest(f);
    second.commandId = "other-assessment";
    await f.tracer.changeAssessments.open(second, actor);
    const member = await f.tracer.createRelationship(
      {
        type: f.definition.relationships.member,
        source: second.assessmentId,
        target: item.id,
        fields: {},
      },
      2,
      actor,
    );
    await assert.rejects(f.tracer.changeAssessments.analyze(selection), { code: "conflict" });
    await f.tracer.removeRelationship(member.id, 1, 2, actor);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).obligations[0].state,
      "accounted",
    );
  } finally {
    f.close();
  }
});

test("the full 25-candidate population remains completable after fifty controlled judgments", async () => {
  const f = await applicationModelFixture();
  try {
    for (let index = 0; index < 11; index++) {
      const entity = await f.tracer.createEntity(
        { type: f.model.article, fields: { title: "Additional candidate " + index } },
        2,
        actor,
      );
      await f.tracer.createRelationship(
        { type: f.model.allocation, source: f.criterion.id, target: entity.id, fields: {} },
        2,
        actor,
      );
    }
    const opening: OpenChangeAssessment = await assessmentOpenRequest(f);
    opening.query.relationshipTypes = [f.model.allocation];
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    const subjects = (await f.tracer.changeAssessments.analyze(selection)).obligations.map(
      (item) => item.subject,
    );
    assert.equal(subjects.length, 25);
    for (let pass = 0; pass < 2; pass++)
      for (const subject of subjects)
        await f.tracer.changeAssessments.setDisposition(
          await proposal(f, selection, subject),
          actor,
        );
    await f.tracer.changeAssessments.close(await command(f, selection), actor);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).completion.state,
      "completed",
    );
  } finally {
    f.close();
  }
});
