import type { SchemaObject } from "../src/core/model.ts";
import { nextWorkDefaults } from "../src/core/next-work.ts";
import type { Editing } from "./editing.ts";
import type { Projection } from "./use-projection.ts";
import { WorkItem } from "./records/details.tsx";
import { EvidenceReviewStage } from "./evidence-review-stage.tsx";
import { NextWorkChoices } from "./next-work-choices.tsx";
import { NextWorkQueues } from "./next-work-queues.tsx";
import { useNextWorkState } from "./next-work-state.ts";
import "./next-work.css";

type WorkspaceState = ReturnType<typeof useNextWorkState>;
export function NextWork({
  schema,
  editing,
  active,
  changed,
  onDirty,
  onConfigure,
}: {
  schema: SchemaObject | null;
  editing: Editing;
  active: boolean;
  changed(): void;
  onDirty(value: boolean): void;
  onConfigure?(): void;
}) {
  const state = useNextWorkState(editing, active, onDirty);
  return (
    <section className="next-work" aria-label="Next work">
      {editing.busy && (
        <p role="status">
          Workspace editing is paused. Return to the current revision and resolve pending reads or
          saves before editing.
        </p>
      )}
      <NextWorkList state={state} schema={schema} onConfigure={onConfigure} />
      {state.error && <p role="alert">{state.error}</p>}
      <NextWorkRecordStage
        item={state.item}
        editing={editing}
        active={state.itemActive}
        onDirty={state.setItemDirty}
        onChoose={state.chooseRecord}
        onReturn={state.returnToList}
      />
      <EvidenceReviewStage
        receiptId={state.receiptId}
        active={state.reviewActive}
        busy={editing.busy || !state.reviewActive}
        epoch={editing.epoch}
        changed={changed}
        mutate={editing.mutate}
        report={state.report}
        onDraftChange={state.setReviewDirty}
        onReceiptChangeBlocked={state.setReceiptId}
        returnLabel="Return to next work"
        onReturn={state.returnToList}
      />
    </section>
  );
}
function NextWorkList({
  state,
  schema,
  onConfigure,
}: {
  state: WorkspaceState;
  schema: SchemaObject | null;
  onConfigure?(): void;
}) {
  const { queues } = state;
  const queueSchema = queues.data ? queues.data.schema : schema;
  return (
    <div hidden={state.mode !== "list"}>
      <header>
        <h2 ref={state.heading} tabIndex={-1}>
          Next work
        </h2>
        <button onClick={state.refreshQueues}>Refresh queues</button>
      </header>
      <p>
        Five separate queues. An item may appear in more than one. These are recorded gaps and
        review work, not release readiness.
      </p>
      <NextWorkChoices
        schema={queueSchema}
        selection={
          queues.data?.selection ?? { ...nextWorkDefaults(queueSchema), ...state.selection }
        }
        onChange={state.chooseSelection}
        onReset={state.resetSelection}
      />
      {onConfigure && <button onClick={onConfigure}>Configure model and policies</button>}
      {state.itemDirty && <button onClick={state.resumeItem}>Resume item draft</button>}
      {state.reviewDirty && <button onClick={state.resumeReview}>Resume review draft</button>}
      {queues.loading && <p role="status">Refreshing queues…</p>}
      {queues.data && !queues.failed && (
        <>
          <p role="status">
            Snapshot r{queues.data.projectRevision} · Model v{queues.data.schemaVersion} · Evidence
            sequence {queues.data.evidenceRevision}. Refresh to include later changes.
          </p>
          <NextWorkQueues
            data={queues.data}
            ready={queues.ready}
            onRecord={state.chooseRecord}
            onReceipt={state.chooseReceipt}
          />
        </>
      )}
    </div>
  );
}
function NextWorkRecordStage({
  item,
  editing,
  active,
  onDirty,
  onChoose,
  onReturn,
}: {
  item: Projection<"/api/connections">;
  editing: Editing;
  active: boolean;
  onDirty(value: boolean): void;
  onChoose(id: string): void;
  onReturn(): void;
}) {
  const detail = item.data ?? item.retained;
  return (
    <div hidden={!active}>
      {!detail && <button onClick={onReturn}>Return to next work</button>}
      {item.loading && <p role="status">Loading current item… Editing is paused.</p>}
      {detail && (
        <WorkItem
          key={detail.entity.id}
          entity={detail.entity}
          schema={detail.schema}
          editing={{ ...editing, busy: editing.busy || !item.ready || !active }}
          onDirty={onDirty}
          onChoose={(entity) => onChoose(entity.id)}
          onTable={onReturn}
          returnLabel="Return to next work"
        />
      )}
    </div>
  );
}
