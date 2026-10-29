import { useState } from "react";
import type { ConfigurationPair } from "../src/core/configuration-comparison.ts";
import type { ConfigurationImpactQuery } from "../src/core/configuration-impact.ts";
import type { Editing } from "./editing.ts";
import { useProjection } from "./use-projection.ts";
import { usePageCursor } from "./use-page-cursor.ts";
import { label } from "./entity-label.ts";

export function ConfigurationDependencies({
  pair,
  editing,
}: {
  pair: ConfigurationPair;
  editing: Editing;
}) {
  const [opened, setOpened] = useState(false),
    [epoch, setEpoch] = useState(0),
    [watermark, setWatermark] = useState<number>();
  const [limit, setLimit] = useState(5);
  const cursor = usePageCursor();
  const query: ConfigurationImpactQuery = {
    beforeId: pair.beforeId,
    afterId: pair.afterId,
    limit,
    after: cursor.after,
    expectedEvidenceRevision: watermark,
  };
  const dependencies = useProjection(
    "/api/configuration-impact",
    opened ? query : undefined,
    epoch + editing.epoch,
    editing.report,
  );
  const restart = () => {
    cursor.reset();
    setWatermark(undefined);
    setEpoch((x) => x + 1);
    setOpened(true);
  };
  return (
    <section aria-label="Declared configuration dependencies">
      <h3>Declared dependencies</h3>
      <p>
        Discover evaluations that explicitly declare selected entities or relationships as inputs.
        Connected or undeclared work is not automatically assessed.
      </p>
      <label>
        Dependency page size
        <select
          aria-label="Dependency page size"
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            cursor.reset();
            setWatermark(undefined);
            setOpened(false);
          }}
        >
          {[1, 5, 10, 25].map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </label>
      <button disabled={dependencies.loading} onClick={restart}>
        {opened ? "Restart dependency discovery" : "Discover declared dependencies"}
      </button>
      {dependencies.loading && <p role="status">Reading declared dependency page…</p>}
      {dependencies.failed && (
        <p role="alert">
          This dependency page could not be checked. The retained page is read only. If evidence
          changed, restart discovery explicitly; use a smaller page if its byte budget was exceeded.
        </p>
      )}
      {opened && (
        <button disabled={dependencies.loading} onClick={() => setEpoch((x) => x + 1)}>
          Retry exact dependency page
        </button>
      )}
      {dependencies.retained && (
        <>
          <p>
            Evidence watermark {dependencies.retained.discovery.evidenceRevision} ·{" "}
            {dependencies.retained.evaluations.items.length} evaluations on this page. Engineering
            impact is not assessed; undeclared dependencies remain unknown.
          </p>
          {dependencies.retained.evaluations.items.map((row) => (
            <article key={row.receipt.id}>
              <h4>
                {label(row.receipt.output)} · {row.receipt.outcome}
              </h4>
              <p>
                Declared dependency change: {row.dependencyChange}. Full input correspondence:
                before {row.before.state} → after {row.after.state}.
              </p>
              <p>Original outcome retained. {row.supersession.count} later superseding results.</p>
              <details>
                <summary>Inclusion and exact selected input states</summary>
                <p>Declared entity matches: {row.inclusion.entityIds.join(", ") || "none"}</p>
                <p>
                  Declared relationship matches:{" "}
                  {row.inclusion.relationshipIds.join(", ") || "none"}
                </p>
                <pre>{JSON.stringify({ before: row.before, after: row.after }, null, 2)}</pre>
              </details>
            </article>
          ))}
          <p>
            {dependencies.retained.evaluations.nextAfter
              ? "More matching evaluations remain outside this page."
              : "End of matching declared population at this evidence watermark; this is not proof of no engineering impact."}
          </p>
          <button disabled={!dependencies.ready || !cursor.hasPrevious} onClick={cursor.previous}>
            Previous dependency page
          </button>
          <button
            disabled={!dependencies.ready || !dependencies.data?.evaluations.nextAfter}
            onClick={() => {
              setWatermark(dependencies.data!.discovery.evidenceRevision);
              cursor.next(dependencies.data?.evaluations.nextAfter);
            }}
          >
            Next dependency page
          </button>
        </>
      )}
    </section>
  );
}
