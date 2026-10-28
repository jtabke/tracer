import { useState } from "react";
import type { Entity } from "../../src/core/model.ts";
import type {
  AssessmentAnalysis,
  CandidateKey,
  DispositionView,
  SetAssessmentDisposition,
} from "../../src/core/change-assessment.ts";
import type { Editing } from "../editing.ts";
import { useProjection } from "../use-projection.ts";
import { fieldsFrom } from "../fields.tsx";
import { AdditionalFields, assessmentCommand, useAssessmentDirty } from "./choices.tsx";
import { AssessmentActions } from "./actions.tsx";
import { AssessmentSupport } from "./support.tsx";

export function AssessmentJudgment(props: {
  analysis: AssessmentAnalysis;
  subject: CandidateKey;
  entities: Entity[];
  editing: Editing;
  current: boolean;
  epoch: number;
  onDirty(value: boolean): void;
  onSaved(): void;
}) {
  const { analysis, subject, editing } = props;
  const selection = {
    assessmentId: analysis.view.assessment.id,
    openingCommandId: analysis.view.opening.commandId,
  };
  const detail = useProjection(
    "/api/assessment-disposition",
    { ...selection, ...subject },
    editing.epoch + props.epoch,
    editing.report,
  );
  return (
    <>
      {detail.loading && <p role="status">Loading the controlled judgment…</p>}
      {detail.failed && (
        <p role="alert">
          The judgment could not be refreshed. Your retained draft cannot be saved until the read
          succeeds.
        </p>
      )}
      {detail.retained !== undefined && (
        <JudgmentForm {...props} existing={detail.retained} ready={detail.ready} />
      )}
    </>
  );
}
type JudgmentProps = {
  analysis: AssessmentAnalysis;
  subject: CandidateKey;
  entities: Entity[];
  editing: Editing;
  current: boolean;
  ready: boolean;
  existing: DispositionView | null;
  onDirty(value: boolean): void;
  onSaved(): void;
};
function JudgmentForm(props: JudgmentProps) {
  const { analysis, subject, entities, editing, existing } = props;
  const { draft, setDraft, setDirty, extra, setExtra, stale, closed, locked, patch, save } =
    useJudgment(props);
  return (
    <form
      aria-label="Candidate judgment"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h4>{existing ? "Candidate judgment" : "Record a candidate judgment"}</h4>
      {closed && (
        <p role="status">
          Historical judgments are read only while this assessment is closed. Reopen explicitly to
          reassess.
        </p>
      )}
      {stale && (
        <p role="alert">
          The assessed basis or project changed. Your draft is retained. Inspect current context,
          then explicitly adopt it before saving.
        </p>
      )}
      <button
        type="button"
        disabled={locked}
        onClick={() => {
          const next = initialDraft(analysis, subject, existing);
          setDraft((prior) => ({
            ...next,
            title: prior.title,
            rationale: prior.rationale,
            decision: prior.decision,
            actions: prior.actions,
            support: prior.support,
          }));
          setDirty(true);
        }}
      >
        Adopt current assessed basis
      </button>
      <fieldset disabled={locked}>
        <label>
          Judgment title
          <input
            aria-label="Judgment title"
            value={draft.title}
            maxLength={200}
            required
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <label>
          Decision
          <select
            aria-label="Candidate decision"
            value={draft.decision}
            onChange={(e) => patch({ decision: e.target.value as typeof draft.decision })}
          >
            <option value="no_action">No action required</option>
            <option value="revise">Revision required</option>
            <option value="reverify">Reverification required</option>
            <option value="investigate">Investigation required</option>
            {analysis.view.model.definition.policy.allowUnknown && (
              <option value="acknowledge_unknown">Acknowledge unknown under model policy</option>
            )}
          </select>
        </label>
        <label>
          Rationale
          <textarea
            aria-label="Judgment rationale"
            required
            maxLength={4000}
            value={draft.rationale}
            onChange={(e) => patch({ rationale: e.target.value })}
          />
        </label>
        <AssessmentSupport
          title="Judgment support"
          value={draft.support}
          entities={entities}
          editing={editing}
          onChange={(support) => patch({ support })}
        />
        <AssessmentActions
          value={draft.actions}
          existingIds={existing?.actions.map((action) => action.id) ?? []}
          allowWaiver={analysis.view.model.definition.policy.allowActionWaiver === true}
          entities={entities}
          editing={editing}
          onChange={(actions) => patch({ actions })}
        />
        <AdditionalFields
          definitions={analysis.view.model.requiredFields.disposition}
          values={extra}
          onChange={(values) => {
            setExtra(values);
            setDirty(true);
          }}
        />
      </fieldset>
      <p>
        Historical support retains its recorded meaning. Current support is checked against current
        recorded facts; a decision does not rewrite its source evidence.
      </p>
      <button
        type="submit"
        disabled={locked || stale || !draft.rationale.trim() || !draft.title.trim()}
      >
        Save candidate judgment
      </button>
      <button
        type="button"
        disabled={editing.busy}
        onClick={() => {
          if (window.confirm("Discard this unsaved judgment and use the recorded version?")) {
            setDraft(initialDraft(analysis, subject, existing));
            setExtra({});
            setDirty(false);
          }
        }}
      >
        Discard judgment draft
      </button>
    </form>
  );
}
function useJudgment({
  analysis,
  subject,
  editing,
  current,
  ready,
  existing,
  onDirty,
  onSaved,
}: JudgmentProps) {
  const [draft, setDraft] = useState(() => initialDraft(analysis, subject, existing));
  const [dirty, setDirty] = useState(false);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const stale = judgmentStale(draft, analysis, existing);
  const closed = analysis.completion.state !== "open";
  const locked = editing.busy || !current || !ready || closed;
  useAssessmentDirty(dirty, onDirty);
  const patch = (value: Partial<SetAssessmentDisposition>) => {
    setDraft((prior) => ({ ...prior, ...value }));
    setDirty(true);
  };
  async function save() {
    if (locked || stale) return;
    try {
      const request = {
        ...draft,
        commandId: crypto.randomUUID(),
        additionalFields: fieldsFrom(extra, analysis.view.model.requiredFields.disposition ?? {}),
      };
      if (await editing.mutate("/api/change-assessments/disposition", request)) {
        setDirty(false);
        onSaved();
      }
    } catch (error) {
      editing.report(error);
    }
  }
  return { draft, setDraft, setDirty, extra, setExtra, stale, closed, locked, patch, save };
}

