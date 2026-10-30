import { useVerificationActivityTarget, VerificationTargetReadStatus } from "./activity-target.tsx";
import { useState } from "react";
import type { VerificationCriterionResult } from "../../src/core/verification-case.ts";
import type { VerificationEditorProps } from "./common.ts";
import { samePreparation, useRecoveredVerification } from "./common.ts";
import { AdditionalFields, useApplicationDirty } from "../application-choices.tsx";
import { fieldsFrom } from "../fields.tsx";
import { RecordedMaterialChoice } from "../recorded-material.tsx";
import type { RecordedMaterial } from "../recorded-material.tsx";
import { VerificationInputs } from "./inputs.tsx";
import type { VerificationSupportDraft } from "./inputs.tsx";
type ActivityDraft = {
  attempt?: string;
  methodId: string;
  title: string;
  conditions: string;
  prior: boolean;
  source?: RecordedMaterial;
  sourceReason: string;
  results: Record<string, Partial<VerificationCriterionResult>>;
  support: VerificationSupportDraft;
  extra: Record<string, string>;
};
export function VerificationExecutionEditor({
  analysis,
  entities,
  editing,
  ready,
  saved,
  onDirty,
}: VerificationEditorProps) {
  const [captured, setCaptured] = useState(analysis),
    [draft, setDraft] = useState<ActivityDraft>({
      methodId: "",
      title: "",
      conditions: "",
      prior: false,
      sourceReason: "",
      results: {},
      support: { inputs: [], relationshipInputs: [] },
      extra: {},
    }),
    [ids] = useState(() => ({
      executionId: crypto.randomUUID(),
      membershipId: crypto.randomUUID(),
    }));
  const {
    methodId,
    title,
    conditions,
    prior,
    source,
    sourceReason,
    results,
    support,
    extra,
    attempt,
  } = draft;
  function update(patch: Partial<ActivityDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }
  const target = useVerificationActivityTarget(captured, editing);
  const method = captured.view.scope.basis.methods.find((x) => x.entityId === methodId),
    stale = !samePreparation(captured, analysis),
    current = ready && !editing.busy && !stale && target.ready;
  useApplicationDirty(
    !!(
      title ||
      conditions ||
      sourceReason ||
      Object.keys(results).length ||
      support.inputs.length ||
      support.relationshipInputs.length ||
      Object.keys(extra).length
    ),
    onDirty,
  );
  useRecoveredVerification(attempt, ids.executionId, editing, 0, saved);
  async function submit() {
    if (!current || !method) return;
    try {
      const request = {
        caseId: captured.view.case.id,
        openingCommandId: captured.view.opening.commandId,
        commandId: crypto.randomUUID(),
        ...ids,
        title,
        methodId,
        conditions,
        source:
          prior && source && "output" in source
            ? { kind: "prior_receipt" as const, receiptId: source.id, rationale: sourceReason }
            : { kind: "performed" as const },
        results: method.criterionIds.map(
          (id) => ({ criterionId: id, ...results[id] }) as VerificationCriterionResult,
        ),
        ...support,
        additionalFields: fieldsFrom(extra, captured.view.model.requiredFields.execution ?? {}),
        expectedSchemaVersion: captured.view.model.context.schemaVersion,
        expectedProjectRevision: captured.view.model.context.projectRevision,
        expectedEvidenceRevision: captured.view.model.context.evidenceRevision,
        expectedCaseVersion: captured.view.case.version,
      };
      if (prior && (!source || !("output" in source)))
        throw Error("Choose the original recorded activity before attesting it.");
      update({ attempt: request.commandId });
      if (await editing.mutate("/api/verifications/execute", request)) {
        update({ attempt: undefined });
        saved();
      }
    } catch (error) {
      editing.report(error);
    }
  }
  return (
    <form
      aria-label="Record verification activity"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h4>Record an actual activity</h4>
      {stale && (
        <p role="alert">
          Current scope or evidence changed. Draft observations are retained. Inspect the new scope,
          then{" "}
          <button
            type="button"
            disabled={!ready || editing.busy}
            onClick={() => setCaptured(analysis)}
          >
            Reprepare activity
          </button>
        </p>
      )}
      <VerificationTargetReadStatus failed={target.failed} />
      <fieldset disabled={!current}>
        <label>
          Activity title
          <input
            aria-label="Activity title"
            required
            value={title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </label>
        <label>
          Verification method
          <select
            aria-label="Verification method"
            required
            value={methodId}
            onChange={(e) => update({ methodId: e.target.value })}
          >
            <option value="">Choose declared method</option>
            {captured.view.scope.basis.methods.map((x) => (
              <option key={x.entityId} value={x.entityId}>
                {x.title} · v{x.version}
              </option>
            ))}
          </select>
        </label>
        {method && (
          <>
            <p>{method.procedure}</p>
            <p>Expected: {method.expected}</p>
          </>
        )}
        <label>
          Activity source
          <select
            aria-label="Activity source"
            value={prior ? "prior" : "performed"}
            onChange={(e) => update({ prior: e.target.value === "prior" })}
          >
            <option value="performed">Record current activity and execution state</option>
            <option value="prior">Explicitly interpret an earlier recorded activity</option>
          </select>
        </label>
        <p>
          Record what actually happened. A not-run or blocked result does not claim that the method
          completed; explain its execution state in the conditions and observations.
        </p>
        {prior && (
          <>
            <RecordedMaterialChoice
              title="Original activity"
              kind="receipt"
              entities={entities}
              editing={editing}
              selected={source}
              onChoose={(source) => update({ source })}
            />
            <label>
              Original activity interpretation
              <textarea
                aria-label="Original activity interpretation"
                required
                value={sourceReason}
                onChange={(e) => update({ sourceReason: e.target.value })}
              />
            </label>
            <p>
              This records a later typed interpretation. Original actor, time, inputs and results
              remain historical; it does not claim a new execution.
            </p>
          </>
        )}
        <label>
          Execution conditions
          <textarea
            aria-label="Execution conditions"
            required
            value={conditions}
            onChange={(e) => update({ conditions: e.target.value })}
          />
        </label>
        <ActivityResults
          method={method}
          captured={captured}
          results={results}
          setResults={(results) => update({ results })}
        />
        <VerificationInputs
          target={target.retained}
          policy={captured.view.scope.target?.policy}
          entities={entities}
          editing={editing}
          value={support}
          onChange={(support) => update({ support })}
        />
        <AdditionalFields
          title="Activity"
          definitions={captured.view.model.requiredFields.execution}
          values={extra}
          onChange={(extra) => update({ extra })}
        />
        <p>
          Record only work actually performed or explicitly interpreted. No report text is parsed
          into a pass, and recording does not select results or conclude verification.
        </p>
        <button type="submit" disabled={!method}>
          Record activity
        </button>
      </fieldset>
    </form>
  );
}

function ActivityResults({
  method,
  captured,
  results,
  setResults,
}: {
  method:
    import("../../src/core/verification-basis.ts").VerificationBasis["methods"][number] | undefined;
  captured: import("../../src/core/verification-lifecycle.ts").VerificationAnalysis;
  results: Record<string, Partial<VerificationCriterionResult>>;
  setResults(value: Record<string, Partial<VerificationCriterionResult>>): void;
}) {
  if (!method) return null;
  const definition = captured.view.model.definition;
  return (
    <>
      {" "}
      {method.criterionIds.map((id) => (
        <fieldset key={id}>
          <legend>{id}</legend>
          <blockquote>
            {captured.view.scope.basis.criteria.find((x) => x.id === id)?.quote}
          </blockquote>
          <label>
            Recorded outcome
            <select
              aria-label={`${id} recorded outcome`}
              required
              value={results[id]?.outcome ?? ""}
              onChange={(e) =>
                setResults({
                  ...results,
                  [id]: {
                    ...results[id],
                    outcome: e.target.value as VerificationCriterionResult["outcome"],
                  },
                })
              }
            >
              <option value="">Choose actual outcome</option>
              {Object.entries(definition.outcomes).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Actual observations
            <textarea
              aria-label={`${id} actual observations`}
              required
              value={results[id]?.actual ?? ""}
              onChange={(e) =>
                setResults({ ...results, [id]: { ...results[id], actual: e.target.value } })
              }
            />
          </label>
          <label>
            Result rationale
            <textarea
              aria-label={`${id} result rationale`}
              required
              value={results[id]?.rationale ?? ""}
              onChange={(e) =>
                setResults({ ...results, [id]: { ...results[id], rationale: e.target.value } })
              }
            />
          </label>
        </fieldset>
      ))}
    </>
  );
}
