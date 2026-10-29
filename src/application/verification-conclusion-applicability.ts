import { ensure, TracerError } from "../core/model.ts";
import {
  parseVerificationScope,
  parseExecutionRegistry,
} from "../core/verification-case-validation.ts";
import type { VerificationCaseView } from "../core/verification-case.ts";
import type { analyzeVerificationConclusion } from "./verification-analysis.ts";
import { verificationContext, verificationCommand } from "./verification-context.ts";
import { pinEntity } from "./native-pins.ts";
import type { Transaction } from "./ports/repository.ts";
import type { verificationWorkBudget } from "./verification-support.ts";

async function relatedRevision(
  tx: Transaction,
  original: VerificationCaseView,
  revision: NonNullable<VerificationCaseView["scope"]["revisions"]>[number],
  account: (value: unknown) => void,
) {
  const selection = { caseId: original.case.id, openingCommandId: original.opening.commandId };
  const command = await verificationCommand(tx, revision.commandId, selection);
  ensure(
    command.operation === "verification.revise" &&
      command.input.expectedCaseVersion === revision.caseVersion,
    "conflict",
    "Verification target transition has no matching controlled origin",
  );
  const output = command.result.native?.results.find((x) => x.id === original.case.id);
  ensure(
    output &&
      "fields" in output &&
      !("source" in output) &&
      output.version === revision.caseVersion + 1,
    "storage",
    "Verification target transition has no exact case output",
  );
  account(output);
  const fields = original.model.definition.case.fields;
  const next = parseVerificationScope(output.fields[fields.basis]);
  if (next.target?.configurationId === original.scope.target!.configurationId) return true;
  const previous = (await pinEntity(tx, original.case.id, revision.caseVersion, true)).entity;
  account(previous);
  const prior = parseVerificationScope(previous.fields[fields.basis]);
  if (prior.target?.configurationId !== original.scope.target!.configurationId) return false;
  const oldIds = new Set(original.executions.map((x) => x.executionId));
  const entries = parseExecutionRegistry(previous.fields[fields.executions]);
  return (
    prior.reopened?.commandId !== original.control.commandId ||
    entries.some((x) => !oldIds.has(x.executionId))
  );
}

/** Same-target new work/reinterpretation retires current use; a clean move to another target does not rewrite the old proof. */
export async function verificationConclusionContinuation(
  tx: Transaction,
  original: Awaited<ReturnType<typeof analyzeVerificationConclusion>>,
  work: ReturnType<typeof verificationWorkBudget>,
) {
  try {
    const view = original.analysis.view;
    const live = await verificationContext(tx, {
      caseId: view.case.id,
      openingCommandId: view.opening.commandId,
    });
    work.account(live.entity);
    if (!live.view.scope.target) return { applicable: false, unknown: true };
    for (const revision of live.view.scope.revisions ?? [])
      if (
        revision.caseVersion >= view.case.version &&
        (await relatedRevision(tx, view, revision, work.account))
      )
        return { applicable: false, unknown: false };
    return {
      applicable:
        live.view.scope.target.configurationId !== view.scope.target!.configurationId ||
        live.view.control.commandId === view.control.commandId,
      unknown: false,
    };
  } catch (error) {
    if (error instanceof TracerError && ["conflict", "not_found"].includes(error.code))
      return { applicable: false, unknown: true };
    throw error;
  }
}