function initialDraft(
  analysis: AssessmentAnalysis,
  subject: CandidateKey,
  existing: DispositionView | null,
): SetAssessmentDisposition {
  const obligation = analysis.obligations.find(
    (item) => item.subject.kind === subject.kind && item.subject.id === subject.id,
  )!;
  const { reason: _reason, ...command } = assessmentCommand(analysis.view, "");
  return {
    ...command,
    subject,
    dispositionId: existing?.id ?? crypto.randomUUID(),
    membershipId: existing?.membershipId ?? crypto.randomUUID(),
    expectedDispositionVersion: existing?.version ?? 0,
    expectedBasisDigest: obligation.currentDigest,
    title: existing?.title ?? "Candidate impact judgment",
    decision: existing?.decision ?? "no_action",
    rationale: existing?.rationale ?? "",
    actions: structuredClone(existing?.actions ?? []),
    support: existing?.data.support.map((item) => item.reference) ?? [],
    additionalFields: {},
  };
}

function judgmentStale(
  draft: SetAssessmentDisposition,
  analysis: AssessmentAnalysis,
  existing: DispositionView | null,
) {
  const subject = draft.subject;
  const obligation = analysis.obligations.find(
    (item) => item.subject.kind === subject.kind && item.subject.id === subject.id,
  )!;
  return (
    draft.expectedBasisDigest !== obligation.currentDigest ||
    draft.expectedAssessmentVersion !== analysis.view.assessment.version ||
    draft.expectedDispositionVersion !== (existing?.version ?? 0) ||
    draft.expectedProjectRevision !== analysis.view.model.context.projectRevision ||
    draft.expectedEvidenceRevision !== analysis.view.model.context.evidenceRevision
  );
}
