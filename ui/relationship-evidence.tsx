import type { InputComparison, RelationshipComparison } from "../src/core/evidence.ts";
import type { Reference } from "../src/core/references.ts";
import { label } from "./entity-label.ts";

export function RelationshipEvidence({
  inputs = [],
  contentInputs = [],
}: {
  inputs?: RelationshipComparison[];
  contentInputs?: InputComparison[];
}) {
  if (!inputs.length) return null;
  return (
    <section className="evidence-relationships" aria-label="Declared relationship inputs">
      <h3>Declared relationships · {inputs.length}</h3>
      {inputs.map((input) => {
        const captured = input.recorded;
        const reference = captured.relationship.reference;
        return (
          <details
            className="evidence-relationship"
            key={input.id}
            open={input.hasChanged || input.hasUnknown}
          >
            <summary>
              {reference ? reference.role : captured.relationship.type} · {label(captured.target)}
              {reference?.selector && <> · {selectorText(reference.selector)}</>}
              {" · "}
              {input.hasChanged && input.hasUnknown ? "changed · unknown" : input.state}
            </summary>
            <p>
              {label(captured.source)} → {captured.relationship.type} → {label(captured.target)}
            </p>
            <p>
              Captured relationship v{captured.relationship.version} · {input.id}
            </p>
            {captured.role && <p>Use in this evaluation: {captured.role}</p>}
            {reference && (
              <ReferenceSummary
                reference={reference}
                targetId={captured.target.id}
                contentInputs={contentInputs}
              />
            )}
            <p>
              Captured endpoint context: {label(captured.source)} v{captured.source.version} ·{" "}
              {label(captured.target)} v{captured.target.version}. Endpoint context does not declare
              a content dependency.
            </p>
            <ul>
              {input.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <details>
              <summary>Captured reference and endpoint context</summary>
              <pre>{JSON.stringify(captured, null, 2)}</pre>
            </details>
          </details>
        );
      })}
    </section>
  );
}

function ReferenceSummary({
  reference,
  targetId,
  contentInputs,
}: {
  reference: Reference;
  targetId: string;
  contentInputs: InputComparison[];
}) {
  const state = reference.state;
  const observation =
    state.mode === "pinned" && "observationId" in state
      ? contentInputs.find(
          (input) =>
            input.entityId === targetId && input.recorded.observation?.id === state.observationId,
        )?.recorded.observation
      : undefined;
  return (
    <dl className="evidence-reference-summary">
      <div>
        <dt>Reference role</dt>
        <dd>{reference.role}</dd>
      </div>
      {reference.explanation && (
        <div>
          <dt>Why it matters</dt>
          <dd>{reference.explanation}</dd>
        </div>
      )}
      <div>
        <dt>Declared scope</dt>
        <dd>
          {reference.selector
            ? `${reference.selector.kind} · ${selectorText(reference.selector)}`
            : "Whole resource"}
        </dd>
      </div>
      <div>
        <dt>Source selection</dt>
        <dd>
          {state.mode === "current"
            ? "Live reference · latest observed state"
            : "revision" in state
              ? `Pinned native revision v${state.revision}`
              : `Pinned observation · ${state.observationId}`}
        </dd>
      </div>
      {state.mode === "pinned" && "observationId" in state && (
        <div>
          <dt>Pin captured in this evaluation</dt>
          <dd>
            {observation
              ? `${observation.at} · ${observation.availability} · ${observation.hash ?? "Content hash unknown"}`
              : "No matching content input was declared in this evaluation."}
          </dd>
        </div>
      )}
      <div>
        <dt>Passage relevance</dt>
        <dd>Unknown · declared scope is retained without resolving the passage.</dd>
      </div>
    </dl>
  );
}

function selectorText(selector: NonNullable<Reference["selector"]>) {
  return typeof selector.value === "string" ? selector.value : JSON.stringify(selector.value);
}
