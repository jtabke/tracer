import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Comparison, Receipt, ReviewInput } from "../src/core/evidence.ts";
import { label } from "./entity-label.ts";
import { EvidenceInputs } from "./evidence-inputs.tsx";
import "./evidence.css";
import type { MutationExecutor } from "./mutation-controller.ts";
import { useProjection } from "./use-projection.ts";

type ReviewBase = { receiptId: string; token: string };
type ReviewChoice = ReviewInput["decision"] | "";
export type EvidenceReviewStageProps = {
  receiptId: string;
  focusInputId?: string;
  receipt?: Receipt;
  outputId?: string;
  subjectId?: string;
  epoch: number;
  changed(): void;
  mutate: MutationExecutor;
  report(error: unknown, attempted?: unknown): void;
  returnLabel: string;
  onReturn(): void;
  active?: boolean;
  busy?: boolean;
  discardRevision?: number;
  onDraftChange?(dirty: boolean): void;
  onReceiptChangeBlocked?(retainedId: string): void;
  onOpenConfiguration?(id: string): void;
};

/** One mounted owner for catalogue, item and graph receipt activation. Hidden means paused, not discarded. */
export function EvidenceReviewStage(props: EvidenceReviewStageProps) {
  const stage = useEvidenceStage(props);
  return (
    <section
      className="evidence-workspace evidence-review-stage"
      aria-label="Captured result review"
      hidden={props.active === false}
    >
      <header className="evidence-stage-header">
        <button onClick={props.onReturn}>{props.returnLabel}</button>
        <p className="eyebrow">CAPTURED RESULT</p>
        {stage.receipt && (
          <h2>
            {label(stage.receipt.output)}
            {typeof stage.receipt.output.fields.title === "string" &&
              stage.receipt.output.fields.title !== label(stage.receipt.output) &&
              ` · ${stage.receipt.output.fields.title}`}
          </h2>
        )}
      </header>
      <EvidenceReadStatus stage={stage} />
      <EvidenceStageContent
        stage={stage}
        focusInputId={props.focusInputId}
        subjectId={props.subjectId}
        onOpenConfiguration={props.onOpenConfiguration}
      />
    </section>
  );
}
function useEvidenceStage(props: EvidenceReviewStageProps) {
  const owner = useReviewOwner(props);
  const query = owner.id ? { receiptId: owner.id } : undefined;
  const receiptRead = useProjection("/api/receipt", query, props.epoch, props.report);
  const comparisonRead = useProjection("/api/comparison", query, props.epoch, props.report);
  const receipt = retainedReceipt(receiptRead.data, receiptRead.retained, props.receipt, owner.id);
  const comparison = comparisonRead.data ?? comparisonRead.retained;
  const ready = receiptRead.ready && comparisonRead.ready;
  const stale = Boolean(owner.base && owner.base.token !== comparison?.token);
  const paused = !ready || owner.busy || Boolean(props.busy);
  const recordReview = () => recordReviewDecision(owner, comparison, props, paused, stale);

  return { owner, receiptRead, comparisonRead, receipt, comparison, paused, stale, recordReview };
}
function retainedReceipt(
  data: Receipt | undefined,
  retained: Receipt | undefined,
  supplied: Receipt | undefined,
  id: string,
) {
  return data ?? retained ?? (supplied?.id === id ? supplied : undefined);
}

