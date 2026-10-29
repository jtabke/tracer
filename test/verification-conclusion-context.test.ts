import test from "node:test";
import assert from "node:assert/strict";
import {
  verificationFixture,
  verificationActor as actor,
  verificationOpening,
  verificationExecution,
  verificationResults,
  verificationMutation,
  verificationTargetInput,
} from "./verification-fixture.ts";
import { analyzeVerificationConclusion } from "../src/application/verification-analysis.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: exact conclusion analysis authenticates the historical control context and reuses target applicability rules`, async () => {
    const f = await verificationFixture(domain);
    try {
      const target = await f.tracer.configurations.captureExact(
        await verificationTargetInput(f),
        actor,
      );
      const opening = await verificationOpening(f);
      opening.targetConfigurationId = target.id;
      await f.tracer.verification.open(opening, actor);
      const selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
      const activity = await verificationExecution(f, selection),
        executed = await f.tracer.verification.recordExecution(activity, actor);
      await f.tracer.verification.selectResults(
        await verificationResults(f, selection, activity.executionId),
        actor,
      );
      const conclusion = await f.tracer.verification.conclude(
        await verificationMutation(f, selection),
        actor,
      );
      const archived = await f.repository.transaction((tx) =>
        analyzeVerificationConclusion(tx, conclusion.receipt.id),
      );
      assert.equal(archived.context.source, "recorded_conclusion");
      assert.equal(archived.analysis.completion.state, "verified");
      assert.equal(archived.analysis.view.control.receiptId, conclusion.receipt.id);
      assert.deepEqual(
        archived.analysis.recordedConclusion,
        (await f.tracer.verification.analyze(selection)).recordedConclusion,
      );
      await f.tracer.verification.reopen(await verificationMutation(f, selection), actor);
      const later = await verificationExecution(f, selection);
      later.results = later.results.map((x) => ({ ...x, outcome: "failed" }));
      await f.tracer.verification.recordExecution(later, actor);
      await f.tracer.updateEntity(
        f.requirement.id,
        1,
        {
          fields: {
            ...f.requirement.fields,
            [f.definition.requirement.fields.statement]: "Later live statement",
          },
        },
        1,
        actor,
      );
      const snapshot = await f.tracer.exportProject();
      const original = await f.repository.transaction((tx) =>
        analyzeVerificationConclusion(tx, conclusion.receipt.id),
      );
      assert.equal(
        original.analysis.completion.state,
        "verified",
        "Historical read does not adopt later case execution population or live engineering states",
      );
      assert.equal(original.analysis.view.case.version, archived.analysis.view.case.version);
      assert.equal(original.analysis.executions.length, 1);
      assert.deepEqual(original.analysis.recordedConclusion, archived.analysis.recordedConclusion);
      assert.equal((await f.tracer.verification.analyze(selection)).executions.length, 2);
      await assert.rejects(
        f.repository.transaction((tx) => analyzeVerificationConclusion(tx, executed.receipt.id)),
        { code: "validation" },
      );
      assert.deepEqual(await f.tracer.exportProject(), snapshot);
      f.reopen();
      assert.equal(
        (
          await f.repository.transaction((tx) =>
            analyzeVerificationConclusion(tx, conclusion.receipt.id),
          )
        ).analysis.completion.state,
        "verified",
      );
    } finally {
      f.close();
    }
  });
