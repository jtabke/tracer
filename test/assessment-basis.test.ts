import test from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, writeFileSync } from "node:fs";
import {
  applicationModelFixture,
  assessmentOpenRequest,
  assessmentCommand as command,
  dispositionProposal as proposal,
} from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";
import type { OpenChangeAssessment } from "../src/core/change-assessment.ts";

for (const mode of ["historical", "current"] as const)
  test(`${mode} observed support retains its explicit meaning after native resource deletion`, async () => {
    const f = await applicationModelFixture();
    try {
      const opening = await assessmentOpenRequest(f);
      await f.tracer.changeAssessments.open(opening, actor);
      const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
      const request = await proposal(f, selection, { kind: "entity", id: f.criterion.id });
      request.support = [{ kind: "observation", id: f.spec.observation.id, mode }];
      await f.tracer.changeAssessments.setDisposition(request, actor);
      await f.tracer.changeAssessments.close(await command(f, selection), actor);
      await f.tracer.removeEntity(f.spec.entity.id, 1, 2, actor, true);
      assert.equal(
        (await f.tracer.changeAssessments.analyze(selection)).completion.state,
        mode === "historical" ? "completed" : "needs_reassessment",
      );
    } finally {
      f.close();
    }
  });

for (const mode of ["historical", "current"] as const)
  test(`${mode} relationship support remains distinct from live graph coverage`, async () => {
    const f = await applicationModelFixture();
    try {
      const link = (
        await f.tracer.queryRelationships({ source: f.criterion.id, type: f.model.allocation })
      ).items[0];
      const opening = await assessmentOpenRequest(f);
      await f.tracer.changeAssessments.open(opening, actor);
      const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
      const request = await proposal(f, selection, { kind: "entity", id: f.criterion.id });
      request.support = [{ kind: "relationship", id: link.id, version: 1, mode }];
      await f.tracer.changeAssessments.setDisposition(request, actor);
      await f.tracer.changeAssessments.close(await command(f, selection), actor);
      await f.tracer.removeRelationship(link.id, 1, 2, actor);
      assert.equal(
        (await f.tracer.changeAssessments.analyze(selection)).completion.state,
        mode === "historical" ? "completed" : "needs_reassessment",
      );
    } finally {
      f.close();
    }
  });

test("a current reverification result must declare the assessed candidate, rather than merely naming it as output", async () => {
  const f = await applicationModelFixture();
  try {
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    const unrelated = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.criterion.id,
        outcome: "SIMULATED unrelated method",
        inputs: [{ entityId: f.article.id, facet: "native" }],
      },
      actor,
    );
    const request = await proposal(f, selection, { kind: "entity", id: f.criterion.id });
    request.decision = "reverify";
    request.actions = [
      {
        id: "test",
        kind: "reverify",
        title: "Repeat criterion check",
        state: "done",
        resolution: "Synthetic claim",
        support: [{ kind: "receipt", id: unrelated.id, mode: "current" }],
      },
    ];
    const before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.changeAssessments.setDisposition(request, actor), {
      code: "validation",
    });
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});

test("field-scoped receipt basis ignores unrelated annotations while the independently selected native candidate remains distinct", async () => {
  const f = await applicationModelFixture();
  try {
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "SIMULATED threshold check",
        inputs: [{ entityId: f.criterion.id, facet: "native", fields: [f.model.threshold] }],
      },
      actor,
    );
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    for (const item of (await f.tracer.changeAssessments.analyze(selection)).obligations)
      await f.tracer.changeAssessments.setDisposition(
        await proposal(f, selection, item.subject),
        actor,
      );
    await f.tracer.changeAssessments.close(await command(f, selection), actor);
    const before = (await f.tracer.changeAssessments.analyze(selection)).obligations.find(
      (item) => item.subject.id === receipt.id,
    )!;
    await f.tracer.updateEntity(
      f.criterion.id,
      1,
      { fields: { ...f.criterion.fields, [f.model.annotation]: "Unselected annotation" } },
      2,
      actor,
    );
    const after = await f.tracer.changeAssessments.analyze(selection),
      selected = after.obligations.find((item) => item.subject.id === receipt.id)!;
    assert.equal(selected.currentDigest, before.currentDigest);
    assert.equal(selected.state, "accounted");
    assert.equal(
      after.obligations.find((item) => item.subject.kind === "entity")!.state,
      "stale_basis",
    );
    assert.equal(after.completion.state, "needs_reassessment");
  } finally {
    f.close();
  }
});

