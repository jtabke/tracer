import type { Configuration } from "../src/core/configuration.ts";
import type {
  ConfigurationComparison,
  ConfigurationNativeDifference,
  ConfigurationPropertyChange,
  SelectedValue,
} from "../src/core/configuration-comparison.ts";
import { label } from "./entity-label.ts";
import { ConfigurationDetails } from "./configuration-details.tsx";

export function ConfigurationDifferences({ value }: { value: ConfigurationComparison }) {
  return (
    <article aria-label="Exact configuration comparison">
      <h3>
        {value.before.name} → {value.after.name}
      </h3>
      <p>Comparability: {value.comparability.state}. Engineering meaning: not assessed.</p>
      {value.comparability.issues.map((x) => (
        <p key={x.code}>{x.explanation}</p>
      ))}
      <p>
        All selected states compared. Topology {value.completeness.topology}; content{" "}
        {value.completeness.content}. Membership removal is not project deletion. Passage impact is
        not assessed; external bytes are not retained.
      </p>
      <NativeChanges title="Native members" values={value.members} comparison={value} />
      <NativeChanges
        title="Relationships and references"
        values={value.relationships}
        comparison={value}
        relationships
      />
      <section aria-label="Observed content differences">
        <h4>Observed content</h4>
        {!value.content.length && <p>No observed-content selections in this pair.</p>}
        {value.content.map((x) => (
          <article key={x.entityId}>
            <h5>{memberName(value, x.entityId)}</h5>
            <p>
              Observed content: {x.content} · selection{" "}
              {x.selectionChanged ? "changed" : "unchanged"}. This does not establish passage
              relevance.
            </p>
            <p>Before: {contentDescription(value.before, x.entityId)}</p>
            <p>After: {contentDescription(value.after, x.entityId)}</p>
          </article>
        ))}
      </section>
      {value.contextChanges.length > 0 && (
        <details>
          <summary>Captured context and scope changes</summary>
          <PropertyChanges values={value.contextChanges} />
        </details>
      )}
      <details>
        <summary>Exact pair identity and policy</summary>
        <p>
          Before {value.basis.beforeId} · after {value.basis.afterId}
        </p>
        <p>
          {value.basis.policy} · {value.basis.digest}
        </p>
      </details>
      <details>
        <summary>Unchanged and historical before context</summary>
        <ConfigurationDetails value={value.before} />
      </details>
      <details>
        <summary>Unchanged and historical after context</summary>
        <ConfigurationDetails value={value.after} />
      </details>
    </article>
  );
}
function memberName(value: ConfigurationComparison, id: string) {
  const entity =
    value.after.members.find((x) => x.entity.id === id)?.entity ??
    value.before.members.find((x) => x.entity.id === id)?.entity;
  return entity ? label(entity) : id;
}
function NativeChanges({
  title,
  values,
  comparison,
  relationships = false,
}: {
  title: string;
  values: ConfigurationNativeDifference[];
  comparison: ConfigurationComparison;
  relationships?: boolean;
}) {
  const changed = values.filter((x) => x.state !== "unchanged"),
    unchanged = values.filter((x) => x.state === "unchanged");
  const row = (x: ConfigurationNativeDifference) => (
    <article key={x.id}>
      <h5>
        {relationships ? relationshipName(comparison, x.id) : memberName(comparison, x.id)} ·{" "}
        {x.state}
      </h5>
      <p>
        {versions(comparison, x.id, relationships)}
        {x.versionOnly ? " · revision-only change" : ""}
        {x.schemaChanged ? " · schema changed" : ""}
      </p>
      {x.state === "removed" && (
        <p>Removed from selected membership; project deletion is not inferred.</p>
      )}
      {x.changes.length > 0 && <PropertyChanges values={x.changes} />}
    </article>
  );
  return (
    <section aria-label={title}>
      <h4>{title}</h4>
      <p>
        {changed.length} changed or unknown · {unchanged.length} unchanged
      </p>
      {changed.map(row)}
      {unchanged.length > 0 && (
        <details>
          <summary>{unchanged.length} unchanged selections</summary>
          {unchanged.map(row)}
        </details>
      )}
    </section>
  );
}
function relationshipName(value: ConfigurationComparison, id: string) {
  const link =
    value.after.relationships?.find((x) => x.relationship.id === id)?.relationship ??
    value.before.relationships?.find((x) => x.relationship.id === id)?.relationship;
  return link
    ? `${memberName(value, link.source)} → ${link.type} → ${memberName(value, link.target)}`
    : id;
}
function versions(value: ConfigurationComparison, id: string, relationship: boolean) {
  const selected = (capture: Configuration) =>
    relationship
      ? capture.relationships?.find((x) => x.relationship.id === id)?.relationship.version
      : capture.members.find((x) => x.entity.id === id)?.entity.version;
  const display = (version: number | undefined) =>
    version === undefined ? "not selected" : `v${version}`;
  return `${display(selected(value.before))} → ${display(selected(value.after))}`;
}
function contentDescription(value: Configuration, id: string) {
  const content = value.capture?.content.find((x) => x.entityId === id);
  if (!content) return "not selected; content remains unknown";
  if (!content.observation) return `unknown — ${content.reason}`;
  return `${content.observation.availability} · ${content.observation.hash ?? "no hash"} · observation ${content.observation.id}`;
}
function PropertyChanges({ values }: { values: ConfigurationPropertyChange[] }) {
  return (
    <dl>
      {values.map((x, i) => (
        <div key={i}>
          <dt>{x.path.join(" / ") || "whole selected state"}</dt>
          <dd>
            <div>
              Before: <code>{selectedText(x.before)}</code>
            </div>
            <div>
              After: <code>{selectedText(x.after)}</code>
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
}
function selectedText(value: SelectedValue) {
  return value.present ? JSON.stringify(value.value) : "absent";
}
