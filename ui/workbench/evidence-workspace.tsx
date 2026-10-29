import { createRoot } from "react-dom/client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { EvidenceReviewStage } from "../evidence-review-stage.tsx";
import { useProjection } from "../use-projection.ts";
import type { MutationController, MutationExecutor } from "../mutation-controller.ts";
import type { WorkingReceipt } from "../../src/core/working-context.ts";
import "./evidence-workspace.css";

type Subject = { id: string; key: string; change?: number };
type Options = {
  subject: Subject;
  open: boolean;
  visible: boolean;
  current: boolean;
  head: number;
  epoch: number;
  blocked: boolean;
  discardRevision: number;
  onOpen(): void;
  onReturn(): void;
  returnLabel: string;
  onDirty(dirty: boolean): void;
  onSaved(): void;
  onMutationSettled(): void;
  onRefresh(): void;
};
export function createEvidenceWorkspace(controller: MutationController) {
  const host = document.createElement("div");
  host.className = "assessment-workspace";
  const root = createRoot(host);
  return {
    host,
    update: (options: Options) =>
      root.render(<Workbench controller={controller} options={options} />),
  };
}
function Workbench({ controller, options }: { controller: MutationController; options: Options }) {
  const stage = useWorkbench(controller, options);
  function renderSummary() {
    return (
      !options.open &&
      stage.active && (
        <div className="evidence-summary" aria-label="Evaluation freshness summary">
          <button onClick={options.onOpen}>
            {stage.dirty ? "Resume evidence review" : "Review changed evidence"}
            {stage.catalogue.ready && stage.context ? ` · ${stage.context.receipts.total}` : ""}
          </button>
          {stage.ready ? (
            <span>
              {options.subject.key} · {stage.changedCount} changed · {stage.unknownCount} unknown
              {stage.after || stage.context?.receipts.page.nextAfter ? " · loaded page" : ""} ·
              active evaluations
            </span>
          ) : (
            <span>
              {stage.catalogue.failed
                ? "Evidence unavailable"
                : stage.catalogue.loading
                  ? "Checking recorded inputs…"
                  : "Refresh required"}
            </span>
          )}
        </div>
      )
    );
  }
  function renderReadStatus() {
    return (
      <>
        {!options.current && (
          <p role="status">
            Historical state is read only. Return to latest to compare and review evidence.
          </p>
        )}
        {stage.catalogue.loading && (
          <p role="status">Loading recorded evaluations. Review is paused.</p>
        )}
        {stage.catalogue.failed && (
          <p role="status">
            Evidence could not be refreshed. Retained evidence and review draft remain; recording is
            paused. <button onClick={stage.refresh}>Retry evidence read</button>
          </p>
        )}
        {stage.context && !stage.matchesHead && (
          <p role="status">
            The native project changed. Refresh the workspace before recording a decision.{" "}
            <button onClick={options.onRefresh} disabled={stage.saving || stage.unknown}>
              Refresh workspace
            </button>
          </p>
        )}
        {stage.notice && (
          <p role="status" className="assessment-notice">
            {stage.notice}
          </p>
        )}
        {stage.unknown && (
          <p role="status">
            Decision outcome is uncertain. Use Inspect saved result to check the recorded reviews.
            No automatic retry is sent.
          </p>
        )}
      </>
    );
  }
  return (
    <>
      {renderSummary()}
      <section className="assessment-content" hidden={!options.open} aria-label="Evidence review">
        <header className="assessment-heading">
          <div>
            <h2>Evidence review · {options.subject.key}</h2>
            <p>
              {options.subject.change === undefined
                ? "Current record"
                : `Change r${options.subject.change}`}{" "}
              · Compared with latest recorded inputs · Native workspace r
              {stage.context?.context.projectRevision ?? options.head}
            </p>
          </div>
          <div>
            <button
              className="assessment-browse"
              onClick={() => stage.setBrowse((value) => !value)}
            >
              Evaluations{stage.context ? ` · ${stage.context.receipts.total}` : ""}
            </button>
            <button onClick={stage.refresh} disabled={stage.saving}>
              Refresh evidence
            </button>
            <button onClick={options.onReturn}>{options.returnLabel}</button>
          </div>
        </header>
        {renderReadStatus()}
        {stage.recordedDecision && (
          <section
            className="recorded-decision"
            aria-label="Recorded decision"
            data-review-id={stage.recordedDecision.id}
          >
            <strong>
              Decision recorded ·{" "}
              {
                {
                  accepted: "Evidence still applicable",
                  acknowledged: "Change acknowledged",
                  needs_reevaluation: "Needs reevaluation",
                }[stage.recordedDecision.decision]
              }
            </strong>
            <span>
              {stage.recordedDecision.actor} · {stage.recordedDecision.at}
            </span>
            <small>Review {stage.recordedDecision.id}</small>
          </section>
        )}
        <div
          className={`assessment-layout ${stage.selection ? "has-selection" : ""} ${stage.browse ? "browsing-evaluations" : ""}`}
        >
          <aside className="assessment-evaluations" aria-label="Related evaluations">
            <h3>Recorded evaluations{stage.context ? ` · ${stage.context.receipts.total}` : ""}</h3>
            <p>
              Declared inputs or captured output for {options.subject.key}. Ordinary connections
              alone do not establish evaluated dependencies.
            </p>
            {stage.ready && !stage.entries.length && (
              <p>No evaluations found in this declared scope.</p>
            )}
            {stage.entries.map((item) => (
              <button
                key={item.receipt.id}
                data-receipt={item.receipt.id}
                aria-pressed={stage.selection?.id === item.receipt.id}
                onClick={() => stage.choose(item)}
                disabled={!stage.ready || stage.saving || stage.unknown}
              >
                <strong>{item.receipt.output.key ?? item.receipt.output.id}</strong>
                <span>{String(item.receipt.output.fields.title ?? "")}</span>
                <small>
                  Inputs: {item.comparison?.state ?? "comparison not loaded"} · Review:{" "}
                  {item.comparison?.review.state ?? "not loaded"}
                </small>
                {item.supersession.count > 0 && (
                  <small>
                    Superseded · {item.supersession.count} replacement
                    {item.supersession.count === 1 ? "" : "s"}
                  </small>
                )}
              </button>
            ))}
            {stage.context?.receipts.page.nextAfter && (
              <button
                onClick={() => stage.setAfter(stage.context?.receipts.page.nextAfter)}
                disabled={!stage.ready || stage.saving}
              >
                Next evaluations
              </button>
            )}
            {stage.after && (
              <button onClick={stage.refresh} disabled={stage.saving}>
                First evaluations
              </button>
            )}
            <p className="assessment-boundary">
              Freshness compares immutable captures with current recorded inputs. It is separate
              from the recorded outcome and engineering judgment.
            </p>
          </aside>
          <div className="assessment-review">
            {stage.selection && (
              <EvidenceReviewStage
                receiptId={stage.selection.id}
                focusInputId={stage.selection.subject.id}
                subjectId={stage.selection.subject.id}
                epoch={options.epoch + stage.epoch}
                changed={stage.changed}
                mutate={stage.mutate}
                report={stage.report}
                returnLabel={options.returnLabel}
                onReturn={options.onReturn}
                active={options.open && stage.selection.subject.id === options.subject.id}
                busy={stage.paused || !options.current}
                discardRevision={options.discardRevision}
                onDraftChange={(value) => {
                  stage.setDirty(value);
                  options.onDirty(value);
                }}
                onReceiptChangeBlocked={(id) => {
                  stage.setSelection((current) => (current ? { ...current, id } : current));
                  stage.setNotice("The current review draft is retained.");
                }}
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function useWorkbench(controller: MutationController, options: Options) {
  const mutation = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const [epoch, setEpoch] = useState(0);
  const [after, setAfter] = useState<string>();
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [browse, setBrowse] = useState(false);
  const [selection, setSelection] = useState<{ id: string; subject: Subject }>();
  const [pageSubject, setPageSubject] = useState(options.subject.id);
  const report = (error: unknown) =>
    setNotice(error instanceof Error ? error.message : "Evidence could not be read.");
  const active = options.visible && options.current;
  const sameSubject = pageSubject === options.subject.id;
  const query = evidenceQuery(options.subject.id, active, sameSubject ? after : undefined);
  const catalogue = useProjection("/api/working-context", query, options.epoch + epoch, report);
  const context = catalogue.data ?? catalogue.retained;
  const matchesHead = context?.context.projectRevision === options.head;
  const ready = [catalogue.ready, matchesHead, active].every(Boolean);
  const saving = mutation.status === "saving";
  const unknown = mutation.status === "unknown";
  const paused = [!ready, options.blocked, saving, unknown].some(Boolean);
  useEffect(() => {
    if (!sameSubject) {
      setPageSubject(options.subject.id);
      setAfter(undefined);
    }
  }, [options.subject.id, sameSubject]);
  useEffect(() => {
    if (!options.open || !ready || dirty) return;
    if (selection?.subject.id === options.subject.id) return;
    const first =
      context?.receipts.page.items.find((item) => !item.supersession.count) ??
      context?.receipts.page.items[0];
    setSelection(first ? { id: first.receipt.id, subject: options.subject } : undefined);
  }, [options.open, ready, options.subject, dirty, selection?.subject.id, context]);
  const refresh = () => {
    setNotice("");
    setAfter(undefined);
    setEpoch((value) => value + 1);
  };
  const choose = (item: WorkingReceipt) => {
    if (dirty && item.receipt.id !== selection?.id) {
      setNotice(
        "Your review draft is retained. Finish it or discard it before choosing another evaluation.",
      );
      return;
    }
    setNotice("");
    setBrowse(false);
    setSelection({ id: item.receipt.id, subject: options.subject });
  };
  const mutate: MutationExecutor = async (path, input) => {
    setNotice("");
    const result = await controller.run(path, input);
    if (result === undefined) {
      const state = controller.snapshot();
      if (state.status === "rejected") setEpoch((value) => value + 1);
      report(
        state.status === "rejected"
          ? state.error
          : new Error("Save outcome needs inspection. Do not submit the decision again."),
      );
    }
    options.onMutationSettled();
    return result;
  };
  const changed = () => {
    refresh();
    options.onSaved();
  };
  const entries = context?.receipts.page.items ?? [];
  const currentEntries = entries.filter((item) => !item.supersession.count);
  const changedCount = currentEntries.filter((item) => item.comparison?.hasChanged).length;
  const unknownCount = currentEntries.filter((item) => item.comparison?.hasUnknown).length;
  const recordedDecision = entries.find((item) => item.receipt.id === selection?.id)?.comparison
    ?.review.decision;
  return {
    dirty,
    active,
    catalogue,
    context,
    ready,
    after,
    changedCount,
    unknownCount,
    notice,
    matchesHead,
    saving,
    unknown,
    entries,
    selection,
    browse,
    recordedDecision,
    choose,
    refresh,
    setBrowse,
    mutate,
    changed,
    paused,
    setDirty,
    setSelection,
    setNotice,
    setAfter,
    epoch,
    report,
  };
}

function evidenceQuery(focusId: string, active: boolean, after?: string) {
  if (!active) return undefined;
  return { focusId, recipe: { routes: [] }, receipts: { limit: 5, after } };
}
