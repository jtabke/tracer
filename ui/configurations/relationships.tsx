import { useState } from "react";
import type { Entity, Relationship } from "../../src/core/model.ts";
import { useProjection } from "../use-projection.ts";
import { usePageCursor } from "../use-page-cursor.ts";
import { RecordChoice, useApplicationDirty } from "../application-choices.tsx";
import { label } from "../entity-label.ts";

export function ConfigurationRelationships({
  entities,
  memberIds,
  value,
  onChange,
  epoch,
  report,
  onReady,
}: {
  entities: Entity[];
  memberIds: string[];
  value: Relationship[];
  onChange(value: Relationship[]): void;
  epoch: number;
  report(error: unknown): void;
  onReady(value: boolean): void;
}) {
  const [incident, setIncident] = useState("");
  const cursor = usePageCursor();
  const links = useProjection(
    "/api/relationships",
    incident ? { incident, limit: 25, after: cursor.after } : undefined,
    epoch,
    report,
  );
  useApplicationDirty(!incident || links.ready, onReady);
  const add = (link: Relationship) => onChange([...value, link]);
  const name = (id: string) => {
    const entity = entities.find((x) => x.id === id);
    return entity ? label(entity) : id;
  };
  return (
    <section aria-label="Explicit configuration relationships">
      <h3>Relationships</h3>
      <p>
        {value.length} selected. Unselected relationships are outside this capture; connectivity
        does not add members automatically.
      </p>
      {value.map((link) => (
        <article key={link.id}>
          <p>
            {name(link.source)} → {link.type} → {name(link.target)} · exact v{link.version}
          </p>
          <RelationshipRevision
            value={link}
            epoch={epoch}
            report={report}
            onChange={(next) => onChange(value.map((x) => (x.id === next.id ? next : x)))}
          />
          <button onClick={() => onChange(value.filter((x) => x.id !== link.id))}>
            Remove relationship {link.id.slice(0, 8)}
          </button>
        </article>
      ))}
      <RecordChoice
        name="Browse relationships of member"
        entities={entities.filter((x) => memberIds.includes(x.id))}
        value={incident}
        onChange={(id) => {
          setIncident(id);
          cursor.reset();
        }}
      />
      {links.failed && (
        <p role="alert">
          Relationship choices could not be read. Capture is paused until a successful refresh.
        </p>
      )}
      {links.retained?.items.map((link) => (
        <div key={link.id}>
          <span>
            {name(link.source)} → {link.type} → {name(link.target)} · v{link.version}
          </span>{" "}
          <button
            disabled={
              !links.ready ||
              value.length >= 200 ||
              value.some((x) => x.id === link.id) ||
              !memberIds.includes(link.source) ||
              !memberIds.includes(link.target)
            }
            onClick={() => add(link)}
          >
            Include relationship {link.id.slice(0, 8)}
          </button>
        </div>
      ))}
      {incident && (
        <>
          <p>Both endpoints must be explicitly selected members before including a relationship.</p>
          <button disabled={!links.ready || !cursor.hasPrevious} onClick={cursor.previous}>
            Previous relationships
          </button>
          <button
            disabled={!links.ready || !links.data?.nextAfter}
            onClick={() => cursor.next(links.data?.nextAfter)}
          >
            Next relationships
          </button>
        </>
      )}
    </section>
  );
}
function RelationshipRevision({
  value,
  epoch,
  report,
  onChange,
}: {
  value: Relationship;
  epoch: number;
  report(error: unknown): void;
  onChange(value: Relationship): void;
}) {
  const [browse, setBrowse] = useState(false),
    cursor = usePageCursor();
  const history = useProjection(
    "/api/history",
    browse ? { kind: "relationship", id: value.id, limit: 25, after: cursor.after } : undefined,
    epoch,
    report,
  );
  const versions = (history.retained?.items ?? []).flatMap((x) =>
    x.snapshot && "source" in x.snapshot ? [x.snapshot] : [],
  );
  return (
    <details onToggle={(e) => setBrowse(e.currentTarget.open)}>
      <summary>Choose a recorded relationship revision</summary>
      {history.failed && (
        <p role="alert">History could not be read. The explicit previous selection is retained.</p>
      )}
      <select
        aria-label={`Relationship revision ${value.id.slice(0, 8)}`}
        value={value.version}
        disabled={!history.ready}
        onChange={(e) => {
          const selected = versions.find((x) => x.version === Number(e.target.value));
          if (selected) onChange(selected);
        }}
      >
        {!versions.some((x) => x.version === value.version) && (
          <option value={value.version}>Selected exact v{value.version}</option>
        )}
        {versions.map((x) => (
          <option key={x.version} value={x.version}>
            Exact v{x.version} · {x.type}
          </option>
        ))}
      </select>
      <button disabled={!history.ready || !cursor.hasPrevious} onClick={cursor.previous}>
        Previous relationship revisions
      </button>
      <button
        disabled={!history.ready || !history.data?.nextAfter}
        onClick={() => cursor.next(history.data?.nextAfter)}
      >
        Next relationship revisions
      </button>
    </details>
  );
}