async function recordReviewDecision(
  owner: ReturnType<typeof useReviewOwner>,
  comparison: Comparison | undefined,
  props: EvidenceReviewStageProps,
  paused: boolean,
  stale: boolean,
) {
  const decision = owner.decision;
  if (!decision || !reviewCanSave(owner, comparison, paused, stale)) return;
  owner.setBusy(true);
  owner.setNotice("");
  try {
    const saved = await props.mutate("/api/reviews", {
      receiptId: owner.base!.receiptId,
      expectedComparison: owner.base!.token,
      decision,
      rationale: owner.rationale,
    });
    if (saved !== undefined) {
      owner.discard();
      owner.setNotice("Review recorded. Original outcome and captured inputs are unchanged.");
      props.changed();
    }
  } finally {
    owner.setBusy(false);
  }
}
type Stage = ReturnType<typeof useEvidenceStage>;
function reviewCanSave(
  owner: ReturnType<typeof useReviewOwner>,
  comparison: Comparison | undefined,
  paused: boolean,
  stale: boolean,
) {
  return Boolean(
    owner.base &&
    owner.decision &&
    !stale &&
    !paused &&
    owner.rationale.trim() &&
    !(owner.decision === "accepted" && comparison?.hasUnknown),
  );
}
function EvidenceReadStatus({ stage }: { stage: Stage }) {
  return (
    <>
      {stage.owner.notice && <p role="status">{stage.owner.notice}</p>}
      {(stage.receiptRead.loading || stage.comparisonRead.loading) && (
        <p role="status">Loading receipt comparison… Review is paused.</p>
      )}
      {(stage.receiptRead.failed || stage.comparisonRead.failed) && (
        <p role="status">
          Receipt comparison could not be established. Retained evidence and draft remain; review is
          paused until a successful refresh.
        </p>
      )}
    </>
  );
}
function EvidenceStageContent({
  stage,
  focusInputId,
  subjectId,
  onOpenConfiguration,
}: {
  stage: Stage;
  focusInputId?: string;
  subjectId?: string;
  onOpenConfiguration?(id: string): void;
}) {
  const { receipt, comparison } = stage;
  return (
    <>
      {receipt && <RecordedResult receipt={receipt} onOpenConfiguration={onOpenConfiguration} />}
      {comparison && (
        <>
          <ComparisonSummary comparison={comparison} />
          <ReceiptSubjectNotice
            subjectId={subjectId}
            outputId={receipt?.output.id}
            comparison={comparison}
          />
          <EvidenceInputs
            comparison={comparison}
            receipt={receipt}
            focusInputId={focusInputId}
            mode="focused"
          />
          <EvidenceJudgment stage={stage} comparison={comparison} />
        </>
      )}
      {receipt && (
        <details className="evidence-original-receipt">
          <summary>Immutable recorded receipt</summary>
          <pre>{JSON.stringify(receipt, null, 2)}</pre>
        </details>
      )}
    </>
  );
}
function ReceiptSubjectNotice({
  subjectId,
  outputId,
  comparison,
}: {
  subjectId?: string;
  outputId?: string;
  comparison: Comparison;
}) {
  if (
    !subjectId ||
    subjectId === outputId ||
    comparison.inputs.some((input) => input.entityId === subjectId)
  )
    return null;
  return (
    <p className="evidence-scope-note">
      The originating item is not a declared input of this result. An ordinary connection does not
      add a captured dependency.
    </p>
  );
}
function EvidenceJudgment({ stage, comparison }: { stage: Stage; comparison: Comparison }) {
  const { owner, paused, stale } = stage;
  const adopt = () => owner.setBase({ receiptId: owner.id, token: comparison.token });
  return (
    <fieldset className="evidence-judgment" disabled={paused}>
      <legend>Review judgment</legend>
      {!owner.base ? (
        <button onClick={adopt}>Review receipt</button>
      ) : (
        <>
          <ReviewFields
            decision={owner.decision}
            rationale={owner.rationale}
            onDecision={owner.setDecision}
            onRationale={owner.setRationale}
          />
          {stale && (
            <p role="status">
              Review inputs changed. Draft retained; explicitly adopt the refreshed comparison
              before submitting.
            </p>
          )}
          {owner.decision === "accepted" && comparison.hasUnknown && (
            <p role="status">
              An unknown input cannot be accepted. Acknowledge the uncertainty or mark it for
              reevaluation.
            </p>
          )}
          <div className="toolbar">
            {stale && <button onClick={adopt}>Adopt refreshed review inputs</button>}
            <button
              disabled={!reviewCanSave(owner, comparison, paused, stale)}
              onClick={() => void stage.recordReview()}
            >
              Record review decision
            </button>
            <button onClick={owner.discard}>Discard review draft</button>
          </div>
        </>
      )}
    </fieldset>
  );
}