test("path-only matching does not adopt an out-of-scope terminal's content as engineering evidence", async () => {
  const f = await applicationModelFixture();
  try {
    const schema = structuredClone(f.schema);
    schema.relationshipTypes.context = {
      source: [f.model.article],
      target: [],
      resourceTarget: true,
      fields: {},
    };
    await f.tracer.setSchema(schema, 2, actor);
    const first = (
      await f.tracer.queryRelationships({ source: f.criterion.id, type: f.model.allocation })
    ).items[0];
    const second = await f.tracer.createRelationship(
      { type: "context", source: f.article.id, target: f.spec.entity.id, fields: {} },
      3,
      actor,
    );
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.criterion.id,
        outcome: "SIMULATED path-based use",
        inputs: [
          {
            entityId: f.spec.entity.id,
            observationId: f.spec.observation.id,
            path: [first.id, second.id],
          },
        ],
      },
      actor,
    );
    const opening: OpenChangeAssessment = await assessmentOpenRequest(f);
    opening.query.relationshipTypes = [f.model.allocation];
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    for (const item of (await f.tracer.changeAssessments.analyze(selection)).obligations)
      await f.tracer.changeAssessments.setDisposition(
        await proposal(f, selection, item.subject),
        actor,
      );
    await f.tracer.changeAssessments.close(await command(f, selection), actor);
    unlinkSync(f.specFile);
    await f.tracer.evidence.observe(
      { entityId: f.spec.entity.id, locator: { system: "file", path: f.specFile } },
      actor,
    );
    assert.equal((await f.tracer.evidence.compareReceipt(receipt.id)).state, "unknown");
    const analysis = await f.tracer.changeAssessments.analyze(selection);
    assert.equal(analysis.completion.state, "completed");
    assert.equal(
      analysis.obligations.find((item) => item.subject.id === receipt.id)!.hasUnknown,
      false,
    );
  } finally {
    f.close();
  }
});

test("known replacement verification can account for an originally unknown receipt without rewriting that uncertainty", async () => {
  const f = await applicationModelFixture();
  try {
    unlinkSync(f.specFile);
    const unknown = await f.tracer.evidence.observe(
      { entityId: f.spec.entity.id, locator: { system: "file", path: f.specFile } },
      actor,
    );
    const original = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "SIMULATED original unknown source",
        inputs: [{ entityId: f.spec.entity.id, observationId: unknown.id }],
      },
      actor,
    );
    writeFileSync(f.specFile, "SIMULATED restored known source\n");
    const known = await f.tracer.evidence.observe(
      { entityId: f.spec.entity.id, locator: { system: "file", path: f.specFile } },
      actor,
    );
    const replacement = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        supersedes: original.id,
        outcome: "SIMULATED known rerun",
        inputs: [{ entityId: f.spec.entity.id, observationId: known.id }],
      },
      actor,
    );
    const opening = await assessmentOpenRequest(f);
    opening.query.rootId = f.spec.entity.id;
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    for (const item of (await f.tracer.changeAssessments.analyze(selection)).obligations) {
      const request = await proposal(f, selection, item.subject);
      if (item.subject.id === original.id) {
        request.decision = "reverify";
        request.actions = [
          {
            id: "rerun",
            kind: "reverify",
            title: "Replace unknown execution",
            state: "done",
            resolution: "Synthetic known rerun supersedes the unknown original",
            support: [{ kind: "receipt", id: replacement.id, mode: "current" }],
          },
        ];
      }
      await f.tracer.changeAssessments.setDisposition(request, actor);
    }
    await f.tracer.changeAssessments.close(await command(f, selection), actor);
    const analysis = await f.tracer.changeAssessments.analyze(selection);
    assert.equal(analysis.completion.state, "completed");
    assert.equal(
      analysis.obligations.find((item) => item.subject.id === original.id)!.hasUnknown,
      true,
    );
    assert.equal((await f.tracer.evidence.compareReceipt(original.id)).state, "unknown");
  } finally {
    f.close();
  }
});

