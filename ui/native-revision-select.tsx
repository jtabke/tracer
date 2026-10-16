import { useState } from "react";
import type { Entity, Revision } from "../src/core/model.ts";
import { usePageCursor } from "./use-page-cursor.ts";
import type { Projection } from "./use-projection.ts";
import { useProjection } from "./use-projection.ts";

export function NativeRevisionSelect({
  entity,
  value,
  onChange,
  allowCurrent = true,
  disabled = false,
  showSelected = true,
  epoch = 0,
}: {
  entity?: Entity;
  value?: number;
  onChange(value: number | undefined): void;
  allowCurrent?: boolean;
  disabled?: boolean;
  showSelected?: boolean;
  epoch?: number;
}) {
  const cursor = usePageCursor();
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(false);
  const history = useProjection(
    "/api/history",
    opened && entity
      ? { kind: "entity", id: entity.id, after: cursor.after, limit: 100 }
      : undefined,
    epoch,
    (error) => setError(String(error)),
  );
  const revisions = history.data?.items.filter((revision) => revision.snapshot !== null) ?? [];
  const selected = revisions.find((revision) => revision.version === value)?.snapshot as
    Entity | undefined;
  return (
    <div className="native-revision-select">
      <label>
        Input revision
        <select
          aria-label="Input revision"
          value={value ?? "current"}
          disabled={!entity || disabled}
          onFocus={() => setOpened(true)}
          onChange={(event) =>
            onChange(event.target.value === "current" ? undefined : Number(event.target.value))
          }
        >
          <RevisionOptions
            entity={entity}
            value={value}
            allowCurrent={allowCurrent}
            revisions={revisions}
          />
        </select>
      </label>
      <button
        type="button"
        disabled={!entity || disabled || history.loading}
        onClick={() => setOpened(true)}
      >
        Browse recorded versions
      </button>
      {opened && <HistoryRead history={history} cursor={cursor} error={error} />}
      {showSelected && <SelectedRevision entity={selected} />}
    </div>
  );
}

function SelectedRevision({ entity }: { entity?: Entity }) {
  if (!entity) return null;
  return (
    <p>
      Selected v{entity.version}:{" "}
      {String(entity.fields.statement ?? entity.fields.title ?? JSON.stringify(entity.fields))}
    </p>
  );
}

function RevisionOptions({
  entity,
  value,
  allowCurrent,
  revisions,
}: {
  entity?: Entity;
  value?: number;
  allowCurrent: boolean;
  revisions: Revision[];
}) {
  return (
    <>
      {" "}
      {allowCurrent && (
        <option value="current">Current at capture{entity ? ` · v${entity.version}` : ""}</option>
      )}
      {value !== undefined && !revisions.some((revision) => revision.version === value) && (
        <option value={value}>Selected exact v{value}</option>
      )}
      {revisions.map((revision) => (
        <option key={revision.revisionId} value={revision.version}>
          Exact v{revision.version} · project revision {revision.projectRevision}
        </option>
      ))}
    </>
  );
}

function HistoryRead({
  history,
  cursor,
  error,
}: {
  history: Projection<"/api/history">;
  cursor: ReturnType<typeof usePageCursor>;
  error: string;
}) {
  return (
    <>
      {history.loading && <p role="status">Loading recorded versions…</p>}
      {!history.loading && !history.data && (
        <p role="alert">{error || "Recorded versions could not be read."}</p>
      )}
      <button
        type="button"
        disabled={history.loading || !cursor.hasPrevious}
        onClick={cursor.previous}
      >
        Earlier version page
      </button>
      <button
        type="button"
        disabled={history.loading || !history.data?.nextAfter}
        onClick={() => cursor.next(history.data!.nextAfter)}
      >
        Later version page
      </button>
    </>
  );
}
