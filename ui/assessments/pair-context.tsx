import type {
  AssessmentScope,
  CandidateKey,
  AssessmentReceiptCandidate,
} from "../../src/core/change-assessment.ts";
import type { Editing } from "../editing.ts";
import { useProjection } from "../use-projection.ts";
import { label } from "../entity-label.ts";

export function PairCandidateContext({
  scope,
  subject,
  epoch,
  report,
}: {
  scope: Extract<AssessmentScope, { version: 2 }>;
  subject: CandidateKey;
  epoch: number;
  report: Editing["report"];
}) {
  const candidate = scope.candidates.find((x) => x.kind === subject.kind && x.id === subject.id)!;
  const pair = useProjection(
    "/api/configuration-comparison",
    { beforeId: scope.query.beforeId, afterId: scope.query.afterId },
    epoch,
    report,
  );
  if (candidate.kind === "receipt")
    return <PairReceiptContext candidate={candidate} epoch={epoch} report={report} />;
  const before = pair.retained?.before,
    after = pair.retained?.after;
  const previous =
    candidate.kind === "entity"
      ? before?.members.find((x) => x.entity.id === candidate.id)?.entity
      : before?.relationships?.find((x) => x.relationship.id === candidate.id)?.relationship;
  const selected =
    candidate.kind === "entity"
      ? after?.members.find((x) => x.entity.id === candidate.id)?.entity
      : after?.relationships?.find((x) => x.relationship.id === candidate.id)?.relationship;
  return (
    <>
      <h4>Exact selected candidate · {candidate.change}</h4>
      <p>
        Before v{candidate.beforeVersion ?? "not selected"} → after v
        {candidate.version ?? "not selected"}. Membership removal is not project deletion.
      </p>
      {pair.failed && (
        <p role="alert">
          The selected pair could not be read. Retained context is not a live-state replacement.
        </p>
      )}
      {previous && (
        <details>
          <summary>Before native v{previous.version}</summary>
          <pre>{JSON.stringify(previous, null, 2)}</pre>
        </details>
      )}
      {selected && (
        <details open>
          <summary>After native v{selected.version}</summary>
          <pre>{JSON.stringify(selected, null, 2)}</pre>
        </details>
      )}
      <p>
        These are the fixed pair states. Current project changes do not replace either selection.
      </p>
    </>
  );
}
function PairReceiptContext({
  candidate,
  epoch,
  report,
}: {
  candidate: AssessmentReceiptCandidate;
  epoch: number;
  report: Editing["report"];
}) {
  const receipt = useProjection("/api/receipt", { receiptId: candidate.id }, epoch, report);
  return (
    <>
      <h4>{receipt.retained ? label(receipt.retained.output) : "Selected evaluation"}</h4>
      <p>
        Recorded outcome: {receipt.retained?.outcome ?? "not read"}. Outcomes are not reinterpreted
        by this investigation.
      </p>
      <p>
        Selected scope at discovery:{" "}
        {candidate.scope.hasChanged ? "changed inputs" : "no known changed inputs"}
        {candidate.scope.hasUnknown ? " · unknown material" : ""}. Full receipt applicability can
        remain unknown outside this scope.
      </p>
      {receipt.failed && (
        <p role="alert">
          Original evidence could not be read. No missing or passing result is inferred.
        </p>
      )}
      <ol>
        {candidate.inputs.map((input, i) => (
          <li key={i}>
            {receipt.retained?.inputs[i]
              ? label(receipt.retained.inputs[i].entity)
              : input.entityId}{" "}
            · {selectedNativeState(input.version)} · observation{" "}
            {input.observationId ?? "unselected/unknown"} · reference{" "}
            {receipt.retained?.inputs[i]?.referenceId ?? "direct or declared path"}
          </li>
        ))}
      </ol>
      <details>
        <summary>Exact selected dependency facts</summary>
        <pre>{JSON.stringify(candidate, null, 2)}</pre>
      </details>
      <details>
        <summary>Original captured evaluation</summary>
        <pre>{JSON.stringify(receipt.retained, null, 2)}</pre>
      </details>
    </>
  );
}

function selectedNativeState(version: number | null) {
  return version === null
    ? "No selected after native state: outside or unresolved in this pair"
    : `selected after native v${version}`;
}
