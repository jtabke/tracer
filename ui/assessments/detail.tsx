import type { ConfigurationHandoff } from "../configuration-handoff.ts";
import { useRef, useState } from "react";
import type { Entity } from "../../src/core/model.ts";
import type { CandidateKey, ChangeAssessmentView } from "../../src/core/change-assessment.ts";
import type { Editing } from "../editing.ts";
import { useProjection } from "../use-projection.ts";
import {
  AssessmentSummary,
  AssessmentObligations,
  AssessmentLifecycle,
} from "./detail-sections.tsx";
import { assessmentCommand } from "./choices.tsx";
import { AssessmentJudgment } from "./judgment.tsx";
import { AssessmentCandidateContext } from "./scope.tsx";

export function AssessmentDetail({
  view,
  entities,
  editing,
  ready,
  epoch,
  onDirty,
  changed,
  onVerify,
}: {
  onVerify?(value: Omit<ConfigurationHandoff, "sequence">): void;
  view: ChangeAssessmentView;
  entities: Entity[];
  editing: Editing;
  ready: boolean;
  epoch: number;
  onDirty(value: boolean): void;
  changed(): void;
}) {
  const selection = { assessmentId: view.assessment.id, openingCommandId: view.opening.commandId };
  const read = useProjection(
    "/api/assessment-analysis",
    selection,
    editing.epoch + epoch,
    editing.report,
  );
  const analysis = read.retained;
  const heading = useRef<HTMLHeadingElement>(null);
  const [subject, setSubject] = useState<CandidateKey>();
  const [dirty, setDirty] = useState(false);
  const [reason, setReason] = useState("");
  const [editor, setEditor] = useState(0);
  const current =
    ready && read.ready && !editing.busy && Boolean(analysis?.view.model.compatibility.writable);
  const choose = (next: CandidateKey) => {
    if (dirty && !window.confirm("Discard the unsaved candidate judgment?")) return;
    setDirty(false);
    onDirty(Boolean(reason));
    setSubject(next);
    setEditor((value) => value + 1);
  };
  async function transition(operation: "refresh" | "close" | "reopen") {
    if (!analysis || !current || dirty || !reason.trim()) return;
    const result = await editing.mutate(
      `/api/change-assessments/${operation}`,
      assessmentCommand(analysis.view, reason),
    );
    if (result) {
      setReason("");
      onDirty(false);
      changed();
      requestAnimationFrame(() => heading.current?.focus());
    }
  }
  return (
    <section aria-label="Assessment detail">
      <h3 ref={heading} tabIndex={-1}>
        {view.assessment.title}
      </h3>
      {read.loading && (
        <p role="status">Checking candidate obligations and current applicability…</p>
      )}
      {read.failed && (
        <p role="alert">
          Current obligations could not be checked. The retained assessment and draft are read only.
        </p>
      )}
      {analysis && (
        <>
          <AssessmentSummary analysis={analysis} entities={entities} />
          <AssessmentVerificationHandoff
            analysis={analysis}
            subject={subject}
            current={current}
            onVerify={onVerify}
          />
          <AssessmentObligations
            analysis={analysis}
            entities={entities}
            subject={subject}
            busy={editing.busy}
            choose={choose}
          />
          {subject && (
            <>
              <AssessmentCandidateContext
                key={`${subject.kind}:${subject.id}`}
                subject={subject}
                view={analysis.view}
                entities={entities}
                epoch={editing.epoch + epoch}
                report={editing.report}
              />
              <AssessmentJudgment
                key={`${subject.kind}:${subject.id}:${editor}`}
                analysis={analysis}
                subject={subject}
                entities={entities}
                editing={editing}
                current={current}
                epoch={epoch}
                onDirty={(value) => {
                  setDirty(value);
                  onDirty(value || Boolean(reason));
                }}
                onSaved={() => {
                  setDirty(false);
                  onDirty(Boolean(reason));
                  setSubject(undefined);
                  changed();
                }}
              />
            </>
          )}
          <AssessmentLifecycle
            analysis={analysis}
            reason={reason}
            draftPending={dirty}
            blocked={!current || dirty}
            busy={editing.busy}
            onReason={(value) => {
              setReason(value);
              onDirty(dirty || Boolean(value));
            }}
            transition={transition}
          />
        </>
      )}
    </section>
  );
}

function AssessmentVerificationHandoff({
  analysis,
  subject,
  current,
  onVerify,
}: {
  analysis: import("../../src/core/change-assessment.ts").AssessmentAnalysis;
  subject: CandidateKey | undefined;
  current: boolean;
  onVerify: ((value: Omit<ConfigurationHandoff, "sequence">) => void) | undefined;
}) {
  const scope = analysis.view.scope;
  if (scope.version !== 2 || !onVerify) return null;
  return (
    <button
      disabled={!current}
      onClick={() =>
        onVerify({
          pair: { beforeId: scope.query.beforeId, afterId: scope.query.afterId },
          rootId: subject?.kind === "entity" ? subject.id : scope.query.rootId,
        })
      }
    >
      Verify after configuration
    </button>
  );
}
