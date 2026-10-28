import type { Entity } from "../../src/core/model.ts";
import type { AssessmentAnalysis, CandidateKey } from "../../src/core/change-assessment.ts";
import { label } from "../entity-label.ts";
export function AssessmentSummary({
  analysis,
  entities,
}: {
  analysis: AssessmentAnalysis;
  entities: Entity[];
}) {
  return (
    <>
      {" "}
      <p role="status">
        {analysis.completion.state === "completed"
          ? "Scope accounted"
          : analysis.completion.state === "needs_reassessment"
            ? "Needs reassessment"
            : "Open assessment"}{" "}
        · {analysis.obligations.filter((item) => item.state === "accounted").length} of{" "}
        {analysis.obligations.length} candidates accounted
      </p>
      <p>
        Recorded state: {analysis.view.assessment.state} · v{analysis.view.assessment.version} ·
        model v{analysis.view.model.pin.version}
      </p>
      <p>{analysis.view.scope.purpose}</p>
      <details>
        <summary>Selected scope and provenance</summary>
        <p>
          Root:{" "}
          {label(
            entities.find((entity) => entity.id === analysis.view.scope.query.rootId) ?? {
              id: analysis.view.scope.query.rootId,
              type: "record",
              version: 1,
              fields: {},
            },
          )}{" "}
          · {analysis.view.scope.query.direction} · depth {analysis.view.scope.query.depth}
        </p>
        <p>
          {analysis.view.scope.query.relationshipTypes.length
            ? analysis.view.scope.query.relationshipTypes.join(", ")
            : "Root only"}{" "}
          · {analysis.view.scope.candidates.length} recorded candidates · discovery covers the
          selected traversal.
        </p>
        <p>
          Baseline {analysis.view.scope.query.baselineId} · captured native r
          {analysis.view.scope.basis.projectRevision} / evidence{" "}
          {analysis.view.scope.basis.evidenceRevision}
        </p>
        <p>
          Opening {analysis.view.opening.commandId} · current operation{" "}
          {analysis.view.control.commandId}
        </p>
      </details>
      <p>
        Discovery: {analysis.discovery}. {analysis.discoveryReason}
      </p>
      {!analysis.view.model.compatibility.writable && (
        <p role="alert">
          The pinned model is incompatible with the current schema. Reads remain available;
          application writes are paused.
        </p>
      )}
    </>
  );
}
export function AssessmentObligations({
  analysis,
  entities,
  subject,
  busy,
  choose,
}: {
  analysis: AssessmentAnalysis;
  entities: Entity[];
  subject: CandidateKey | undefined;
  busy: boolean;
  choose(subject: CandidateKey): void;
}) {
  return (
    <>
      {" "}
      <ol className="assessment-obligations" aria-label="Candidate obligations">
        {analysis.obligations.map((item) => (
          <li key={`${item.subject.kind}:${item.subject.id}`}>
            <button
              disabled={busy}
              aria-pressed={subject?.id === item.subject.id && subject?.kind === item.subject.kind}
              onClick={() => choose(item.subject)}
            >
              {item.label ??
                candidateName(item.subject, entities, analysis.obligations.indexOf(item))}{" "}
              · {item.state.replaceAll("_", " ")}
            </button>
            <span>
              {item.openActions} open actions{item.hasUnknown ? " · unknown basis" : ""}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
export function AssessmentLifecycle({
  analysis,
  reason,
  blocked,
  draftPending,
  busy,
  onReason,
  transition,
}: {
  analysis: AssessmentAnalysis;
  reason: string;
  blocked: boolean;
  draftPending: boolean;
  busy: boolean;
  onReason(value: string): void;
  transition(operation: "refresh" | "close" | "reopen"): Promise<void>;
}) {
  const canOperate = !blocked && Boolean(reason.trim());
  const isOpen = analysis.completion.state === "open";
  const accounted =
    analysis.discovery === "current" &&
    analysis.obligations.every((item) => item.state === "accounted");
  return (
    <>
      {" "}
      <section aria-label="Assessment lifecycle">
        <h4>Scope and completion</h4>
        <label>
          Reason
          <textarea
            aria-label="Assessment operation reason"
            maxLength={4000}
            value={reason}
            disabled={busy}
            onChange={(e) => onReason(e.target.value)}
          />
        </label>
        {draftPending && (
          <p role="status">Save or discard the candidate draft before changing the assessment.</p>
        )}
        <CompletionAccounting analysis={analysis} />
        <p>Completion accounts for this declared scope; it does not grant release approval.</p>
        <div className="assessment-buttons">
          <button disabled={!canOperate || !isOpen} onClick={() => void transition("refresh")}>
            Refresh selected scope
          </button>
          <button
            disabled={!canOperate || !isOpen || !accounted}
            onClick={() => void transition("close")}
          >
            Complete assessment
          </button>
          <button disabled={!canOperate || isOpen} onClick={() => void transition("reopen")}>
            Reopen for reassessment
          </button>
        </div>
      </section>
    </>
  );
}
function candidateName(subject: CandidateKey, entities: Entity[], index: number) {
  const entity = subject.kind === "entity" && entities.find((value) => value.id === subject.id);
  return entity
    ? label(entity)
    : `${subject.kind === "receipt" ? "Evaluation" : "Connection"} ${index + 1} · ${subject.id.slice(0, 8)}`;
}

function CompletionAccounting({ analysis }: { analysis: AssessmentAnalysis }) {
  const names = {
    undisposed: "Candidates needing a judgment",
    stale_basis: "Judgments needing reassessment of changed basis",
    unknown: "Candidates with unresolved unknown basis",
  };
  const reasons = Object.entries(names)
    .map(([state, message]) => ({
      count: analysis.obligations.filter((item) => item.state === state).length,
      message,
    }))
    .filter((item) => item.count > 0);
  const actions = analysis.obligations.reduce((sum, item) => sum + item.openActions, 0);
  if (actions) reasons.push({ count: actions, message: "Open actions" });
  return (
    <section aria-label="Completion accounting">
      {reasons.map((reason) => (
        <p key={reason.message}>
          {reason.message}: {reason.count}.
        </p>
      ))}
      {analysis.discovery !== "current" && (
        <p>
          Discovery is {analysis.discovery}; refresh and account for the selected scope before
          completion.
        </p>
      )}
    </section>
  );
}
