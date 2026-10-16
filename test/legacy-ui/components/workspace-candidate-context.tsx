import type { Connections } from "../../../src/application/views.ts";
import type { Entity } from "../../../src/core/model.ts";
import type { Editing } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import { usePageCursor } from "../../../ui/use-page-cursor.ts";
import { useProjection, type Projection } from "../../../ui/use-projection.ts";
import { readable } from "./graph-model.ts";
import { WorkspacePager } from "./workspace-pager.tsx";

export function CandidateContext(props: CandidateContextProps) {
  return <CandidateConnections key={props.entity.id} {...props} />;
}

type CandidateContextProps = {
  entity: Entity;
  editing: Editing;
  candidate?: boolean;
  disabled?: boolean;
  onNavigate?(entity: Entity): void;
};

function CandidateConnections({
  entity,
  editing,
  candidate = true,
  disabled = false,
  onNavigate,
}: CandidateContextProps) {
  const cursor = usePageCursor();
  const read = useProjection(
    "/api/connections",
    { id: entity.id, after: cursor.after, limit: 10 },
    editing.epoch,
    editing.report,
  );
  const content = (
    <>
      <ConnectionReading
        read={read}
        entity={entity}
        candidate={candidate}
        disabled={disabled || !read.ready}
        onNavigate={onNavigate}
      />
      <WorkspacePager
        noun="connections"
        previous={cursor.hasPrevious}
        next={read.ready && !!read.data?.nextAfter}
        paused={read.loading}
        onPrevious={cursor.previous}
        onNext={() => cursor.next(read.data?.nextAfter)}
      />
    </>
  );
  if (candidate)
    return (
      <details className="candidate-context" open>
        <summary>Candidate’s recorded connections</summary>
        {content}
      </details>
    );
  return (
    <section className="recorded-connections" aria-label="Recorded connections">
      <h3>Recorded connections</h3>
      {content}
    </section>
  );
}

function ConnectionReading({
  read,
  entity,
  candidate,
  disabled,
  onNavigate,
}: {
  read: Projection<"/api/connections">;
  entity: Entity;
  candidate: boolean;
  disabled: boolean;
  onNavigate?(entity: Entity): void;
}) {
  if (read.loading) return <p>Reading connections…</p>;
  if (!read.data) return <p>Connections unavailable. The selected item is retained.</p>;
  return (
    <>
      <small>
        {read.data.items.length} / {read.data.total} connections loaded
      </small>
      {candidate && read.data.entity.version !== entity.version && (
        <p className="mapping-old">
          Candidate has changed since selection. Recording still checks captured v{entity.version}.
        </p>
      )}
      <ul>
        {read.data.items.map((connection) => (
          <RecordedConnection
            key={connection.relationship.id}
            connection={connection}
            entityId={entity.id}
            disabled={disabled}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
      {!read.data.total && <p>No recorded connections.</p>}
    </>
  );
}

function RecordedConnection({
  connection: { relationship, source, target },
  entityId,
  disabled,
  onNavigate,
}: {
  connection: Connections["items"][number];
  entityId: string;
  disabled: boolean;
  onNavigate?(entity: Entity): void;
}) {
  const outgoing = source.id === entityId;
  const other = outgoing ? target : source;
  const arrow = source.id === target.id ? "↻" : outgoing ? "→" : "←";
  const meaning = readable(relationship.type);
  const title = other.fields.title;
  return (
    <li className="recorded-connection">
      <small>
        {arrow} {meaning}
      </small>
      {onNavigate ? (
        <button
          className="recorded-endpoint"
          aria-label={`Inspect ${label(other)} via ${meaning}`}
          disabled={disabled}
          onClick={() => onNavigate(other)}
        >
          <strong>{label(other)}</strong>
          {typeof title === "string" && title !== label(other) && <span>{title}</span>}
        </button>
      ) : (
        <span>
          {label(source)} → {meaning} → {label(target)}
        </span>
      )}
      {relationship.fields.scope != null && <small>{String(relationship.fields.scope)}</small>}
    </li>
  );
}
