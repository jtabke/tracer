import { useState } from "react";
import { ConfigurationDetails } from "../../../ui/configurations.tsx";
import { usePageCursor } from "../../../ui/use-page-cursor.ts";
import { useProjection } from "../../../ui/use-projection.ts";

export function WorkspaceConfigurations({ entityId, epoch }: { entityId: string; epoch: number }) {
  const [opened, setOpened] = useState(false);
  return (
    <details
      className="workspace-configurations"
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary>Captured configurations</summary>
      {opened && <ConfigurationList entityId={entityId} epoch={epoch} />}
    </details>
  );
}
function ConfigurationList({ entityId, epoch }: { entityId: string; epoch: number }) {
  const cursor = usePageCursor();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const read = useProjection(
    "/api/configurations",
    { subject: entityId, after: cursor.after, limit: 5 },
    epoch + retry,
    (error) => setError(String(error)),
  );
  return (
    <div>
      {read.loading && <p role="status">Loading captured configurations…</p>}
      {!read.loading && !read.data && (
        <p role="alert">{error || "Configurations could not be read."}</p>
      )}
      {read.data?.items.length === 0 && (
        <p>
          No immutable configuration captures for this item. A manifest field or membership link
          alone is a navigation annotation.
        </p>
      )}
      {read.data?.items.map((value) => (
        <details key={value.id}>
          <summary>
            {value.name} · {value.at}
          </summary>
          <ConfigurationDetails value={value} />
        </details>
      ))}
      <div className="toolbar">
        <button disabled={read.loading} onClick={() => setRetry((value) => value + 1)}>
          Refresh captured configurations
        </button>
        <button disabled={read.loading || !cursor.hasPrevious} onClick={cursor.previous}>
          Previous captured configurations
        </button>
        <button
          disabled={read.loading || !read.data?.nextAfter}
          onClick={() => cursor.next(read.data!.nextAfter)}
        >
          Next captured configurations
        </button>
      </div>
      <small>
        Capture another build in Configurations, then record its evaluated inputs in Evaluations.
      </small>
    </div>
  );
}
