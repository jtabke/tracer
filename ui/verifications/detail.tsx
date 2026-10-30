import { useState, type Dispatch, type SetStateAction } from "react";
import type { VerificationAnalysis } from "../../src/core/verification-lifecycle.ts";
import type { VerificationEditorProps } from "./common.ts";
import { verificationCommand, executionName, useRecoveredVerification } from "./common.ts";
import { VerificationExecutionEditor } from "./execution.tsx";
import { VerificationResultsEditor } from "./results.tsx";
import { VerificationBasisEditor } from "./basis.tsx";
import { ExecutionInspection } from "./inspection.tsx";
import { EvidenceReviewStage } from "../evidence-review-stage.tsx";
import { useApplicationDirty } from "../application-choices.tsx";
import { RecordedVerificationContext } from "./context.tsx";
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
  function showSection(name: string) {
    const section = document.getElementById(`verification-${name}`);
    if (!section) return;
    const context = section.parentElement?.querySelector<HTMLElement>(".verification-context");
    if (context) {
      const top = Number.parseFloat(getComputedStyle(context).top) || 0;
      section.style.scrollMarginTop = `${top + context.getBoundingClientRect().height + 12}px`;
    }
    section.scrollIntoView({ block: "start" });
    section.focus({ preventScroll: true });
  }
  return (
    <section aria-label="Verification detail">
      <RecordedVerificationContext
        analysis={analysis}
        entities={entities}
        editing={editing}
        epoch={epoch}
      />
      <h3>{analysis.view.case.title}</h3>
      <VerificationSummary analysis={analysis} />
      <nav className="verification-section-navigation" aria-label="Verification sections">
        <button type="button" onClick={() => showSection("criteria")}>
          Criteria
        </button>
        <button type="button" onClick={() => showSection("results")}>
          Results
        </button>
        <button type="button" onClick={() => showSection("evidence")}>
          Supporting evidence
        </button>
      </nav>
      <section
        className="verification-detail-section"
        id="verification-criteria"
        tabIndex={-1}
        aria-label="Verification criteria"
      >
        <h3>Criteria</h3>
        <VerificationObligations analysis={analysis} />
      </section>
      <section
        className="verification-detail-section"
        id="verification-results"
        tabIndex={-1}
        aria-label="Verification results"
      >
        <h3>Results</h3>
        <VerificationActivities
          analysis={analysis}
          entities={entities}
          blocked={Boolean(analysis.view.scope.target && review.dirty)}
          onInspect={(id) => {
            setInspect(id);
            requestAnimationFrame(() => showSection("evidence"));
          }}
        />
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
      <section
        className="verification-detail-section"
        id="verification-evidence"
        tabIndex={-1}
        aria-label="Supporting evidence"
      >
        <h3>Supporting evidence</h3>
        {!inspect && !review.receiptId && (
          <p>
            Select a recorded activity in Results to inspect its exact captured inputs, observations
            and applicability. Evidence review does not change the recorded outcome.
          </p>
        )}
        {inspect && (
          <ExecutionInspection
            analysis={analysis}
            executionId={inspect}
            epoch={epoch}
            editing={editing}
            reviewBlocked={!current || dirty}
            changed={changed}
            onTargetDirty={(dirty) => setReview((previous) => ({ ...previous, dirty }))}
            onReview={(receiptId) =>
              setReview((previous) => ({ ...previous, receiptId, active: true }))
            }
          />
        )}
        <ActivityInputReview
          analysis={analysis}
          review={review}
          setReview={setReview}
          epoch={epoch}
          editing={editing}
          current={current}
          dirty={dirty}
          changed={changed}
        />
      </section>
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
  const { dirty, reason, attempt } = draft;
  const update = (patch: Partial<typeof draft>) =>
    setDraft((previous) => ({ ...previous, ...patch }));
  const closed = analysis.view.case.state === analysis.view.model.definition.states.closed,
    current = ready && !editing.busy && analysis.view.model.compatibility.writable;
  useApplicationDirty(dirty || !!reason || review.dirty, onDirty);
  useRecoveredVerification(attempt, analysis.view.case.id, editing, epoch, () => {
    update({ reason: "" });
    changed();
  });
  function choose(editor: typeof draft.editor) {
    if (editing.busy || review.dirty) return;
    if (dirty && !window.confirm("Discard the current verification editor draft?")) return;
    update({ dirty: false, editor });
  }
  function saved() {
    update({ dirty: false, editor: undefined });
    changed();
  }
  async function transition() {
    if (!current || dirty || review.dirty || !reason.trim()) return;
    const request = verificationCommand(analysis, reason);
    update({ attempt: request.commandId });
    const result = closed
      ? await editing.mutate("/api/verifications/reopen", request)
      : await editing.mutate("/api/verifications/conclude", request);
    if (result) {
      update({ attempt: undefined, reason: "" });
      changed();
    }
  }
  const props = {
    analysis,
    entities,
    editing,
    ready: current && !closed,
    saved,
    onDirty: (dirty: boolean) => update({ dirty }),
  };
  return {
    ...draft,
    review,
    setReview,
    setReason: (reason: string) => update({ reason }),
    setInspect: (inspect: string) => update({ inspect }),
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
      {a.view.scope.target ? (
        <p>
          Selected configuration: {a.view.scope.target.configurationId} ·{" "}
          {a.view.scope.target.policy}. Live engineering changes do not rebase this target.
        </p>
      ) : (
        <p>Engineering context: current project head.</p>
      )}
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
  blocked,
}: {
  blocked: boolean;
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
            <button type="button" disabled={blocked} onClick={() => onInspect(x.id)}>
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

type ActivityReviewState = { receiptId: string; active: boolean; dirty: boolean };
function ActivityInputReview({
  analysis,
  review,
  setReview,
  epoch,
  editing,
  current,
  dirty,
  changed,
}: {
  analysis: VerificationAnalysis;
  review: ActivityReviewState;
  setReview: Dispatch<SetStateAction<ActivityReviewState>>;
  epoch: number;
  editing: VerificationEditorProps["editing"];
  current: boolean;
  dirty: boolean;
  changed(): void;
}) {
  if (!review.receiptId || analysis.view.scope.target) return null;
  return (
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
  );
}
