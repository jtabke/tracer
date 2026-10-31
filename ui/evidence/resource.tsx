import type { Observation } from "../../src/core/evidence.ts";
import type { Entity } from "../../src/core/model.ts";

export function ResourceIdentity({ entity }: { entity: Entity }) {
  return (
    <dl className="evidence-resource-identity">
      <div>
        <dt>Resource ID</dt>
        <dd>{entity.id}</dd>
      </div>
      {entity.resource?.source && (
        <div>
          <dt>Source identity</dt>
          <dd>
            {entity.resource.source.system} · {entity.resource.source.externalId}
          </dd>
        </div>
      )}
    </dl>
  );
}

export function ObservedContent({
  recorded,
  current,
}: {
  recorded: Observation;
  current: Observation | null;
}) {
  return (
    <section className="evidence-observed-content" aria-label="Observed content comparison">
      <h5>Observed content</h5>
      <div className="evidence-content-states">
        <ObservationState title="Captured for this evaluation" observation={recorded} />
        <ObservationState title="Latest observed" observation={current} />
      </div>
      <p className="evidence-content-limit">
        Source text is not retained in these observations. A content hash change does not identify a
        changed passage; passage relevance remains unknown.
      </p>
      <details>
        <summary>Observation records</summary>
        <pre>{JSON.stringify({ recorded, lastObserved: current }, null, 2)}</pre>
      </details>
    </section>
  );
}

function ObservationState({
  title,
  observation,
}: {
  title: string;
  observation: Observation | null;
}) {
  return (
    <section aria-label={title}>
      <h6>{title}</h6>
      {observation ? (
        <>
          <p>
            {observation.availability === "available"
              ? "Available when observed"
              : "Availability unknown"}
          </p>
          <dl>
            <div>
              <dt>Observed</dt>
              <dd>{observation.at}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                {observation.locator.system} · {observation.locator.path}
              </dd>
            </div>
            {observation.locator.system === "git" && (
              <div>
                <dt>Repository / ref</dt>
                <dd>
                  {observation.locator.repository} · {observation.locator.ref}
                </dd>
              </div>
            )}
            <div>
              <dt>Content hash</dt>
              <dd>
                <code>{observation.hash ?? "Unknown"}</code>
              </dd>
            </div>
            {observation.commit && (
              <div>
                <dt>Commit</dt>
                <dd>
                  <code>{observation.commit}</code>
                </dd>
              </div>
            )}
          </dl>
          {observation.reason && <p>{observation.reason}</p>}
        </>
      ) : (
        <p>No latest observation is recorded. Current content availability is unknown.</p>
      )}
    </section>
  );
}
