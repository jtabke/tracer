import type { Changeset } from "../../../src/core/model.ts";

export function GraphTimeline({
  atRevision,
  compareRevision,
  historical,
  items = [],
  nextBefore,
  loading,
  timelineBefore,
  setTimelineBefore,
  changeTime,
}: {
  atRevision?: number;
  compareRevision?: number;
  historical: boolean;
  items?: Changeset[];
  nextBefore?: number;
  loading: boolean;
  timelineBefore?: number;
  setTimelineBefore: (value: number | undefined) => void;
  changeTime: (at?: number, before?: number) => void;
}) {
  return (
    <>
      <div className="toolbar" aria-label="Native timeline">
        <NativeRevision
          items={items}
          atRevision={atRevision}
          compareRevision={compareRevision}
          historical={historical}
          changeTime={changeTime}
        />
        <CompareFrom
          items={items}
          atRevision={atRevision}
          compareRevision={compareRevision}
          historical={historical}
          changeTime={changeTime}
        />
        <HistoryScrubber
          items={items}
          atRevision={atRevision}
          compareRevision={compareRevision}
          changeTime={changeTime}
        />
        <div className="graph-history-pages" role="group" aria-label="History pages">
          <button
            aria-label="Earlier revisions"
            title="Earlier revisions"
            disabled={!nextBefore || loading}
            onClick={() => setTimelineBefore(nextBefore)}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            aria-label="Latest revisions"
            title="Latest revisions"
            disabled={!timelineBefore}
            onClick={() => setTimelineBefore(undefined)}
          >
            <span aria-hidden="true">↥</span>
          </button>
        </div>
        {historical && <button onClick={() => changeTime()}>Return to current</button>}
      </div>
    </>
  );
}

type RevisionControl = {
  items: Changeset[];
  atRevision?: number;
  compareRevision?: number;
  historical: boolean;
  changeTime: (at?: number, before?: number) => void;
};
function NativeRevision({
  items,
  atRevision,
  compareRevision,
  historical,
  changeTime,
}: RevisionControl) {
  return (
    <label>
      Native revision
      <select
        aria-label="Native revision"
        value={atRevision ?? ""}
        onChange={(event) =>
          changeTime(event.target.value ? Number(event.target.value) : undefined, compareRevision)
        }
      >
        <option value="">Current · editable</option>
        {historical && !items.some((item) => item.projectRevision === atRevision) && (
          <option value={atRevision}>Revision {atRevision}</option>
        )}
        {items.map((item) => (
          <option key={item.id} value={item.projectRevision}>
            {item.projectRevision} · {item.actor} · {item.at} · {item.reason}
          </option>
        ))}
      </select>
    </label>
  );
}
function CompareFrom({
  items,
  atRevision,
  compareRevision,
  historical,
  changeTime,
}: RevisionControl) {
  return (
    <label>
      Compare from
      <select
        aria-label="Compare from"
        value={compareRevision ?? ""}
        disabled={!historical}
        onChange={(event) =>
          changeTime(atRevision, event.target.value ? Number(event.target.value) : undefined)
        }
      >
        <option value="">Single snapshot</option>
        {compareRevision && !items.some((item) => item.projectRevision === compareRevision) && (
          <option value={compareRevision}>Revision {compareRevision}</option>
        )}
        {items.map((item) => (
          <option key={item.id} value={item.projectRevision}>
            Revision {item.projectRevision}
          </option>
        ))}
      </select>
    </label>
  );
}
function HistoryScrubber({
  items,
  atRevision,
  compareRevision,
  changeTime,
}: Omit<RevisionControl, "historical">) {
  return (
    <>
      {items.length ? (
        <label className="graph-history-scrubber">
          Scrub loaded native history
          <input
            type="range"
            aria-label="Scrub native history"
            min="0"
            max={items.length - 1}
            value={
              atRevision === undefined
                ? items.length - 1
                : Math.max(
                    0,
                    items.findIndex((item) => item.projectRevision === atRevision),
                  )
            }
            onChange={(event) =>
              changeTime(items![Number(event.target.value)].projectRevision, compareRevision)
            }
          />
        </label>
      ) : null}
    </>
  );
}
