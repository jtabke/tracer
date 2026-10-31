import { useRef, useState } from "react";
import type { Configuration, PinnedEntity } from "../../src/core/configuration.ts";
import { label } from "../entity-label.ts";
import { statementText } from "../statement-text.ts";
import { ConfigurationSelectedStates } from "./selected-states.tsx";

/** Every row and statement comes from this exact immutable capture. */
export function ConfigurationDetails({ value }: { value: Configuration }) {
  const [selected, setSelected] = useState(value.members[0]?.entity.id ?? "");
  const pin = value.members.find((member) => member.entity.id === selected) ?? value.members[0];
  const reading = useRef<HTMLElement>(null);
  const choose = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => {
      reading.current?.scrollIntoView({ block: "start" });
      reading.current?.querySelector<HTMLElement>("h4")?.focus({ preventScroll: true });
    });
  };
  return (
    <article className="configuration-details" aria-label="Pinned configuration">
      <header>
        <h3 tabIndex={-1}>{value.name}</h3>
        <p>
          {label(value.subject)} · captured subject v{value.subject.version} ·{" "}
          {value.at.slice(0, 10)}
        </p>
        {value.reason && <p>{value.reason}</p>}
      </header>
      <div className="configuration-member-layout">
        <section className="configuration-member-list" aria-label="Complete pinned members">
          <h4>{value.members.length} pinned native members</h4>
          <ul>
            {value.members.map((member) => (
              <li key={member.entity.id}>
                <button
                  aria-label={`Inspect pinned member ${label(member.entity)} v${member.entity.version}`}
                  aria-pressed={pin?.entity.id === member.entity.id}
                  onClick={() => choose(member.entity.id)}
                >
                  <strong>
                    {label(member.entity)} · pinned v{member.entity.version}
                  </strong>
                  {member.entity.fields.title !== label(member.entity) &&
                    typeof member.entity.fields.title === "string" && (
                      <span>{member.entity.fields.title}</span>
                    )}
                </button>
              </li>
            ))}
          </ul>
        </section>
        {pin && <PinnedMemberReading pin={pin} reading={reading} />}
      </div>
      <ConfigurationSelectedStates value={value} />
      <details className="configuration-identity">
        <summary>Capture identity and provenance</summary>
        <p>
          {value.id} · {value.actor} · {value.at}
        </p>
      </details>
      <small className="configuration-boundary">
        Members remain fixed at their captured native revisions. This capture does not establish
        release approval or external artifact contents.
      </small>
    </article>
  );
}

function PinnedMemberReading({
  pin,
  reading,
}: {
  pin: PinnedEntity;
  reading: React.RefObject<HTMLElement | null>;
}) {
  return (
    <section
      className="configuration-member-reading"
      aria-label="Selected pinned member"
      ref={reading}
    >
      <small>
        {label(pin.entity)} · pinned v{pin.entity.version}
      </small>
      <h4 tabIndex={-1}>{String(pin.entity.fields.title ?? label(pin.entity))}</h4>
      <p className="configuration-pinned-statement">
        {pin.entity.fields.statement != null || pin.entity.fields.title != null
          ? statementText(pin.entity)
          : JSON.stringify(pin.entity.fields, null, 2)}
      </p>
      <p className="configuration-pin-version">
        Captured project revision {pin.projectRevision} · schema v{pin.schema.version}
      </p>
      <details>
        <summary>Captured revision provenance</summary>
        <small>
          Revision {pin.revisionId} · changeset {pin.changesetId}
        </small>
        <pre>{JSON.stringify(pin.entity.fields, null, 2)}</pre>
      </details>
    </section>
  );
}
