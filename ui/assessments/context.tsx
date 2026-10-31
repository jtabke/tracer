import type { Entity } from "../../src/core/model.ts";
import type { Configuration } from "../../src/core/configuration.ts";
import type { Editing } from "../editing.ts";
import { useProjection } from "../use-projection.ts";

type ScopeIdentity = { rootId: string } & (
  { beforeId: string; afterId: string } | { baselineId: string }
);
type ContextProps = {
  title: string;
  query: ScopeIdentity;
  entities: Entity[];
  epoch: number;
  report: Editing["report"];
  basis?: { projectRevision: number; evidenceRevision: number };
  assessmentId?: string;
  name?: string;
  sticky?: boolean;
  changed?: boolean;
};

/** Names are display metadata only; all reads and commands retain the exact selected IDs. */
export function AssessmentContext({
  title,
  query,
  entities,
  epoch,
  report,
  basis,
  assessmentId,
  name = "Assessment context",
  sticky = true,
  changed = false,
}: ContextProps) {
  const metadata = useScopeMetadata(query, epoch, report);
  const root =
    configurationRoot(metadata.after, query.rootId) ??
    configurationRoot(metadata.before, query.rootId) ??
    entities.find((entity) => entity.id === query.rootId);
  return (
    <section
      className={`assessment-context${sticky ? "" : " assessment-context-inline"}`}
      aria-label={name}
    >
      <strong>{title}</strong>
      <span>Investigation root: {readableRoot(root, query.rootId)}</span>
      <ScopeNames query={query} metadata={metadata} captured={Boolean(assessmentId)} />
      {basis && (
        <span>
          Captured basis: native r{basis.projectRevision} / evidence {basis.evidenceRevision}
          {changed ? " · proposal or inputs changed; explicit adoption required" : ""}
        </span>
      )}
      {metadata.unavailable && (
        <span>Some display names could not be read. Exact selections are unchanged.</span>
      )}
      <ExactIdentities query={query} assessmentId={assessmentId} />
    </section>
  );
}

function useScopeMetadata(query: ScopeIdentity, epoch: number, report: Editing["report"]) {
  const pair = "beforeId" in query ? query : { beforeId: "", afterId: "" };
  const baselineId = "baselineId" in query ? query.baselineId : "";
  const before = useProjection("/api/configuration", lookup(pair.beforeId), epoch, report);
  const after = useProjection("/api/configuration", lookup(pair.afterId), epoch, report);
  const baseline = useProjection("/api/baseline", lookup(baselineId), epoch, report);
  return {
    before: matchingIdentity(before.retained, pair.beforeId),
    after: matchingIdentity(after.retained, pair.afterId),
    baseline: matchingIdentity(baseline.retained, baselineId),
    unavailable: before.failed || after.failed || baseline.failed,
  };
}
function lookup(id: string) {
  return id ? { id } : undefined;
}
function matchingIdentity<T extends { id: string }>(value: T | undefined, id: string) {
  return value?.id === id ? value : undefined;
}
function configurationRoot(configuration: Configuration | undefined, rootId: string) {
  return configuration?.members.find((member) => member.entity.id === rootId)?.entity;
}
function readableRoot(root: Entity | undefined, rootId: string) {
  const name = root?.key ?? root?.fields.title ?? root?.fields.name ?? root?.resource?.label;
  if (typeof name === "string" && name.trim()) return name;
  return rootId ? "Record name unavailable" : "Not selected";
}
function configurationName(name: string | undefined, id: string, side: string) {
  if (name) return name;
  return id ? `${side} name unavailable` : `Choose ${side.toLowerCase()}`;
}
function ScopeNames({
  query,
  metadata,
  captured,
}: {
  query: ScopeIdentity;
  metadata: ReturnType<typeof useScopeMetadata>;
  captured: boolean;
}) {
  if ("beforeId" in query)
    return (
      <span>
        Exact pair: {configurationName(metadata.before?.name, query.beforeId, "Before")} →{" "}
        {configurationName(metadata.after?.name, query.afterId, "After")}
      </span>
    );
  const name = metadata.baseline?.name ?? (query.baselineId ? "Name unavailable" : "Not selected");
  return (
    <span>
      Baseline: {name} → {captured ? "captured current scope" : "current scope"}
    </span>
  );
}
function ExactIdentities({ query, assessmentId }: { query: ScopeIdentity; assessmentId?: string }) {
  return (
    <details>
      <summary>Exact identities</summary>
      {assessmentId && <p>Assessment: {assessmentId}</p>}
      <p>Investigation root: {query.rootId || "Not selected"}</p>
      {"beforeId" in query ? (
        <>
          <p>Before configuration: {query.beforeId || "Not selected"}</p>
          <p>After configuration: {query.afterId || "Not selected"}</p>
        </>
      ) : (
        <p>Baseline: {query.baselineId || "Not selected"}</p>
      )}
    </details>
  );
}
