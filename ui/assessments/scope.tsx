import type { Entity } from "../../src/core/model.ts";
import type {
  CandidateKey,
  ChangeAssessmentView,
  AssessmentReceiptCandidate,
  AssessmentNativeCandidate,
} from "../../src/core/change-assessment.ts";
import { useProjection } from "../use-projection.ts";
import { EvidenceInputs } from "../evidence/inputs.tsx";
import { label } from "../entity-label.ts";
import { PairCandidateContext } from "./pair-context.tsx";

export function AssessmentCandidateContext({
  subject,
  view,
  entities,
  epoch,
  report,
}: {
  subject: CandidateKey;
  view: ChangeAssessmentView;
  entities: Entity[];
  epoch: number;
  report(error: unknown): void;
}) {
  const candidate = view.scope.candidates.find(
    (value) => value.kind === subject.kind && value.id === subject.id,
  )!;
  return (
    <section className="assessment-candidate-context" aria-label="Selected candidate context">
      {view.scope.version === 2 ? (
        <PairCandidateContext scope={view.scope} subject={subject} epoch={epoch} report={report} />
      ) : candidate.kind === "receipt" ? (
        <ReceiptCandidateContext candidate={candidate} epoch={epoch} report={report} />
      ) : (
        <NativeCandidateContext
          candidate={candidate}
          entity={entities.find((entity) => entity.id === subject.id)}
        />
      )}
      <details>
        <summary>Exact recorded candidate</summary>
        <pre>{JSON.stringify(candidate, null, 2)}</pre>
      </details>
    </section>
  );
}
function ReceiptCandidateContext({
  candidate,
  epoch,
  report,
}: {
  candidate: AssessmentReceiptCandidate;
  epoch: number;
  report(error: unknown): void;
}) {
  const receipt = useProjection("/api/receipt", { receiptId: candidate.id }, epoch, report);
  const comparison = useProjection("/api/comparison", { receiptId: candidate.id }, epoch, report);
  return (
    <>
      <h4>{receipt.retained ? label(receipt.retained.output) : "Selected evaluation"}</h4>
      <p>
        Included because this evaluation captured a selected record or dependency path. Its recorded
        result remains independent from current input drift.
      </p>
      <p>
        At recorded discovery, selected captured uses: {candidate.scope.inputIds.length} inputs ·{" "}
        {candidate.scope.relationshipIds.length} connections.{" "}
        {candidate.scope.hasChanged && "Selected inputs changed. "}
        {candidate.scope.hasUnknown && "Selected inputs include unknown material."}
      </p>
      {receipt.loading && <p role="status">Loading the historical result…</p>}
      {(receipt.failed || comparison.failed) && (
        <p role="alert">
          The full evaluation context is unavailable. No missing evidence is inferred from this
          failed read.
        </p>
      )}
      {receipt.retained && (
        <>
          <p>Recorded outcome: {receipt.retained.outcome}</p>
          <p>Recorded {receipt.retained.at}</p>
        </>
      )}
      {comparison.retained && (
        <details>
          <summary>Full captured-input comparison · {comparison.retained.state}</summary>
          <p>
            This includes the whole evaluation; the assessment's selected scope may be narrower.
          </p>
          <EvidenceInputs comparison={comparison.retained} receipt={receipt.retained} />
        </details>
      )}
    </>
  );
}
function NativeCandidateContext({
  candidate,
  entity,
}: {
  candidate: AssessmentNativeCandidate;
  entity: Entity | undefined;
}) {
  return (
    <>
      <h4>{entity ? label(entity) : "Selected connection or removed record"}</h4>
      <p>
        At recorded scope discovery, included in the selected native traversal: {candidate.change}.
        Baseline v{candidate.beforeVersion ?? "absent"} → discovery v
        {candidate.version ?? "removed"}.
      </p>
      <p>
        Current native record:{" "}
        {entity ? `v${entity.version}` : "removed or outside the loaded snapshot"}.
      </p>
      {entity && (
        <p>
          {String(
            entity.fields.statement ?? entity.fields.title ?? entity.resource?.label ?? entity.type,
          )}
        </p>
      )}
      <p>
        Current basis is checked by the application analysis. External content is the last recorded
        observation, not newly fetched source bytes.
      </p>
    </>
  );
}
