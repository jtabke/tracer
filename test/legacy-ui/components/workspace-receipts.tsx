import { useState } from "react";
import type { Receipt } from "../../../src/core/evidence.ts";
import type { Page } from "../../../src/core/model.ts";
import { EvidenceInputs } from "../../../ui/evidence-inputs.tsx";
import { usePageCursor } from "../../../ui/use-page-cursor.ts";
import { useProjection } from "../../../ui/use-projection.ts";
import { WorkspacePager } from "./workspace-pager.tsx";

export function WorkspaceReceipts({
  entityId,
  epoch,
  onOpenReceipt,
}: {
  entityId: string;
  epoch: number;
  onOpenReceipt?(id: string, inputId?: string): void;
}) {
  if (onOpenReceipt)
    return (
      <section className="workspace-receipts" aria-label="Recorded evaluations">
        <h3>Captured results</h3>
        <p className="muted">Recorded evaluations where this item is the evaluated output.</p>
        <ReceiptList entityId={entityId} epoch={epoch} onOpenReceipt={onOpenReceipt} />
      </section>
    );
  const [opened, setOpened] = useState(false);
  return (
    <details
      className="workspace-receipts"
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary>Recorded evaluations</summary>
      {opened && <ReceiptList entityId={entityId} epoch={epoch} />}
    </details>
  );
}
function ReceiptList({
  entityId,
  epoch,
  onOpenReceipt,
}: {
  entityId: string;
  epoch: number;
  onOpenReceipt?(id: string, inputId?: string): void;
}) {
  const cursor = usePageCursor();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<Receipt>();
  const projection = useProjection(
    "/api/evidence",
    { kind: "receipt", subject: entityId, after: cursor.after, limit: 5 },
    epoch + retry,
    (error) => setError(String(error)),
  );
  return (
    <div>
      <ReceiptReadStatus loaded={!!projection.data} loading={projection.loading} error={error} />
      {!projection.data && !projection.loading && (
        <button onClick={() => setRetry((value) => value + 1)}>Retry evaluations</button>
      )}
      <ReceiptRows
        page={projection.data}
        selectedId={selected?.id}
        onSelect={(receipt) => (onOpenReceipt ? onOpenReceipt(receipt.id) : setSelected(receipt))}
      />
      <WorkspacePager
        noun="evaluations"
        previous={cursor.hasPrevious}
        next={!!projection.data?.nextAfter}
        paused={projection.loading}
        onPrevious={cursor.previous}
        onNext={() => cursor.next(projection.data!.nextAfter)}
      />
      {selected && <ReceiptRead key={selected.id} receipt={selected} epoch={epoch + retry} />}
    </div>
  );
}
function ReceiptRead({ receipt, epoch }: { receipt: Receipt; epoch: number }) {
  const [error, setError] = useState("");
  const comparison = useProjection("/api/comparison", { receiptId: receipt.id }, epoch, (error) =>
    setError(String(error)),
  );
  return (
    <section aria-label="Captured evaluation inspection">
      <h3>{receipt.outcome}</h3>
      {comparison.loading ? (
        <p role="status">Comparing captured inputs…</p>
      ) : comparison.data ? (
        <>
          <p>
            Declared inputs: {comparison.data.state}. This comparison does not determine whether the
            result remains applicable.
          </p>
          <EvidenceInputs receipt={receipt} comparison={comparison.data} />
        </>
      ) : (
        <p role="alert">{error || "Input comparison could not be read."}</p>
      )}
      <small>Record a scoped review or a new receipt in Evaluations.</small>
    </section>
  );
}

function ReceiptRows({
  page,
  selectedId,
  onSelect,
}: {
  page?: Page<Receipt>;
  selectedId?: string;
  onSelect(value: Receipt): void;
}) {
  return (
    <>
      {page?.items.length === 0 && (
        <p className="muted">No captured result records this item as its evaluated output.</p>
      )}
      {page?.items.map((receipt) => (
        <article key={receipt.id}>
          <button aria-pressed={selectedId === receipt.id} onClick={() => onSelect(receipt)}>
            Inspect evaluation: {receipt.outcome}
          </button>
          <small>
            Captured output v{receipt.output.version} · {receipt.at}
          </small>
        </article>
      ))}
    </>
  );
}

function ReceiptReadStatus({
  loaded,
  loading,
  error,
}: {
  loaded: boolean;
  loading: boolean;
  error: string;
}) {
  return (
    <>
      {loading && <p role="status">Reading captured evaluations…</p>}
      {!loaded && !loading && <p role="alert">{error || "Evaluations could not be read."}</p>}
    </>
  );
}
