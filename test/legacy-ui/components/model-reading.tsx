import { useEffect, useRef } from "react";
import type { RelationshipDefinition, Schema, TypeDefinition } from "../../../src/core/model.ts";
import type { FlowRoute } from "../../../ui/model-flow.ts";
import { endpointSummary } from "../../../ui/schema-draft.ts";
import type { DefinitionSelection } from "../../../ui/schema-guided.tsx";

const human = (name: string) => name.replaceAll("_", " ");

export function ModelInputsOutputs({
  type,
  routes,
  disabled,
  onType,
  onRoute,
}: {
  type: string;
  routes: FlowRoute[];
  disabled: boolean;
  onType(): void;
  onRoute(route: FlowRoute): void;
}) {
  if (!type) return null;
  const inputs = routes.filter((route) => route.target.name === type && route.source.name !== type);
  const outputs = routes.filter(
    (route) => route.source.name === type && route.target.name !== type,
  );
  const loops = routes.filter((route) => route.source.name === type && route.target.name === type);
  const row = (route: FlowRoute, incoming: boolean) => (
    <li key={route.key}>
      <button
        id={`model-path-${encodeURIComponent(route.key)}`}
        disabled={disabled}
        onClick={() => onRoute(route)}
        aria-label={`Inspect workflow path · ${route.source.name} → ${route.label} → ${route.target.name}`}
      >
        <strong>{human(incoming ? route.source.name : route.target.name)}</strong>
        <span>{route.label}</span>
        {route.feedback && <small>Feedback path</small>}
      </button>
    </li>
  );
  return (
    <div className="model-input-output" aria-label={`${human(type)} inputs and outputs`}>
      <section>
        <h3>Inputs → {inputs.length}</h3>
        <ul>{inputs.map((route) => row(route, true))}</ul>
        {!inputs.length && <p>No authored incoming path.</p>}
      </section>
      <section className="model-focus-type">
        <h3>{human(type)}</h3>
        <button id={`model-focus-definition-${type}`} disabled={disabled} onClick={onType}>
          Type definition · {human(type)}
        </button>
        <ul>{loops.map((route) => row(route, false))}</ul>
      </section>
      <section>
        <h3>→ Outputs {outputs.length}</h3>
        <ul>{outputs.map((route) => row(route, false))}</ul>
        {!outputs.length && <p>No authored outgoing path.</p>}
      </section>
    </div>
  );
}

export function ModelDefinitionReading({
  schema,
  selection,
  route,
  disabled,
  onBack,
  onConfigure,
  onBrowse,
  onOpen,
  returnLabel,
}: {
  schema: Schema;
  selection: DefinitionSelection;
  route?: FlowRoute;
  disabled: boolean;
  returnLabel: string;
  onBack(): void;
  onConfigure(): void;
  onBrowse(type: string): void;
  onOpen(name: string): void;
}) {
  const definition = schema[selection.group][selection.name];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [selection.group, selection.name, selection.pathIndex]);
  if (!definition)
    return (
      <section className="model-definition-reading">
        <button onClick={onBack}>{returnLabel}</button>
        <p role="status">This definition is no longer in the current model.</p>
      </section>
    );
  const relationship =
    selection.group === "relationshipTypes" ? schema.relationshipTypes[selection.name] : null;
  const label = definitionLabel(selection, !!route);
  const title = route
    ? `${human(route.source.name)} → ${human(route.target.name)}`
    : human(selection.name);
  return (
    <section className="model-definition-reading" aria-label="Selected model definition">
      <button onClick={onBack}>{returnLabel}</button>
      <div className="model-definition-heading">
        <div>
          <p className="muted">{label}</p>
          <h3 ref={heading} tabIndex={-1}>
            {title}
          </h3>
        </div>
        <button disabled={disabled} onClick={onConfigure}>
          Configure this definition
        </button>
      </div>
      <WorkflowMeaning route={route} />
      {relationship && (
        <NativeDefinitionReading
          definition={relationship}
          selection={selection}
          hasRoute={!!route}
          disabled={disabled}
          onOpen={onOpen}
        />
      )}
      <DefinitionFieldReading definition={definition} />
      {!relationship && (
        <button
          id={`model-definition-browse-${selection.name}`}
          disabled={disabled}
          onClick={() => onBrowse(selection.name)}
        >
          Browse items · {selection.name}
        </button>
      )}
    </section>
  );
}

function definitionLabel(selection: DefinitionSelection, hasRoute: boolean) {
  if (hasRoute) return "Authored workflow path";
  return selection.group === "relationshipTypes"
    ? "Native relationship definition"
    : "Item type definition";
}
function WorkflowMeaning({ route }: { route?: FlowRoute }) {
  if (!route) return null;
  return (
    <p className="model-selected-flow">
      {route.label}
      {route.feedback ? " · feedback path" : ""}
    </p>
  );
}

function NativeDefinitionReading({
  definition,
  selection,
  hasRoute,
  disabled,
  onOpen,
}: {
  definition: RelationshipDefinition;
  selection: DefinitionSelection;
  hasRoute: boolean;
  disabled: boolean;
  onOpen(name: string): void;
}) {
  const path = definition.workflow?.[selection.pathIndex ?? -1];
  return (
    <div className="model-native-definition">
      <h4>Native permissions · {selection.name}</h4>
      <p>Sources: {endpointSummary(definition.source, "source")}</p>
      <p>Targets: {endpointSummary(definition.target, "target")}</p>
      {hasRoute && (
        <p>
          Stored path: {path?.source} → {path?.target}. Workflow display direction does not reverse
          recorded links.
        </p>
      )}
      <button
        id={`model-records-${selection.name}`}
        disabled={disabled}
        onClick={() => onOpen(selection.name)}
      >
        View recorded connections · {selection.name}
      </button>
    </div>
  );
}
function DefinitionFieldReading({ definition }: { definition: TypeDefinition }) {
  return (
    <>
      <h4>Fields · {Object.keys(definition.fields).length}</h4>
      <table className="model-definition-fields">
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Required</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(definition.fields).map(([name, field]) => (
            <tr key={name}>
              <th>{name}</th>
              <td>{field.type}</td>
              <td>{field.required ? "Required" : "Optional"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
