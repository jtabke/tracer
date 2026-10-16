import { useEffect, useEffectEvent, useState } from "react";
import type { Graph } from "../../../src/application/views.ts";
import type { ReviewInput } from "../../../src/core/evidence.ts";
import type { Entity } from "../../../src/core/model.ts";
import type { Editing } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import { ObjectEditor } from "../../../ui/object-editor.tsx";
import type { GraphEdge } from "./graph-model.ts";
import { readable, title } from "./graph-model.ts";
export function GraphInspector({
  graph,
  node,
  edge,
  receiptId,
  editing,
  onDirty,
  onNavigate,
  onReceipt,
  changed,
  disabled,
}: {
  graph: Graph;
  node?: Entity;
  edge?: GraphEdge;
  receiptId?: string;
  editing: Editing;
  onDirty: (dirty: boolean) => void;
  onNavigate: (id: string) => void;
  onReceipt: (id: string) => void;
  changed: () => void;
  disabled: boolean;
}) {
  const [fieldDirty, setFieldDirty] = useState(false);
  const evaluations = graph.evaluations.filter(
    (value) =>
      value.receipt.output.id === node?.id ||
      value.receipt.inputs.some((input) => input.entityId === node?.id),
  );
  const selected = graph.evaluations.find(
    (value) => value.receipt.id === (receiptId ?? edge?.receiptId),
  );
  const {
    rationale,
    setRationale,
    decision,
    setDecision,
    saving,
    notice,
    setNotice,
    reviewToken,
    setReviewToken,
    review,
  } = useGraphReview(selected, changed, editing);
  const named = (id: string) =>
    label(
      graph.nodes.find((value) => value.id === id) ??
        selected?.comparison.inputs.find((input) => input.entityId === id)?.recorded.entity ?? {
          id,
          type: "",
          fields: {},
          version: 0,
        },
    );
  const notifyDirty = useEffectEvent(onDirty);
  useEffect(() => {
    notifyDirty(fieldDirty || rationale.trim().length > 0);
  }, [fieldDirty, rationale]);
  const source = graph.external.find((value) => value.identity.id === node?.id);
  const [observing, setObserving] = useState(false);
  const observe = async () => {
    if (!source?.observation) return;
    setObserving(true);
    try {
      const saved = await editing.mutate("/api/observations", {
        entityId: source.identity.id,
        locator: source.observation.locator,
      });
      if (!saved) return;
      setNotice("New local observation recorded; comparisons refreshed.");
      changed();
    } catch (error) {
      editing.report(error);
    } finally {
      setObserving(false);
    }
  };
  const relationship = edge?.relationshipId
    ? (graph.links.find((value) => value.id === edge.relationshipId) ?? edge.relationship)
    : undefined;
  const peers = node
    ? graph.links.filter((link) => link.source === node.id || link.target === node.id)
    : [];
  function renderExternalSource() {
    return (
      <>
        {source && (
          <div className="graph-source">
            <h3>External source</h3>
            <p>
              {source.identity.system} · {source.identity.externalId}
            </p>
            <p>
              Last observed: {source.observation?.availability ?? "not observed"} ·{" "}
              {source.observation?.at ?? "unknown"}
            </p>
            <button
              disabled={disabled || observing || !source.observation}
              onClick={() => void observe()}
            >
              Observe local source again
            </button>
            <small>
              Committed Git file or local file only. Editing these Tracer fields does not modify the
              external source.
            </small>
            <details>
              <summary>Source location and version</summary>
              <pre>{JSON.stringify(source.observation, null, 2)}</pre>
            </details>
          </div>
        )}
      </>
    );
  }
  function renderPeers() {
    if (!node) return null;
    return (
      <>
        <h3>Connections</h3>
        {peers.length ? (
          peers.map((link) => (
            <button
              className="graph-peer"
              key={link.id}
              onClick={() => onNavigate(link.source === node.id ? link.target : link.source)}
            >
              {link.source === node.id ? "→" : "←"} {readable(link.type)} ·{" "}
              {named(link.source === node.id ? link.target : link.source)}
            </button>
          ))
        ) : (
          <p>No visible connections. Expand the node to look for more.</p>
        )}
      </>
    );
  }
  function renderEvaluations() {
    return (
      <>
        <h3>Evaluations connected to this node</h3>
        {evaluations.length ? (
          evaluations.map((value) => (
            <button
              key={value.receipt.id}
              className="graph-peer"
              aria-label={
                value.receipt.output.id === node?.id
                  ? value.receipt.outcome
                  : label(value.receipt.output) + " — " + value.receipt.outcome
              }
              aria-description={`${value.comparison.state}; ${value.comparison.review.state}`}
              onClick={() => onReceipt(value.receipt.id)}
            >
              {value.receipt.output.id !== node?.id ? label(value.receipt.output) + " — " : ""}
              {value.receipt.outcome}
              <small>
                {value.comparison.state} · {value.comparison.review.state}
                {value.comparison.supersededBy.length ? " · superseded" : ""}
              </small>
            </button>
          ))
        ) : (
          <p>No recorded evaluations for this output.</p>
        )}
      </>
    );
  }
  function renderNativeNode() {
    return (
      <>
        {node && (
          <>
            <h2>{label(node)}</h2>
            <p>{title(node)}</p>
            <small>
              {readable(node.type)} · version {node.version}
            </small>
            {renderExternalSource()}
            <ObjectEditor
              key={node.id}
              value={node}
              definition={graph.schema.entityTypes[node.type] ?? { fields: {} }}
              schemaVersion={graph.schema.version}
              editing={editing}
              onDirty={setFieldDirty}
              disabled={disabled || !graph.nodes.some((value) => value.id === node.id)}
              local
            />
            {renderPeers()}
            {renderEvaluations()}
          </>
        )}
      </>
    );
  }
  function renderNativeEdge() {
    return (
      <>
        {edge && (
          <>
            <h2>{edge.name}</h2>
            <p>
              {named(edge.source)} → {named(edge.target)}
            </p>
            <p>
              {edge.receiptId
                ? "Declared evaluation dependency. This input is explicitly recorded in immutable evidence."
                : "Ordinary relationship. Its name alone does not propagate freshness; evaluations must declare their inputs."}
            </p>
            {relationship && (
              <ObjectEditor
                key={relationship.id}
                value={relationship}
                definition={graph.schema.relationshipTypes[relationship.type] ?? { fields: {} }}
                schemaVersion={graph.schema.version}
                relationship
                editing={editing}
                onDirty={setFieldDirty}
                disabled={disabled || !graph.links.some((value) => value.id === relationship.id)}
              />
            )}
          </>
        )}
      </>
    );
  }
  function renderSourceVersions(
    input: Graph["evaluations"][number]["comparison"]["inputs"][number],
  ) {
    if (!input.recorded.observation) return null;
    function version(observation: typeof input.current.observation) {
      return (
        <>
          {observation?.commit ?? "local file"} · {observation?.hash ?? "unknown"} ·{" "}
          {observation?.at ?? "unknown"}
        </>
      );
    }
    return (
      <details>
        <summary>Recorded versus last-observed source versions</summary>
        <p>Recorded: {version(input.recorded.observation)}</p>
        <p>Last observed: {version(input.current.observation)}</p>
      </details>
    );
  }
  function renderInputExplanation(
    input: Graph["evaluations"][number]["comparison"]["inputs"][number],
    output: Entity,
  ) {
    return (
      <article key={input.entityId} className={`graph-explanation ${input.state}`}>
        <h4>
          {label(input.recorded.entity)} · {input.state}
        </h4>
        <p>
          {[
            output,
            ...input.recorded.links.map(
              (link) =>
                graph.nodes.find((value) => value.id === link.target) ?? {
                  id: link.target,
                  type: "",
                  fields: {},
                  version: 0,
                },
            ),
            input.recorded.entity,
          ]
            .filter((value, index, array) => index === 0 || value.id !== array[index - 1].id)
            .map(label)
            .join(" → ")}
        </p>
        <p>
          Native revision {input.recorded.entity.version} →{" "}
          {input.current.entity?.version ?? "unavailable"}
        </p>
        {input.reasons.map((reason) => (
          <p key={reason}>{reason}</p>
        ))}
        {renderSourceVersions(input)}
      </article>
    );
  }
  function renderReviewControls() {
    if (!selected) return null;
    return (
      <fieldset disabled={disabled || saving}>
        {reviewToken !== selected.comparison.token && (
          <p className="gap">
            Inputs changed while drafting. Review the refreshed explanation, then{" "}
            <button onClick={() => setReviewToken(selected.comparison.token)}>
              Use refreshed comparison
            </button>{" "}
            before recording this assessment.
          </p>
        )}
        <label>
          Review action
          <select
            aria-label="Graph review action"
            value={decision}
            onChange={(event) => setDecision(event.target.value as ReviewInput["decision"])}
          >
            <option value="accepted">Evidence still applies</option>
            <option value="needs_reevaluation">Reevaluate</option>
            <option value="acknowledged">Acknowledge only</option>
          </select>
        </label>
        <label>
          Rationale
          <textarea
            aria-label="Graph review rationale"
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
          />
        </label>
        <button
          disabled={
            !rationale.trim() ||
            reviewToken !== selected.comparison.token ||
            (decision === "accepted" && selected.comparison.hasUnknown)
          }
          onClick={() => void review()}
        >
          Record assessment
        </button>
        {selected.comparison.hasUnknown && (
          <small>Resolve unknown inputs or request reevaluation; acceptance is blocked.</small>
        )}
      </fieldset>
    );
  }
  function renderEvaluationReview() {
    return (
      <>
        {selected && (
          <div className="graph-review">
            <h3>Why this evaluation may need review</h3>
            <p>
              <strong>{selected.comparison.state}</strong> · Review:{" "}
              {selected.comparison.review.state}
              {selected.comparison.supersededBy.length ? " · Superseded" : ""}
            </p>
            <p>{selected.receipt.outcome}</p>
            <small>
              Based on last recorded observations, not a live check. Version drift does not imply
              technical invalidity.
            </small>
            {selected.comparison.inputs.map((input) =>
              renderInputExplanation(input, selected.receipt.output),
            )}
            {selected.comparison.review.decision && (
              <p>
                <strong>Review rationale:</strong> {selected.comparison.review.decision.rationale}
              </p>
            )}
            {selected.comparison.review.previous && (
              <p className="gap">
                Previous review no longer applies to these inputs:{" "}
                {selected.comparison.review.previous.rationale}
              </p>
            )}
            {selected.comparison.supersededBy.length > 0 && (
              <p>
                Replaced by {selected.comparison.supersededBy.length} newer evaluation(s). Original
                evidence is retained.
              </p>
            )}
            {renderReviewControls()}
            <details>
              <summary>Immutable receipt and technical details</summary>
              <pre>{JSON.stringify(selected.receipt, null, 2)}</pre>
            </details>
          </div>
        )}
      </>
    );
  }
  return (
    <aside className="graph-inspector" aria-label="Graph inspector">
      <span className="eyebrow">Inspect & act</span>
      {renderNativeNode()}
      {renderNativeEdge()}
      {renderEvaluationReview()}
      {!node && !edge && !selected && <p>Select a node or connection to explore its meaning.</p>}
      <p role="status">{notice}</p>
    </aside>
  );
}
function useGraphReview(
  selected: Graph["evaluations"][number] | undefined,
  changed: () => void,
  editing: Editing,
) {
  const [rationale, setRationale] = useState(""),
    [decision, setDecision] = useState<ReviewInput["decision"]>("accepted"),
    [saving, setSaving] = useState(false),
    [notice, setNotice] = useState("");
  const [reviewToken, setReviewToken] = useState(selected?.comparison.token);
  useEffect(() => {
    if (!rationale.trim()) setReviewToken(selected?.comparison.token);
  }, [selected?.comparison.token, rationale]);
  const review = async () => {
    if (!selected) return;
    const input = {
      receiptId: selected.receipt.id,
      decision,
      rationale,
      expectedComparison: reviewToken ?? selected.comparison.token,
    };
    setSaving(true);
    try {
      const saved = await editing.mutate("/api/reviews", input);
      if (!saved) return;
      setNotice("Review recorded. Original evidence unchanged.");
      setRationale("");
      changed();
    } catch (error) {
      editing.report(error, input);
    } finally {
      setSaving(false);
    }
  };
  return {
    rationale,
    setRationale,
    decision,
    setDecision,
    saving,
    notice,
    setNotice,
    reviewToken,
    setReviewToken,
    review,
  };
}
