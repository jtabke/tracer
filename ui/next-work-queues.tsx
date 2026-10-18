import { useState } from "react";
import type { NextWork, WorkEvidence, WorkQueue, WorkRecord } from "../src/core/next-work.ts";

const names = {
  statements: "Requirements missing statements",
  allocation: "Unallocated requirements",
  verification: "Missing verification plans",
  changedEvidence: "Changed evidence inputs",
  reviews: "Unresolved reviews",
} as const;
type QueueName = keyof typeof names;
export function NextWorkQueues({
  data,
  ready,
  onRecord,
  onReceipt,
}: {
  data: NextWork;
  ready: boolean;
  onRecord(id: string): void;
  onReceipt(id: string): void;
}) {
  const [selected, setSelected] = useState<QueueName>("statements");
  return (
    <>
      <nav aria-label="Work queues" className="next-work-queue-choices">
        {(Object.keys(names) as QueueName[]).map((id) => (
          <button key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>
            {names[id]}{" "}
            <strong>
              {data.queues[id].available ? data.queues[id].items.length : "Not configured"}
            </strong>
          </button>
        ))}
      </nav>
      {(Object.keys(names) as QueueName[]).map((id) => (
        <div key={id} hidden={selected !== id}>
          <QueuePanel
            name={names[id]}
            queue={data.queues[id]}
            ready={ready}
            onRecord={onRecord}
            onReceipt={onReceipt}
          />
        </div>
      ))}
    </>
  );
}
function QueuePanel({
  name,
  queue,
  ready,
  onRecord,
  onReceipt,
}: {
  name: string;
  queue: WorkQueue<WorkRecord | WorkEvidence>;
  ready: boolean;
  onRecord(id: string): void;
  onReceipt(id: string): void;
}) {
  const [page, setPage] = useState(0);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(queue.items.length / 10) - 1));
  const start = currentPage * 10;
  return (
    <section aria-label={name}>
      <h3>{name}</h3>
      <p>{queue.explanation}</p>
      {queue.available && (
        <>
          <p>
            {queue.items.length} to work on · {queue.evaluated} checked in this snapshot
          </p>
          {!queue.items.length && <p>No matching work in this queue.</p>}
          <ol className="next-work-items" start={start + 1}>
            {queue.items.slice(start, start + 10).map((item) => (
              <li key={"receiptId" in item ? item.receiptId : item.id}>
                {"receiptId" in item ? (
                  <EvidenceRow item={item} ready={ready} onOpen={onReceipt} />
                ) : (
                  <RecordRow item={item} ready={ready} onOpen={onRecord} />
                )}
              </li>
            ))}
          </ol>
          {queue.items.length > 10 && (
            <div className="toolbar" aria-label={`${name} pages`}>
              <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                Previous page
              </button>
              <span>
                {start + 1}–{Math.min(start + 10, queue.items.length)} of {queue.items.length}
              </span>
              <button
                disabled={start + 10 >= queue.items.length}
                onClick={() => setPage(currentPage + 1)}
              >
                Next page
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
function RecordRow({
  item,
  ready,
  onOpen,
}: {
  item: WorkRecord;
  ready: boolean;
  onOpen(id: string): void;
}) {
  return (
    <>
      <strong>
        {item.key ?? item.id} · {item.title}
      </strong>
      <span>
        {item.type} · v{item.version} at this snapshot
      </span>
      <button disabled={!ready} onClick={() => onOpen(item.id)}>
        Edit item and connections
      </button>
    </>
  );
}
function EvidenceRow({
  item,
  ready,
  onOpen,
}: {
  item: WorkEvidence;
  ready: boolean;
  onOpen(id: string): void;
}) {
  return (
    <>
      <strong>
        {item.output.key ?? item.output.id} · {item.output.title}
      </strong>
      <span>
        Captured output v{item.output.version} · {item.outcome}
      </span>
      <span>
        {item.changedInputs} changed inputs · {item.unknownInputs} unknown inputs
      </span>
      <p>{item.reviewReason}</p>
      <small>Result {item.receiptId}</small>
      <button disabled={!ready} onClick={() => onOpen(item.receiptId)}>
        Compare inputs and review
      </button>
    </>
  );
}