function useReviewOwner(props: EvidenceReviewStageProps) {
  const [id, setId] = useState(props.receiptId);
  const [base, setBase] = useState<ReviewBase>();
  const [decision, setDecision] = useState<ReviewChoice>("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const dirty = Boolean(base) || busy;
  const discardRevision = useRef(props.discardRevision);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const blockedReceiptChange = useEffectEvent((id: string) => props.onReceiptChangeBlocked?.(id));
  const notifyDraft = useEffectEvent((dirty: boolean) => props.onDraftChange?.(dirty));
  useEffect(() => {
    const discardRequested = props.discardRevision !== discardRevision.current;
    discardRevision.current = props.discardRevision;
    if (discardRequested && !busyRef.current) {
      setBase(undefined);
      setRationale("");
      setDecision("");
    }
    if (props.receiptId === id) return;
    if (busyRef.current || (dirtyRef.current && !discardRequested)) {
      setNotice(
        "The current review draft is retained. Return to it or discard it before changing receipt.",
      );
      blockedReceiptChange(id);
      return;
    }
    setId(props.receiptId);
    setBase(undefined);
    setDecision("");
    setRationale("");
    setNotice("");
  }, [props.receiptId, props.discardRevision, id]);
  useEffect(() => {
    notifyDraft(dirty);
  }, [dirty]);
  const discard = () => {
    setBase(undefined);
    setRationale("");
    setDecision("");
  };
  return {
    id,
    base,
    setBase,
    decision,
    setDecision,
    rationale,
    setRationale,
    busy,
    setBusy,
    notice,
    setNotice,
    discard,
  };
}

function RecordedResult({
  receipt,
  onOpenConfiguration,
}: {
  receipt: Receipt;
  onOpenConfiguration?(id: string): void;
}) {
  return (
    <section className="evidence-recorded-result" aria-label="Recorded result">
      <h3>Recorded outcome</h3>
      <p className="evidence-native-outcome">{receipt.outcome}</p>
      <details className="evidence-capture-details">
        <summary>Captured output v{receipt.output.version}</summary>
        <p className="muted">
          {receipt.at} · {receipt.actor}
        </p>
      </details>
      {receipt.configuration && (
        <p className="evidence-configuration">
          Recorded configuration:{" "}
          {onOpenConfiguration ? (
            <button
              className="text-action"
              onClick={() => onOpenConfiguration(receipt.configuration!.id)}
              aria-label={`Open recorded configuration: ${receipt.configuration.name}`}
            >
              {receipt.configuration.name}
            </button>
          ) : (
            <strong>{receipt.configuration.name}</strong>
          )}
        </p>
      )}
    </section>
  );
}
function ComparisonSummary({ comparison }: { comparison: Comparison }) {
  const changed = comparison.inputs.filter((input) => input.hasChanged).length;
  const unknown = comparison.inputs.filter((input) => input.hasUnknown).length;
  const matching = comparison.inputs.filter(
    (input) => !input.hasChanged && !input.hasUnknown,
  ).length;
  return (
    <section className="evidence-comparison-summary" aria-label="Input freshness and review status">
      <h3>
        Freshness: {comparison.state} · Review: {comparison.review.state}
      </h3>
      <p>
        {changed} changed · {unknown} unknown · {matching} matching · {comparison.inputs.length}{" "}
        declared inputs
      </p>
      {comparison.inputs.some((input) => input.hasChanged && input.hasUnknown) && (
        <p>Some inputs have both known changes and unknown current facts.</p>
      )}
      <p className="muted">Input freshness and the recorded outcome are independent.</p>
      {comparison.supersededBy.length > 0 && (
        <p>Superseded by: {comparison.supersededBy.join(", ")}</p>
      )}
      {comparison.review.previous && (
        <p>
          Previous review no longer matches these inputs: {comparison.review.previous.rationale}
        </p>
      )}
      {comparison.review.decision && (
        <p>Review rationale: {comparison.review.decision.rationale}</p>
      )}
    </section>
  );
}
function ReviewFields({
  decision,
  rationale,
  onDecision,
  onRationale,
}: {
  decision: ReviewChoice;
  rationale: string;
  onDecision(value: ReviewChoice): void;
  onRationale(value: string): void;
}) {
  return (
    <>
      <label>
        Review decision
        <select
          aria-label="Review decision"
          value={decision}
          onChange={(event) => onDecision(event.target.value as ReviewChoice)}
        >
          <option value="">Choose a judgment</option>
          <option value="accepted">Evidence still applicable</option>
          <option value="acknowledged">Acknowledge change</option>
          <option value="needs_reevaluation">Needs reevaluation</option>
        </select>
      </label>
      <label>
        Review rationale
        <textarea
          aria-label="Review rationale"
          value={rationale}
          onChange={(event) => onRationale(event.target.value)}
        />
      </label>
    </>
  );
}
