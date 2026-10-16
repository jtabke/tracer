import { useState } from "react";
import type { RelationshipDefinition } from "../src/core/model.ts";
import type { WorkflowConnection } from "../src/core/schema-workflow.ts";

export function SchemaWorkflowForm({
  definition,
  names,
  onChange,
  initialPath,
}: {
  definition: RelationshipDefinition;
  names: string[];
  onChange(value: RelationshipDefinition): void;
  initialPath?: number;
}) {
  const routes = definition.workflow ?? [];
  const sources = definition.source ?? names;
  const targets = definition.target ?? names;
  const [focused, setFocused] = useState(initialPath ?? 0);
  const current = routes[focused] ? focused : 0;
  return (
    <section className="schema-workflow-form" aria-label="Development flow definition">
      {!routes.length && <h4>Development flow</h4>}
      {routes.length > 1 && (
        <label>
          Workflow path
          <select
            aria-label="Selected workflow path"
            value={current}
            onChange={(event) => setFocused(Number(event.target.value))}
          >
            {routes.map((route, index) => (
              <option key={index} value={index}>
                {route.direction === "forward"
                  ? `${route.source} → ${route.target}`
                  : `${route.target} → ${route.source}`}{" "}
                · {route.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {routes.map((route, index) => (
        <div key={index} hidden={index !== current}>
          <WorkflowPath
            key={index}
            route={route}
            index={index}
            showHeading={routes.length === 1}
            onChange={(value) =>
              onChange({
                ...definition,
                workflow: routes.map((route, position) => (position === index ? value : route)),
              })
            }
            onRemove={() =>
              onChange({
                ...definition,
                workflow: routes.filter((_, position) => position !== index),
              })
            }
          />
        </div>
      ))}
      {!routes.length && (
        <p className="muted">Trace connection only; no development flow is defined.</p>
      )}
      <NewWorkflowPath
        sources={sources}
        targets={targets}
        onAdd={(route) => onChange({ ...definition, workflow: [...routes, route] })}
      />
    </section>
  );
}

function WorkflowPath({
  route,
  index,
  onChange,
  onRemove,
  showHeading,
}: {
  route: WorkflowConnection;
  index: number;
  onChange(value: WorkflowConnection): void;
  onRemove(): void;
  showHeading: boolean;
}) {
  const [input, output] =
    route.direction === "forward" ? [route.source, route.target] : [route.target, route.source];
  return (
    <fieldset className="schema-workflow-path" aria-label={`Workflow path ${index + 1}`}>
      <legend className={showHeading ? undefined : "sr-only"}>
        {input.replaceAll("_", " ")} → {output.replaceAll("_", " ")}
      </legend>
      <label>
        Flow label
        <input
          aria-label={`Flow label ${index + 1}`}
          value={route.label}
          onChange={(event) => onChange({ ...route, label: event.target.value })}
        />
      </label>
      <label>
        Workflow display direction
        <select
          value={route.direction}
          aria-label={`Flow direction ${index + 1}`}
          onChange={(event) =>
            onChange({ ...route, direction: event.target.value as WorkflowConnection["direction"] })
          }
        >
          <option value="forward">
            {route.source} → {route.target}
          </option>
          <option value="reverse">
            {route.target} → {route.source}
          </option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={route.feedback ?? false}
          onChange={(event) => onChange({ ...route, feedback: event.target.checked })}
        />
        Feedback loop
      </label>
      <button type="button" onClick={onRemove}>
        Remove workflow path
      </button>
    </fieldset>
  );
}

function NewWorkflowPath({
  sources,
  targets,
  onAdd,
}: {
  sources: string[];
  targets: string[];
  onAdd(value: WorkflowConnection): void;
}) {
  const [source, setSource] = useState(sources[0] ?? "");
  const [target, setTarget] = useState(targets[0] ?? "");
  const [label, setLabel] = useState("");
  const valid = sources.includes(source) && targets.includes(target) && label.trim().length > 0;
  return (
    <details className="schema-new-workflow-path">
      <summary>Add a workflow path</summary>
      <label>
        Stored source type
        <select
          aria-label="Workflow source type"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        >
          {sources.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label>
        Stored target type
        <select
          aria-label="Workflow target type"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        >
          {targets.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label>
        New flow label
        <input value={label} onChange={(event) => setLabel(event.target.value)} />
      </label>
      <button
        type="button"
        disabled={!valid}
        onClick={() => {
          onAdd({ source, target, label: label.trim(), direction: "forward" });
          setLabel("");
        }}
      >
        Add workflow path
      </button>
    </details>
  );
}
