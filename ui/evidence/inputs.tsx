import { RelationshipEvidence } from "./relationship.tsx";
import { useEffect, useRef, useState } from "react";
import type { Comparison, InputComparison, Receipt } from "../../src/core/evidence.ts";
import { canonical } from "../../src/core/evidence.ts";
import { label } from "../entity-label.ts";
import { recordedDependencyPath, inputIdentity } from "./path.ts";
import "./workspace.css";
import { NativePinProvenance } from "../native-pin-provenance.tsx";
import { ObservedContent, ResourceIdentity } from "./resource.tsx";

export function EvidenceInputs({
  comparison,
  receipt,
  focusInputId,
  mode = "all",
}: {
  comparison: Comparison;
  receipt?: Receipt;
  focusInputId?: string;
  mode?: "all" | "focused";
}) {
  if (mode === "focused")
    return (
      <>
        <FocusedInputs comparison={comparison} receipt={receipt} focusInputId={focusInputId} />
        <RelationshipEvidence
          inputs={comparison.relationshipInputs}
          contentInputs={comparison.inputs}
        />
      </>
    );
  return (
    <div className="evidence-inputs" aria-label="Captured input comparisons">
      {receipt?.configuration && (
        <p className="evidence-configuration">
          Recorded configuration: <strong>{receipt.configuration.name}</strong> · captured build
        </p>
      )}
      {[...comparison.inputs]
        .sort((a, b) => inputPriority(a, focusInputId) - inputPriority(b, focusInputId))
        .map((value) => (
          <EvidenceInput
            key={inputIdentity(value)}
            value={value}
            receipt={receipt}
            focused={value.entityId === focusInputId}
          />
        ))}
      <RelationshipEvidence
        inputs={comparison.relationshipInputs}
        contentInputs={comparison.inputs}
      />
    </div>
  );
}
function FocusedInputs({
  comparison,
  receipt,
  focusInputId,
}: {
  comparison: Comparison;
  receipt?: Receipt;
  focusInputId?: string;
}) {
  const [selectedId, setSelectedId] = useState(focusInputId);
  const detail = useRef<HTMLElement>(null);
  useEffect(() => setSelectedId(focusInputId), [comparison.receiptId, focusInputId]);
  const inputs = [...comparison.inputs].sort((a, b) => inputPriority(a) - inputPriority(b));
  const selected =
    inputs.find((value) => inputIdentity(value) === selectedId) ??
    inputs.find((value) => value.entityId === selectedId) ??
    inputs[0];
  if (!selected)
    return (
      <p>
        {comparison.relationshipInputs?.length
          ? "No declared object inputs; relationship inputs are shown below."
          : "No declared inputs in this receipt."}
      </p>
    );
  return (
    <div className="evidence-inputs evidence-input-browser" aria-label="Captured input comparisons">
      <section
        className="evidence-selected-input"
        ref={detail}
        tabIndex={-1}
        aria-label="Selected input comparison"
      >
        <EvidenceInput value={selected} receipt={receipt} focused expanded />
      </section>
      <section className="evidence-input-list" aria-label="Complete declared inputs">
        <h3>Declared inputs · {inputs.length}</h3>
        {inputs.map((value) => (
          <button
            key={inputIdentity(value)}
            aria-pressed={inputIdentity(selected) === inputIdentity(value)}
            aria-label={`Compare input ${label(value.recorded.entity)}`}
            onClick={() => {
              setSelectedId(inputIdentity(value));
              detail.current?.focus({ preventScroll: true });
              detail.current?.scrollIntoView({ block: "start" });
            }}
          >
            <InputHeader value={value} />
          </button>
        ))}
      </section>
    </div>
  );
}

function EvidenceInput({
  value,
  receipt,
  focused,
  expanded = false,
}: {
  value: InputComparison;
  receipt?: Receipt;
  focused: boolean;
  expanded?: boolean;
}) {
  const primaryField =
    value.recorded.entity.fields.statement !== undefined ||
    value.current.entity?.fields.statement !== undefined
      ? "statement"
      : "title";
  const differences = changedFields(value).filter(
    (difference) => !expanded || difference.name !== primaryField,
  );
  return (
    <article
      className={`evidence-input is-${value.state}${focused ? " is-focused" : ""}`}
      aria-label={focused ? `Selected input ${label(value.recorded.entity)}` : undefined}
    >
      <InputHeader value={value} />
      {(value.recorded.entity.resource || value.recorded.observation) && (
        <ResourceIdentity entity={value.recorded.entity} />
      )}
      {value.recorded.role && (
        <p className="evidence-input-usage">Use in this evaluation: {value.recorded.role}</p>
      )}
      {needsAttention(value) && <DependencyPath value={value} receipt={receipt} />}
      <FieldChanges differences={differences} />
      <InputReasons value={value} hasFieldChanges={!!differences.length} />
      <StatementComparison value={value} expanded={expanded} />
      <InputProvenance value={value} receipt={receipt} hasFieldChanges={!!differences.length} />
    </article>
  );
}

