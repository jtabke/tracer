import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationModelFixture,
  assessmentOpenRequest,
  assessmentCommand as command,
  dispositionProposal as proposal,
} from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: dispositions close a complete scope, retain historical completion and explicitly reopen after drift`, async () => {
    const f = await applicationModelFixture(domain);
    try {
      const opening = await assessmentOpenRequest(f);
      await f.tracer.changeAssessments.open(opening, actor);
      const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId };
      const early = await command(f, selection);
      await assert.rejects(f.tracer.changeAssessments.close(early, actor), { code: "conflict" });
      assert.equal(await f.tracer.evaluations.getOutcome(early.commandId), null);
      const request = await proposal(f, selection, { kind: "entity", id: f.criterion.id });
      const judgment = await f.tracer.changeAssessments.setDisposition(request, actor);
      assert.equal(judgment.native?.results.length, 3);
      assert.equal(
        (await f.tracer.changeAssessments.analyze(selection)).obligations[0].state,
        "accounted",
      );
      const closing = await command(f, selection),
        closed = await f.tracer.changeAssessments.close(closing, actor);
      assert.equal(
        (await f.tracer.changeAssessments.analyze(selection)).completion.state,
        "completed",
      );
      assert.equal(
        (await f.tracer.evidence.compareReceipt(closed.receipt.id)).state,
        "changed",
        "Prior-state provenance is distinct from application completion",
      );
      await assert.rejects(
        f.tracer.changeAssessments.setDisposition(
          await proposal(f, selection, request.subject),
          actor,
        ),
        { code: "conflict" },
      );
      await f.tracer.updateEntity(
        f.criterion.id,
        1,
        { fields: { ...f.criterion.fields, [f.model.threshold]: f.model.value + 1 } },
        2,
        actor,
      );
      const stale = await f.tracer.changeAssessments.analyze(selection);
      assert.equal(stale.completion.state, "needs_reassessment");
      assert.equal(stale.obligations[0].state, "stale_basis");
      const saved = await f.tracer.exportProject();
      f.base.reopen();
      assert.deepEqual(await f.tracer.changeAssessments.close(closing, actor), closed);
      assert.deepEqual(await f.tracer.evaluations.getOutcome(request.commandId), judgment);
      assert.deepEqual(await f.tracer.exportProject(), saved);
      await f.tracer.changeAssessments.reopen(await command(f, selection), actor);
      assert.equal((await f.tracer.changeAssessments.analyze(selection)).completion.state, "open");
      await f.tracer.changeAssessments.setDisposition(
        await proposal(f, selection, { kind: "entity", id: f.criterion.id }),
        actor,
      );
      await f.tracer.changeAssessments.close(await command(f, selection), actor);
      assert.equal(
        (await f.tracer.changeAssessments.analyze(selection)).completion.state,
        "completed",
      );
      assert.deepEqual(await f.tracer.evaluations.getOutcome(closing.commandId), closed);
    } finally {
      f.close();
    }
  });

test("reverification requires explicit related current results, retains action identities and refreshes new population", async () => {
  const f = await applicationModelFixture();
  try {
    const opening = await assessmentOpenRequest(f);
    await f.tracer.changeAssessments.open(opening, actor);
    const selection = { assessmentId: opening.assessmentId, openingCommandId: opening.commandId },
      subject = { kind: "entity" as const, id: f.criterion.id };
    const initial = await proposal(f, selection, subject);
    initial.decision = "reverify";
    initial.actions = [
      {
        id: "repeat",
        kind: "reverify",
        title: "Repeat declared criterion check",
        state: "open",
        resolution: "",
        support: [],
      },
    ];
    await f.tracer.changeAssessments.setDisposition(initial, actor);
    assert.equal(
      (await f.tracer.changeAssessments.analyze(selection)).obligations[0].state,
      "open_actions",
    );
    await assert.rejects(f.tracer.changeAssessments.close(await command(f, selection), actor), {
      code: "conflict",
    });
    const bad = await proposal(f, selection, subject);
    bad.decision = "reverify";
    bad.actions = [];
    await assert.rejects(f.tracer.changeAssessments.setDisposition(bad, actor), {
      code: "validation",
    });
    const result = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome:
          "SIMULATED current reevaluation using declared criterion; no real product verification",
        inputs: [{ entityId: f.criterion.id, facet: "native", fields: [f.model.threshold] }],
      },
      actor,
    );
    const done = await proposal(f, selection, subject);
    done.decision = "reverify";
    done.actions = [
      {
        ...initial.actions[0],
        state: "done",
        resolution: "Synthetic declared check rerun and recorded",
        support: [{ kind: "receipt", id: result.id, mode: "current" }],
      },
    ];
    await f.tracer.changeAssessments.setDisposition(done, actor);
    assert.equal((await f.tracer.changeAssessments.analyze(selection)).discovery, "changed");
    await assert.rejects(f.tracer.changeAssessments.close(await command(f, selection), actor), {
      code: "conflict",
    });
    await f.tracer.changeAssessments.refresh(await command(f, selection), actor);
    for (const obligation of (await f.tracer.changeAssessments.analyze(selection)).obligations)
      if (obligation.state === "undisposed")
        await f.tracer.changeAssessments.setDisposition(
          await proposal(f, selection, obligation.subject),
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
