import { useState } from "react";
import type {
  VerificationChoice,
  VerificationAccounting,
} from "../../src/core/verification-lifecycle.ts";
import type { VerificationEditorProps } from "./common.ts";
import {
  verificationCommand,
  samePreparation,
  executionName,
  useRecoveredVerification,
} from "./common.ts";
import { useApplicationDirty } from "../application-choices.tsx";
type AccountingDraft = {
  executionId: string;
  decision: VerificationAccounting["decision"] | "";
  rationale: string;
  replacementId?: string;
};
export function VerificationResultsEditor({
  analysis,
  entities,
  editing,
  ready,
  saved,
  onDirty,
}: VerificationEditorProps) {
  const [captured, setCaptured] = useState(analysis),
    [choices, setChoices] = useState<VerificationChoice[]>(
      analysis.recordedSelection?.selections ?? [],
    ),
    [entries, setEntries] = useState<AccountingDraft[]>(() =>
      analysis.executions.map(
        (x) =>
          analysis.recordedSelection?.accounting.find((a) => a.executionId === x.id) ?? {
            executionId: x.id,
            decision: "",
            rationale: "",
            replacementId: undefined,
          },
      ),
    ),
    [reason, setReason] = useState(""),
    [attempt, setAttempt] = useState<string>();
  const stale = !samePreparation(captured, analysis),
    used = new Set(choices.map((x) => x.executionId)),
    current = ready && !editing.busy && !stale;
  useApplicationDirty(true, onDirty);
  useRecoveredVerification(attempt, captured.view.case.id, editing, 0, saved);
  function reprepare() {
    setCaptured(analysis);
    setEntries(
      analysis.executions.map(
        (x) =>
          entries.find((a) => a.executionId === x.id) ?? {
            executionId: x.id,
            decision: "",
            rationale: "",
            replacementId: undefined,
          },
      ),
    );
  }
  async function submit() {
    if (!current) return;
    const request = {
      ...verificationCommand(captured, reason),
      selections: choices,
      accounting: entries.map((x) => ({
        executionId: x.executionId,
        decision: used.has(x.executionId) ? "selected" : x.decision,
        rationale: x.rationale,
        ...(!used.has(x.executionId) && x.decision === "superseded"
          ? { replacementId: x.replacementId }
          : {}),
      })) as VerificationAccounting[],
    };
    setAttempt(request.commandId);
    if (await editing.mutate("/api/verifications/select", request)) {
      setAttempt(undefined);
      saved();
    }
  }
  return (
    <form
      aria-label="Select verification results"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h4>Select results and account for every activity</h4>
      {stale && (
        <p role="alert">
          The population or current evidence changed. Draft choices and rationale are retained.
          Inspect current obligations, then{" "}
          <button type="button" disabled={!ready || editing.busy} onClick={reprepare}>
            Reprepare result selection
          </button>
        </p>
      )}
      <fieldset disabled={!current}>
        <p>
          Choose the activity supporting each obligation, then explain every selected, historical or
          superseded activity. A newly recorded failure cannot be silently ignored.
        </p>
        {captured.obligations.map((o) => (
          <label key={JSON.stringify([o.criterionId, o.methodId])}>
            {o.criterionId} ·{" "}
            {captured.view.scope.basis.methods.find((x) => x.entityId === o.methodId)?.title}
            <select
              aria-label={`Result for ${o.criterionId} ${o.methodId}`}
              value={
                choices.find((x) => x.criterionId === o.criterionId && x.methodId === o.methodId)
                  ?.executionId ?? ""
              }
              onChange={(e) =>
                setChoices([
                  ...choices.filter(
                    (x) => x.criterionId !== o.criterionId || x.methodId !== o.methodId,
                  ),
                  ...(e.target.value
                    ? [
                        {
                          criterionId: o.criterionId,
                          methodId: o.methodId,
                          executionId: e.target.value,
                        },
                      ]
                    : []),
                ])
              }
            >
              <option value="">Leave obligation unselected</option>
              {captured.executions
                .filter((x) => x.methodId === o.methodId)
                .map((x) => (
                  <option
                    key={x.id}
                    value={x.id}
                    disabled={!x.eligibleCriterionIds.includes(o.criterionId)}
                  >
                    {executionName(captured, x.id, entities)} ·{" "}
                    {x.results.find((r) => r.currentCriterionId === o.criterionId)?.outcome ??
                      "different basis"}
                  </option>
                ))}
            </select>
          </label>
        ))}
        {entries.map((entry, i) => {
          const activity = captured.executions.find((x) => x.id === entry.executionId)!;
          const selected = used.has(entry.executionId),
            decision = entry.decision === "selected" ? "" : entry.decision;
          return (
            <fieldset key={entry.executionId}>
              <legend>{executionName(captured, entry.executionId, entities)}</legend>
              <p>
                {activity.results
                  .map((x) => `${x.currentCriterionId ?? x.criterionId}: ${x.outcome}`)
                  .join(" · ")}{" "}
                ·{" "}
                {activity.support.unknown
                  ? "Unknown support"
                  : activity.support.changed
                    ? "Changed support"
                    : "No unassessed support change"}
              </p>
              {selected ? (
                <p>Selected for an obligation above.</p>
              ) : (
                <label>
                  Activity accounting
                  <select
                    aria-label={`Accounting for ${entry.executionId}`}
                    required
                    value={decision}
                    onChange={(e) =>
                      setEntries(
                        entries.map((x, n) =>
                          n === i ? { ...x, decision: e.target.value as typeof x.decision } : x,
                        ),
                      )
                    }
                  >
                    <option value="">Account for this activity</option>
                    <option value="historical">Retain as historical context</option>
                    <option value="superseded">Superseded by a selected activity</option>
                  </select>
                </label>
              )}
              {!selected && decision === "superseded" && (
                <label>
                  Selected replacement
                  <select
                    aria-label={`Replacement for ${entry.executionId}`}
                    required
                    value={entry.replacementId ?? ""}
                    onChange={(e) =>
                      setEntries(
                        entries.map((x, n) =>
                          n === i ? { ...x, replacementId: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    <option value="">Choose replacement</option>
                    {captured.executions
                      .filter((x) => used.has(x.id) && x.methodId === activity.methodId)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {executionName(captured, x.id, entities)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Accounting rationale
                <textarea
                  aria-label={`Rationale for ${entry.executionId}`}
                  required
                  value={entry.rationale}
                  onChange={(e) =>
                    setEntries(
                      entries.map((x, n) => (n === i ? { ...x, rationale: e.target.value } : x)),
                    )
                  }
                />
              </label>
            </fieldset>
          );
        })}
        <label>
          Selection reason
          <textarea
            aria-label="Selection reason"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button type="submit">Save result selection</button>
        <p>
          Selection records judgment and current state. It does not itself conclude verification.
        </p>
      </fieldset>
    </form>
  );
}
