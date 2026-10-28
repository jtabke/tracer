import { useState } from "react";
import type { VerificationAnalysis } from "../../src/core/verification-lifecycle.ts";
import type { VerificationEditorProps } from "./common.ts";
import { verificationCommand, executionName, useRecoveredVerification } from "./common.ts";
import { VerificationExecutionEditor } from "./execution.tsx";
import { VerificationResultsEditor } from "./results.tsx";
import { VerificationBasisEditor } from "./basis.tsx";
import { ExecutionInspection } from "./inspection.tsx";
import { EvidenceReviewStage } from "../evidence-review-stage.tsx";
import { useApplicationDirty } from "../application-choices.tsx";
type DetailProps = Omit<VerificationEditorProps, "saved"> & { epoch: number; changed(): void };
export function VerificationDetail({
  analysis,
  entities,
  editing,
  ready,
  epoch,
  changed,
  onDirty,
}: DetailProps) {
  const {
    review,
    setReview,
    editor,
    dirty,
    reason,
    inspect,
    setReason,
    setInspect,
    current,
    closed,
    choose,
    transition,
    props,
  } = useVerificationDetail({ analysis, entities, editing, ready, epoch, changed, onDirty });
  return (
    <section aria-label="Verification detail">
      <h3>{analysis.view.case.title}</h3>
      <VerificationSummary analysis={analysis} />
      <VerificationObligations analysis={analysis} />
      <VerificationActivities analysis={analysis} entities={entities} onInspect={setInspect} />
      {inspect && (
        <ExecutionInspection
          analysis={analysis}
          executionId={inspect}
          epoch={epoch}
          editing={editing}
          reviewBlocked={!current || dirty}
          onReview={(receiptId) =>
            setReview((previous) => ({ ...previous, receiptId, active: true }))
          }
        />
      )}
      {review.receiptId && (
        <>
          <p>
            Reviewing inputs judges applicability; it does not change recorded outcomes or verify
            changed governing criteria. The pinned project policy controls whether assessed design
            changes can support a conclusion.
          </p>
          {!review.active && (
            <button onClick={() => setReview((previous) => ({ ...previous, active: true }))}>
              Return to activity input review
            </button>
          )}
          <EvidenceReviewStage
            receiptId={review.receiptId}
            active={review.active}
            epoch={epoch + editing.epoch}
            busy={!current || dirty}
            changed={changed}
            mutate={editing.mutate}
            report={editing.report}
            returnLabel="Return to verification activity"
            onReturn={() => setReview((previous) => ({ ...previous, active: false }))}
            onDraftChange={(dirty) => setReview((previous) => ({ ...previous, dirty }))}
            onReceiptChangeBlocked={(receiptId) =>
              setReview((previous) => ({ ...previous, receiptId }))
            }
          />
        </>
      )}
      {review.dirty && (
        <p role="status">
          Save or discard the retained input review before authoring or concluding verification.
        </p>
      )}
      {!closed && (
        <div>
          <button disabled={!current || review.dirty} onClick={() => choose("activity")}>
            Record activity
          </button>
          <button
            disabled={!current || review.dirty || !analysis.executions.length}
            onClick={() => choose("results")}
          >
            Choose results
          </button>
          <button disabled={!current || review.dirty} onClick={() => choose("basis")}>
            Revise basis
          </button>
        </div>
      )}
      {editor && (
        <button disabled={editing.busy} onClick={() => choose(undefined)}>
          Cancel editor
        </button>
      )}
      <VerificationEditor mode={editor} editorProps={props} epoch={epoch} />
      <VerificationLifecycle
        analysis={analysis}
        reason={reason}
        setReason={setReason}
        blocked={!current}
        dirty={dirty || review.dirty}
        transition={transition}
        busy={editing.busy}
      />
    </section>
  );
}
function useVerificationDetail({
  analysis,
  entities,
  editing,
  ready,
  epoch,
  changed,
  onDirty,
}: DetailProps) {
  const [draft, setDraft] = useState<{
    editor?: "activity" | "results" | "basis";
    dirty: boolean;
    reason: string;
    inspect: string;
    attempt?: string;
  }>({ dirty: false, reason: "", inspect: "" });
  const [review, setReview] = useState({ receiptId: "", active: false, dirty: false });
  const { editor, dirty, reason, inspect, attempt } = draft;
  const setEditor = (value: "activity" | "results" | "basis" | undefined) =>
    setDraft((previous) => ({ ...previous, editor: value }));
  const setDirty = (value: boolean) => setDraft((previous) => ({ ...previous, dirty: value }));
  const setReason = (value: string) => setDraft((previous) => ({ ...previous, reason: value }));
  const setInspect = (value: string) => setDraft((previous) => ({ ...previous, inspect: value }));
  const setAttempt = (value: string | undefined) =>
    setDraft((previous) => ({ ...previous, attempt: value }));
  const closed = analysis.view.case.state === analysis.view.model.definition.states.closed,
    current = ready && !editing.busy && analysis.view.model.compatibility.writable;
  useApplicationDirty(dirty || !!reason || review.dirty, onDirty);
  useRecoveredVerification(attempt, analysis.view.case.id, editing, epoch, () => {
    setReason("");
    changed();
  });
  function choose(value: typeof editor) {
    if (editing.busy || review.dirty) return;
    if (dirty && !window.confirm("Discard the current verification editor draft?")) return;
    setDirty(false);
    setEditor(value);
  }
  function saved() {
    setDirty(false);
    setEditor(undefined);
    changed();
  }
  async function transition() {
    if (!current || dirty || review.dirty || !reason.trim()) return;
    const request = verificationCommand(analysis, reason);
    setAttempt(request.commandId);
    const result = closed
      ? await editing.mutate("/api/verifications/reopen", request)
      : await editing.mutate("/api/verifications/conclude", request);
    if (result) {
      setAttempt(undefined);
      setReason("");
      changed();
    }
  }
  const props = {
    analysis,
    entities,
    editing,
    ready: current && !closed,
    saved,
    onDirty: setDirty,
  };
  return {
    review,
    setReview,
    editor,
    dirty,
    reason,
    inspect,
    setReason,
    setInspect,
    current,
    closed,
    choose,
    transition,
    props,
  };
}
function VerificationSummary({ analysis: a }: { analysis: VerificationAnalysis }) {
  const text = {
    open: "Open verification",
    verified: "Verified for this declared scope",
    needs_reassessment: "Needs reassessment",
  }[a.completion.state];
  return (
    <section aria-label="Verification status">
      <h4>{text}</h4>
      <p>{a.view.scope.purpose}</p>
      <p>
        Requirement {a.view.scope.basis.requirement.title} · declared v
        {a.view.scope.basis.requirement.version} · Governing basis: {a.basis.state}
      </p>
      <p>
        Source coverage: {a.view.scope.basis.coverage.kind} · Unassigned criteria:{" "}
        {a.view.scope.basis.coverage.unassignedCriterionIds.length} · Result selection:{" "}
        {a.selection.state}
      </p>
      <p>Unassessed activities: {a.selection.unassessedExecutionIds.length}</p>
      {a.blockers.length > 0 && (
        <>
          <h5>Before current verification can conclude</h5>
          <ul>
            {a.blockers.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      )}
      {a.ready && a.completion.state === "open" && (
        <p>
          All declared obligations have applicable passing results. An explicit conclusion is still
          required.
        </p>
      )}
      {a.recordedConclusion && (
        <p>
          Recorded conclusion retained from native revision{" "}
          {a.recordedConclusion.at.projectRevision + 1}. Historical outcomes remain unchanged when
          current applicability changes.
        </p>
      )}
      <small>
        This is scoped verification, not release approval, representative-user validation or a
        global status inferred across independent cases.
      </small>
    </section>
  );
}
function VerificationObligations({ analysis }: { analysis: VerificationAnalysis }) {
  return (
    <>
      {" "}
      <h4>Criterion obligations</h4>
      <ol aria-label="Verification obligations">
        {analysis.obligations.map((o) => (
          <li key={JSON.stringify([o.criterionId, o.methodId])}>
            <strong>
              {o.criterionId} ·{" "}
              {analysis.view.scope.basis.methods.find((x) => x.entityId === o.methodId)?.title}
            </strong>
            <blockquote>
              {analysis.view.scope.basis.criteria.find((x) => x.id === o.criterionId)?.quote}
            </blockquote>
            <p>
              Outcome:{" "}
              {o.outcome
                ? analysis.view.model.definition.outcomes[o.outcome]
                : "No selected result"}{" "}
              · Applicability: {o.applicability}
            </p>
            {o.reasons.map((x) => (
              <p key={x}>{x}</p>
            ))}
          </li>
        ))}
      </ol>
    </>
  );
}
function VerificationActivities({
  analysis,
  entities,
  onInspect,
}: {
  analysis: VerificationAnalysis;
  entities: VerificationEditorProps["entities"];
  onInspect(id: string): void;
}) {
  return (
    <>
      {" "}
      <h4>Recorded activities · {analysis.executions.length}</h4>
      <ul aria-label="Verification activities">
        {analysis.executions.map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => onInspect(x.id)}>
              {executionName(analysis, x.id, entities)}
            </button>
            <span>
              {x.results
                .map(
                  (r) => `${r.criterionId}: ${analysis.view.model.definition.outcomes[r.outcome]}`,
                )
                .join(" · ")}
            </span>
            <p>
              {analysis.recordedSelection?.accounting.find((a) => a.executionId === x.id)
                ?.decision ?? "Unassessed activity"}{" "}
              ·{" "}
              {x.support.unknown
                ? "Unknown support"
                : x.support.changed
                  ? "Changed support"
                  : "No unassessed support change"}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

function VerificationLifecycle({
  analysis,
  reason,
  setReason,
  blocked,
  dirty,
  transition,
  busy,
}: {
  analysis: VerificationAnalysis;
  reason: string;
  setReason(value: string): void;
  blocked: boolean;
  dirty: boolean;
  transition(): Promise<void>;
  busy: boolean;
}) {
  const closed = analysis.view.case.state === analysis.view.model.definition.states.closed;
  return (
    <section aria-label="Verification lifecycle">
      <h4>{closed ? "Reassess this conclusion" : "Conclude the declared scope"}</h4>
      <label>
        Verification operation reason
        <textarea
          aria-label="Verification operation reason"
          value={reason}
          disabled={busy}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button
        disabled={blocked || dirty || !reason.trim() || (!closed && !analysis.ready)}
        onClick={() => void transition()}
      >
        {closed ? "Reopen verification" : "Conclude verification"}
      </button>
      {dirty && <p>Save or explicitly discard the current editor before a lifecycle operation.</p>}
    </section>
  );
}

function VerificationEditor({
  mode,
  editorProps: props,
  epoch,
}: {
  mode: "activity" | "results" | "basis" | undefined;
  editorProps: VerificationEditorProps;
  epoch: number;
}) {
  switch (mode) {
    case "activity":
      return <VerificationExecutionEditor {...props} />;
    case "results":
      return <VerificationResultsEditor {...props} />;
    case "basis":
      return (
        <VerificationBasisEditor
          entities={props.entities}
          editing={props.editing}
          epoch={epoch}
          revision={props.analysis}
          onDirty={props.onDirty}
          ready={props.ready}
          saved={() => props.saved()}
        />
      );
    default:
      return null;
  }
}