function InputHeader({ value }: { value: InputComparison }) {
  const identity = label(value.recorded.entity);
  const title = value.recorded.entity.fields.title;
  return (
    <div className="evidence-input-header">
      <div className="evidence-input-identity">
        <h4 aria-label={`${identity}: ${value.state}`}>{identity}</h4>
        {typeof title === "string" && title !== identity && <span>{title}</span>}
      </div>
      <span className="evidence-input-versions">
        {(value.recorded.entity.resource ||
          value.recorded.observation ||
          value.recorded.facet === "native") &&
          "Native record · "}
        Captured v{value.recorded.entity.version} →{" "}
        {value.current.entity ? `Current v${value.current.entity.version}` : "Current unavailable"}
      </span>
      <span className={`evidence-input-state is-${value.state}`}>
        {value.hasChanged && value.hasUnknown ? "changed · unknown" : value.state}
      </span>
    </div>
  );
}

function InputReasons({
  value,
  hasFieldChanges,
}: {
  value: InputComparison;
  hasFieldChanges: boolean;
}) {
  if (!showReasons(value, hasFieldChanges)) return null;
  return (
    <ul className="evidence-input-reasons">
      {value.reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}

function InputProvenance({
  value,
  receipt,
  hasFieldChanges,
}: {
  value: InputComparison;
  receipt?: Receipt;
  hasFieldChanges: boolean;
}) {
  return (
    <details className="evidence-input-provenance">
      <summary>Dependency and capture details</summary>
      {!needsAttention(value) && <DependencyPath value={value} receipt={receipt} />}
      <p>Canonical dependency IDs: {value.dependencyPath.join(" → ")}</p>
      {receipt?.configuration && <p>Configuration ID: {receipt.configuration.id}</p>}
      {value.recorded.fields && <p>Declared fields: {value.recorded.fields.join(", ")}</p>}
      {value.recorded.pin && <NativePinProvenance pin={value.recorded.pin} />}
      <details>
        <summary>Original native fields and relationship records</summary>
        <pre>{JSON.stringify({ captured: value.recorded, current: value.current }, null, 2)}</pre>
      </details>
      {!showReasons(value, hasFieldChanges) && (
        <ul>
          {value.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </details>
  );
}

function showReasons(value: InputComparison, hasFieldChanges: boolean) {
  return value.hasUnknown || (value.hasChanged && !hasFieldChanges);
}

function needsAttention(value: InputComparison) {
  return value.hasChanged || value.hasUnknown;
}

function DependencyPath({ value, receipt }: { value: InputComparison; receipt?: Receipt }) {
  return (
    <p className="evidence-input-path">
      {value.recorded.links.length ? "Declared relationship path" : "Direct dependency"}:{" "}
      {receipt ? recordedDependencyPath(value, receipt.output) : value.dependencyPath.join(" → ")}
    </p>
  );
}

function inputPriority(value: InputComparison, focusInputId?: string) {
  if (value.entityId === focusInputId) return -1;
  if (value.hasChanged) return 0;
  return value.hasUnknown ? 1 : 2;
}

type FieldDifference = { name: string; recorded: unknown; current: unknown };
function changedFields(value: InputComparison): FieldDifference[] {
  if (!value.hasChanged || value.recorded.observation || !value.current.entity) return [];
  const before = value.recorded.entity.fields;
  const after = value.current.entity.fields;
  const names = value.recorded.fields ?? [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ];
  return names
    .filter((name) => canonical(before[name]) !== canonical(after[name]))
    .map((name) => ({ name, recorded: before[name], current: after[name] }));
}

function FieldChanges({ differences }: { differences: FieldDifference[] }) {
  if (!differences.length) return null;
  return (
    <div className="evidence-field-changes" aria-label="Changed declared fields">
      {differences.map((difference) => (
        <div className="evidence-field-change" key={difference.name}>
          <h5>{difference.name.replaceAll("_", " ")}</h5>
          <div>
            <small>Captured</small>
            <p>{displayValue(difference.recorded)}</p>
          </div>
          <div>
            <small>Current</small>
            <p>{displayValue(difference.current)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function displayValue(value: unknown) {
  if (value === undefined) return "Not recorded";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function StatementComparison({
  value,
  expanded = false,
}: {
  value: InputComparison;
  expanded?: boolean;
}) {
  if (value.recorded.observation)
    return (
      <ObservedContent recorded={value.recorded.observation} current={value.current.observation} />
    );
  const content = (
    <div className="evidence-statement-comparison">
      <p>
        <strong>Captured v{value.recorded.entity.version}</strong>
      </p>
      <p>
        {String(
          value.recorded.entity.fields.statement ??
            value.recorded.entity.fields.title ??
            JSON.stringify(value.recorded.entity.fields),
        )}
      </p>
      <p>
        <strong>
          Current {value.current.entity ? `v${value.current.entity.version}` : "unavailable"}
        </strong>
      </p>
      <p>
        {value.current.entity
          ? String(
              value.current.entity.fields.statement ??
                value.current.entity.fields.title ??
                JSON.stringify(value.current.entity.fields),
            )
          : "Current input could not be read."}
      </p>
    </div>
  );
  return expanded ? (
    content
  ) : (
    <details>
      <summary>Captured and current statements</summary>
      {content}
    </details>
  );
}
