import type { Receipt } from "../../src/core/evidence.ts";
import type { VerificationExecutionView } from "../../src/core/verification-case.ts";
import type { VerificationAnalysis } from "../../src/core/verification-lifecycle.ts";
import type { VerificationEditorProps } from "./common.ts";
import { useProjection } from "../use-projection.ts";
export function ExecutionInspection({
  analysis,
  executionId,
  epoch,
  editing,
  onReview,
  reviewBlocked,
}: {
  analysis: VerificationAnalysis;
  executionId: string;
  epoch: number;
  editing: VerificationEditorProps["editing"];
  onReview(receiptId: string): void;
  reviewBlocked: boolean;
}) {
  const read = useProjection(
      "/api/verification-execution",
      {
        caseId: analysis.view.case.id,
        openingCommandId: analysis.view.opening.commandId,
        executionId,
      },
      editing.epoch + epoch,
      editing.report,
    ),
    detail = read.retained;
  const receipt = useProjection(
    "/api/receipt",
    detail ? { receiptId: detail.receiptId } : undefined,
    editing.epoch + epoch,
    editing.report,
  );
  return (
    <section aria-label="Recorded activity inspection">
      <h4>{detail?.execution.title ?? "Recorded activity"}</h4>
      {read.loading && <p role="status">Reading original activity…</p>}
      {read.failed && (
        <p role="alert">
          The original activity could not be read; retained context is not a current assessment.
        </p>
      )}
      {detail && (
        <>
          <p>
            Method v{detail.data.methodVersion} · case basis v{detail.data.basisVersion} · current
            record {detail.execution.currentVersion ?? "unavailable"}
          </p>
          <p>
            Interpretation inputs: {detail.comparison.record.state}
            {detail.comparison.source &&
              ` · Original activity inputs: ${detail.comparison.source.state}`}
          </p>
          <ActivitySource
            detail={detail}
            blocked={reviewBlocked || !read.ready}
            onReview={onReview}
          />
          <h5>Conditions</h5>
          <pre>
            {typeof detail.data.conditions === "string"
              ? detail.data.conditions
              : JSON.stringify(detail.data.conditions, null, 2)}
          </pre>
          <ol>
            {detail.data.results.map((x) => (
              <li key={x.criterionId}>
                <strong>
                  {x.criterionId} · {analysis.view.model.definition.outcomes[x.outcome]}
                </strong>
                <p>{x.actual}</p>
                <p>{x.rationale}</p>
              </li>
            ))}
          </ol>
        </>
      )}
      {receipt.failed && <p role="alert">Captured supporting inputs could not be read.</p>}
      {receipt.retained && <CapturedActivityInputs receipt={receipt.retained} />}
    </section>
  );
}

function ActivitySource({
  detail,
  blocked,
  onReview,
}: {
  detail: VerificationExecutionView;
  blocked: boolean;
  onReview(receiptId: string): void;
}) {
  const source = detail.data.source;
  return (
    <>
      <p>
        {source.kind === "prior_receipt"
          ? `Earlier activity, explicitly interpreted. Original actor: ${source.actor}; recorded at ${source.recordedAt}. ${source.rationale}`
          : "Current activity and execution state recorded with explicit conditions and results. A not-run result does not claim method execution."}
      </p>
      <button disabled={blocked} onClick={() => onReview(detail.receiptId)}>
        Compare and review activity inputs
      </button>
      {source.kind === "prior_receipt" && (
        <button disabled={blocked} onClick={() => onReview(source.receiptId)}>
          Compare and review original activity inputs
        </button>
      )}
    </>
  );
}

function CapturedActivityInputs({ receipt }: { receipt: Receipt }) {
  return (
    <details>
      <summary>
        Exact captured inputs · {receipt.inputs.length} records and{" "}
        {receipt.relationshipInputs?.length ?? 0} connections
      </summary>
      <ul>
        {receipt.inputs.map((x, i) => (
          <li key={i}>
            {x.entity.resource?.label ?? x.entity.key ?? x.entityId.slice(0, 8)} · {x.facet} ·
            native v{x.entity.version}
            {x.fields && ` · fields: ${x.fields.join(", ")}`}
            {x.observation &&
              ` · ${x.observation.availability} · ${x.observation.hash ?? "unknown"}`}{" "}
            · {x.role}
          </li>
        ))}
        {receipt.relationshipInputs?.map((x) => (
          <li key={x.relationship.id}>
            {x.relationship.type} · v{x.relationship.version} · {x.role}
          </li>
        ))}
      </ul>
    </details>
  );
}