test("a native-only verification receipt cannot make an unavailable external content basis known", async () => {
  const f = await applicationModelFixture();
  try {
    unlinkSync(f.specFile);
    await f.tracer.evidence.observe(
      { entityId: f.spec.entity.id, locator: { system: "file", path: f.specFile } },
      actor,
    );
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "SIMULATED native annotation check only",
        inputs: [{ entityId: f.spec.entity.id, facet: "native" }],
      },
      actor,
    );
    const opening = await assessmentOpenRequest(f);
    opening.query.rootId = f.spec.entity.id;
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    const request = await proposal(f, selection, { kind: "entity", id: f.spec.entity.id });
    request.decision = "reverify";
    request.actions = [
      {
        id: "metadata-check",
        kind: "reverify",
        title: "Check native annotations",
        state: "done",
        resolution: "Synthetic native-only result, external contents remain unknown",
        support: [{ kind: "receipt", id: receipt.id, mode: "current" }],
      },
    ];
    await f.tracer.changeAssessments.setDisposition(request, actor);
    await f.tracer.changeAssessments.setDisposition(
      await proposal(f, selection, { kind: "receipt", id: receipt.id }),
      actor,
    );
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).obligations.find(
        (item) => item.subject.kind === "entity",
      )!.state,
      "unknown",
    );
    await assert.rejects(f.tracer.changeAssessments.close(await command(f, selection), actor), {
      code: "conflict",
    });
  } finally {
    f.close();
  }
});

test("intentional native removal is captured as a known absence rather than an invented active input", async () => {
  const f = await applicationModelFixture();
  try {
    await f.tracer.removeEntity(f.criterion.id, 1, 2, actor, true);
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId },
      subject = { kind: "entity" as const, id: f.criterion.id };
    await f.tracer.changeAssessments.setDisposition(await proposal(f, selection, subject), actor);
    const judgment = await f.tracer.changeAssessments.disposition(selection, subject);
    assert.ok(judgment);
    assert.deepEqual(judgment.data.basis.absences, [subject]);
    assert.deepEqual(judgment.data.basis.inputs, []);
    assert.equal(judgment.data.basis.hasUnknown, false);
    await f.tracer.changeAssessments.close(await command(f, selection), actor);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).completion.state,
      "completed",
    );
  } finally {
    f.close();
  }
});

test("superseded results remain usable as historical facts while current support rejects replacement", async () => {
  const f = await applicationModelFixture();
  try {
    const input = {
      outputId: f.method.id,
      outcome: "SIMULATED earlier result",
      inputs: [{ entityId: f.criterion.id, facet: "native" as const }],
    };
    const old = await f.tracer.evidence.recordReceipt(input, actor);
    await f.tracer.evidence.recordReceipt(
      {
        ...input,
        supersedes: old.id,
        outcome: "SIMULATED replacement; no outcome interpretation inferred",
      },
      actor,
    );
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
    const request = await proposal(f, selection, { kind: "entity", id: f.criterion.id });
    request.support = [{ kind: "receipt", id: old.id, mode: "current" }];
    const before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.changeAssessments.setDisposition(request, actor), {
      code: "conflict",
    });
    assert.deepEqual(await f.tracer.exportProject(), before);
    request.support = [{ kind: "receipt", id: old.id, mode: "historical" }];
    await f.tracer.changeAssessments.setDisposition(request, actor);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).obligations.find(
        (item) => item.subject.kind === "entity",
      )!.state,
      "accounted",
    );
  } finally {
    f.close();
  }
});
