import { useState } from "react";
import type { VerificationTargetSupport } from "../../src/core/verification-case.ts";
import type { VerificationAnalysis } from "../../src/core/verification-lifecycle.ts";
import type { ReviewInput, ComparedState } from "../../src/core/evidence.ts";
import type { Editing } from "../editing.ts";
import { useApplicationDirty } from "../application-choices.tsx";
import { samePreparation, verificationCommand, useRecoveredVerification } from "./common.ts";
import { label } from "../entity-label.ts";
type Layer = VerificationTargetSupport["layers"][number];

export function VerificationTargetReview({
  support,
  analysis,
  executionId,
  editing,
  ready,
  changed,
  onDirty,
}: {
  support: VerificationTargetSupport;
  analysis: VerificationAnalysis;
  executionId: string;
  editing: Editing;
  ready: boolean;
  changed(): void;
  onDirty(value: boolean): void;
}) {
  const [drafts, setDrafts] = useState<Record<string, boolean>>({});
  useApplicationDirty(Object.values(drafts).some(Boolean), onDirty);
  return (
    <section aria-label="Target verification support">
      <h4>Support for selected target</h4>
      <p>
        {support.target.configurationId} · {support.target.policy}. These comparisons use the
        selected configuration, not the live project head.
      </p>
      {support.layers.map((layer, index) => (
        <details key={layer.receiptId}>
          <summary>
            Target support layer {index + 1} · {layer.comparison.state} · judgment{" "}
            {layer.review.state}
          </summary>
          <p>
            Receipt {layer.receiptId}
            {layer.nextSourceReceiptId && ` · original source ${layer.nextSourceReceiptId}`}
          </p>
          {layer.review.previous && (
            <p>
              Previous judgment retained: {layer.review.previous.decision}; it does not apply to
              this current qualified context.
            </p>
          )}
          <TargetInputFacts value={layer.comparison} />
          <TargetReviewForm
            layer={layer}
            analysis={analysis}
            executionId={executionId}
            editing={editing}
            ready={ready}
            changed={changed}
            onDirty={(value) =>
              setDrafts((previous) =>
                previous[layer.receiptId] === value
                  ? previous
                  : { ...previous, [layer.receiptId]: value },
              )
            }
          />
        </details>
      ))}
      <p>
        A support judgment cannot change an original outcome, replace changed governing criteria or
        grant release approval. The pinned model controls whether assessed changes can support
        verification.
      </p>
    </section>
  );
}
function TargetReviewForm({
  layer,
  analysis,
  executionId,
  editing,
  ready,
  changed,
  onDirty,
}: {
  layer: Layer;
  analysis: VerificationAnalysis;
  executionId: string;
  editing: Editing;
  ready: boolean;
  changed(): void;
  onDirty(value: boolean): void;
}) {
  const [draft, setDraft] = useState<{
    captured: VerificationAnalysis;
    token: string;
    reason: string;
    decision: ReviewInput["decision"];
    attempt?: string;
  }>(() => ({
    captured: analysis,
    token: layer.token,
    reason: "",
    decision: "needs_reevaluation",
  }));
  const stale = !samePreparation(draft.captured, analysis) || draft.token !== layer.token;
  const closed = analysis.view.case.state === analysis.view.model.definition.states.closed;
  const dirty = Boolean(draft.reason || draft.decision !== "needs_reevaluation");
  useApplicationDirty(dirty, onDirty);
  function saved() {
    setDraft((previous) => ({
      ...previous,
      reason: "",
      decision: "needs_reevaluation",
      attempt: undefined,
    }));
    changed();
  }
  useRecoveredVerification(draft.attempt, analysis.view.case.id, editing, 0, saved);
  async function save() {
    if (!ready || editing.busy || closed || stale || !draft.reason.trim()) return;
    const request = {
      ...verificationCommand(draft.captured, draft.reason),
      executionId,
      receiptId: layer.receiptId,
      decision: draft.decision,
      expectedComparison: draft.token,
    };
    setDraft((previous) => ({ ...previous, attempt: request.commandId }));
    if (await editing.mutate("/api/verifications/review-support", request)) saved();
  }
  return (
    <form
      aria-label={`Review target support ${layer.receiptId}`}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {stale && (
        <p role="alert">
          The review context changed. Your judgment draft is retained; explicitly adopt the
          refreshed qualified context before saving.
        </p>
      )}
      <button
        type="button"
        disabled={!ready || editing.busy || closed}
        onClick={() =>
          setDraft((previous) => ({ ...previous, captured: analysis, token: layer.token }))
        }
      >
        Adopt target review context
      </button>
      <label>
        Target support decision
        <select
          aria-label="Target support decision"
          value={draft.decision}
          disabled={editing.busy || closed}
          onChange={(e) =>
            setDraft((previous) => ({
              ...previous,
              decision: e.target.value as ReviewInput["decision"],
            }))
          }
        >
          <option value="needs_reevaluation">Needs reevaluation</option>
          <option value="acknowledged">Acknowledge uncertainty or change</option>
          <option value="accepted">Accept applicability under pinned policy</option>
        </select>
      </label>
      <label>
        Target support rationale
        <textarea
          aria-label="Target support rationale"
          required
          maxLength={4000}
          disabled={editing.busy || closed}
          value={draft.reason}
          onChange={(e) => setDraft((previous) => ({ ...previous, reason: e.target.value }))}
        />
      </label>
      <button
        type="submit"
        disabled={!ready || editing.busy || closed || stale || !draft.reason.trim()}
      >
        Save target support judgment
      </button>
      <button
        type="button"
        disabled={editing.busy}
        onClick={() =>
          setDraft({
            captured: analysis,
            token: layer.token,
            reason: "",
            decision: "needs_reevaluation",
          })
        }
      >
        Discard target support draft
      </button>
      <details>
        <summary>Exact judgment namespace</summary>
        <pre>
          {JSON.stringify({ qualification: layer.qualification, token: layer.token }, null, 2)}
        </pre>
      </details>
    </form>
  );
}
function TargetInputFacts({ value }: { value: ComparedState }) {
  return (
    <section aria-label="Exact target input states">
      {value.inputs.map((input, index) => (
        <article key={index}>
          <h5>
            {label(input.recorded.entity)} · {input.state}
          </h5>
          <p>
            Captured native v{input.recorded.entity.version} → selected target native v
            {input.current.entity?.version ?? "unknown"}. Declared fields:{" "}
            {input.recorded.fields?.join(", ") ?? "whole native record"}.
          </p>
          {input.recorded.observation && (
            <p>
              Captured content {input.recorded.observation.hash ?? "unknown"} → selected target{" "}
              {input.current.observation?.hash ?? "unknown"} ·{" "}
              {input.current.observation?.availability ?? "unavailable"}.
            </p>
          )}
          {input.referenceUse && (
            <p>
              Reference {input.referenceUse.relationshipId} · {input.referenceUse.selection} ·
              resource default native v
              {input.referenceUse.resourceDefault.entity?.version ?? "unknown"} · default content{" "}
              {input.referenceUse.resourceDefault.observation?.hash ?? "unknown"} · passage{" "}
              {input.referenceUse.passage}.
            </p>
          )}
          <ul>
            {input.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
          <details>
            <summary>Captured and selected material states</summary>
            <pre>{JSON.stringify(input, null, 2)}</pre>
          </details>
        </article>
      ))}
      {value.relationshipInputs?.map((input) => (
        <p key={input.id}>
          Relationship {input.id} · captured v{input.recorded.relationship.version} → selected
          target v{input.current?.version ?? "unknown"} · {input.state}
        </p>
      ))}
    </section>
  );
}
