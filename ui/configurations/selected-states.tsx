import type { Configuration } from "../../src/core/configuration.ts";
import { label } from "../entity-label.ts";

export function ConfigurationSelectedStates({ value }: { value: Configuration }) {
  const capture = value.capture;
  if (!capture)
    return (
      <p>
        Legacy native-only capture: content and scope completeness were not declared.{" "}
        {value.relationships === undefined
          ? "Topology is unknown."
          : "Only explicitly recorded relationships are selected."}
      </p>
    );
  const name = (id: string) => {
    const entity = value.members.find((x) => x.entity.id === id)?.entity;
    return entity ? label(entity) : id;
  };
  return (
    <section aria-label="Controlled capture scope">
      <p>{capture.intent.scope.purpose}</p>
      <p>
        Declared coverage: {capture.intent.scope.coverage}. {capture.intent.scope.rationale}
      </p>
      <p>
        Native r{capture.context.projectRevision} · schema v{capture.context.schema.version} ·
        evidence {capture.context.evidenceRevision}
      </p>
      <details>
        <summary>{value.relationships?.length ?? 0} exact relationship selections</summary>
        {value.relationships?.map((x) => (
          <article key={x.relationship.id}>
            <p>
              {name(x.relationship.source)} → {x.relationship.type} → {name(x.relationship.target)}{" "}
              · pinned v{x.relationship.version}
            </p>
            {x.relationship.reference && (
              <>
                <p>
                  {x.relationship.reference.role}: {x.relationship.reference.explanation}
                </p>
                <pre>{JSON.stringify(x.relationship.reference, null, 2)}</pre>
              </>
            )}
          </article>
        ))}
      </details>
      <details>
        <summary>{capture.content.length} observed-content selections</summary>
        {capture.content.map((x) => (
          <article key={x.entityId}>
            <p>
              {name(x.entityId)}:{" "}
              {x.observation
                ? `${x.observation.availability} · ${x.observation.hash ?? "no hash"} · observation ${x.observation.id}`
                : `unknown — ${x.reason}`}
            </p>
          </article>
        ))}
        <p>
          Omitted content remains unselected. Hashes identify observed content; external bytes are
          not retained and passage relevance is not assessed.
        </p>
      </details>
    </section>
  );
}
