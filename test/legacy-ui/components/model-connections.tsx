import { useEffect, useRef } from "react";
import type { EndpointSummary } from "../../../src/application/views.ts";
import type { Page, Relationship } from "../../../src/core/model.ts";
import { usePageCursor } from "../../../ui/use-page-cursor.ts";
import { useProjection } from "../../../ui/use-projection.ts";
export function RecordedConnections({
  name,
  epoch,
  report,
  onInspect,
  onBack,
}: {
  name: string;
  epoch: number;
  report(error: unknown): void;
  onInspect(id: string): void;
  onBack(): void;
}) {
  const cursor = usePageCursor();
  const page = useProjection(
    "/api/model-connections",
    { type: name, limit: 25, after: cursor.after },
    epoch,
    report,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (page.loading) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start" });
  }, [page.loading, page.data]);
  return (
    <section aria-label="Recorded connections">
      <h3 tabIndex={-1} ref={heading}>
        Recorded connections · {name}
      </h3>
      <p>
        Recorded connections · page of up to 25. Endpoint summaries are current recorded items, not
        allowed type sets. Inspect for full content. No project-wide total is available.
      </p>
      <button onClick={onBack}>Back to model</button>
      {page.loading ? (
        <p role="status">Loading connections…</p>
      ) : !page.data ? (
        <p role="alert">Connection read failed. Refresh to retry.</p>
      ) : (
        <>
          <ConnectionPageStatus page={page.data.relationships} />
          <ul className="model-records">
            {page.data.relationships.items.map((link) => (
              <li key={link.id}>
                <small>Connection ID: {link.id}</small>
                <div className="model-direction">
                  <RecordedEndpoint
                    id={link.source}
                    side="source"
                    endpoints={page.data!.endpoints}
                    onInspect={onInspect}
                  />
                  <span>→ {link.type} →</span>
                  <RecordedEndpoint
                    id={link.target}
                    side="target"
                    endpoints={page.data!.endpoints}
                    onInspect={onInspect}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="toolbar">
            <button disabled={!cursor.hasPrevious} onClick={cursor.previous}>
              Previous connections
            </button>
            <button
              disabled={!page.data.relationships.nextAfter}
              onClick={() => cursor.next(page.data?.relationships.nextAfter)}
            >
              Next connections
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function ConnectionPageStatus({ page }: { page: Page<Relationship> }) {
  return (
    <>
      {" "}
      <p role="status">
        {page.items.length} shown{page.nextAfter ? "; more available" : "; end of results"}
      </p>
      {!page.items.length && (
        <p>No recorded connections of this relationship type on this page.</p>
      )}{" "}
    </>
  );
}

function RecordedEndpoint({
  id,
  side,
  endpoints,
  onInspect,
}: {
  id: string;
  side: "source" | "target";
  endpoints: EndpointSummary[];
  onInspect(id: string): void;
}) {
  const endpoint = endpoints.find((item) => item.id === id);
  return (
    <div>
      <small>{side === "source" ? "Source" : "Target"}</small>
      {endpoint ? <EndpointIdentity endpoint={endpoint} /> : <p>Item summary unavailable</p>}
      <button onClick={() => onInspect(id)}>
        Inspect {side} {id}
      </button>
    </div>
  );
}

function EndpointIdentity({ endpoint }: { endpoint: EndpointSummary }) {
  return (
    <>
      <strong>{endpoint.key ?? endpoint.title ?? "Item without key or title"}</strong>
      {endpoint.key && <div>{endpoint.title}</div>}
      <small>Type: {endpoint.type}</small>
    </>
  );
}
