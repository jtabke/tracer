import { useState } from "react";
import type { Schema } from "../../../src/core/model.ts";
import type { FlowRoute } from "../../../ui/model-flow.ts";
import { modelFlow } from "../../../ui/model-flow.ts";
import { routeDefinition } from "../../../ui/model-selection.ts";
import { endpointSummary } from "../../../ui/schema-draft.ts";
import type { DefinitionSelection } from "../../../ui/schema-guided.tsx";
import { NativeTypeOptions } from "../../../ui/type-options.tsx";
import { ModelReadCanvas } from "./model-read-canvas.tsx";
import { ModelDefinitionReading, ModelInputsOutputs } from "./model-reading.tsx";

export function ModelRegister({
  schema,
  onCreate,
  onBrowse,
  onOpen,
  onLink,
  onConfigure,
  busy,
}: {
  schema: Schema;
  onCreate(): void;
  onBrowse(type: string, focusId?: string): void;
  onOpen(name: string, focusId?: string): void;
  onLink(source: string, target: string): void;
  onConfigure(selection: DefinitionSelection, returnLabel: string): void;
  busy: boolean;
}) {
  const [type, setType] = useState("");
  const [view, setView] = useState<"overview" | "focus" | "permissions">("overview");
  const [selection, setSelection] = useState<DefinitionSelection | null>(null);
  const [routeKey, setRouteKey] = useState("");
  const [frameRequest, setFrameRequest] = useState(0);
  const link = useTypeLink(onLink);
  const selected = schema.entityTypes[type] ? type : "";
  const routes = modelFlow(schema, "workflow").routes;
  const selectedRoute = routes.find((route) => route.key === routeKey);
  const selectType = (name: string) => {
    if (link.choose(name)) return;
    setType(name);
    setSelection(null);
    setRouteKey("");
    setView("overview");
    setFrameRequest((request) => request + 1);
  };
  const selectRelationship = (name: string) => {
    setRouteKey("");
    setSelection({ group: "relationshipTypes", name });
  };
  const inspectRoute = (route: FlowRoute) => {
    setRouteKey(route.key);
    setSelection(routeDefinition(schema, route));
  };
  const inspectType = () => {
    setRouteKey("");
    setSelection({ group: "entityTypes", name: selected });
  };
  const returnLabel = modelReturnLabel(selected, view);
  return (
    <>
      <div hidden={!!selection}>
        <ModelReadingToolbar
          schema={schema}
          selected={selected}
          view={view}
          busy={busy}
          linking={link.linking}
          onSelectType={selectType}
          onView={setView}
          onBrowse={onBrowse}
          onCreate={onCreate}
          onInspectType={inspectType}
          onLink={() => {
            setType("");
            setView("overview");
            setSelection(null);
            link.toggle();
          }}
        />
        <LinkPrompt linking={link.linking} source={link.source} />
        <div hidden={view !== "overview"} className="model-current-overview">
          <div className="model-wide-overview">
            <ModelReadCanvas
              focus=""
              selectedType={selected}
              frameRequest={frameRequest}
              schema={schema}
              relationship=""
              linking={link.linking}
              source={link.source}
              workflowOnly
              onSelectType={selectType}
              onSelectRelationship={selectRelationship}
              onSelectRoute={inspectRoute}
            />
          </div>
          <p className="model-map-scope">
            {Object.keys(schema.entityTypes).length} configured types · {routes.length} authored
            workflow paths. Unconnected types have no authored path; positions are presentation, not
            stages or gates.
          </p>
          {!Object.keys(schema.entityTypes).length && (
            <p>No entity types configured. Configure model before creating an item.</p>
          )}
        </div>
        <div hidden={view !== "focus" || !selected}>
          <ModelInputsOutputs
            type={selected}
            routes={routes}
            disabled={busy}
            onType={inspectType}
            onRoute={inspectRoute}
          />
        </div>
        <div hidden={view !== "permissions"}>
          <ModelPermissionRegister
            schema={schema}
            busy={busy}
            onSelect={selectRelationship}
            onOpen={onOpen}
          />
        </div>
      </div>
      {selection && (
        <ModelDefinitionReading
          schema={schema}
          selection={selection}
          route={selectedRoute}
          returnLabel={returnLabel}
          disabled={busy}
          onBack={() => {
            setSelection(null);
            focusModelReading(selected, view, selection, routeKey);
          }}
          onConfigure={() => onConfigure(selection, returnLabel)}
          onBrowse={(type) => onBrowse(type, `model-definition-browse-${type}`)}
          onOpen={onOpen}
        />
      )}
    </>
  );
}
function modelReturnLabel(type: string, view: "overview" | "focus" | "permissions") {
  const names = {
    overview: "workflow overview",
    focus: "inputs and outputs",
    permissions: "connection permissions",
  };
  return `← Return to ${[type.replaceAll("_", " "), names[view]].filter(Boolean).join(" ")}`;
}
function focusModelReading(
  type: string,
  view: string,
  selection: DefinitionSelection,
  routeKey: string,
) {
  if (view === "overview") {
    const id = routeKey ? `model-route-${encodeURIComponent(routeKey)}` : `model-node-${type}`;
    requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));
    return;
  }
  const id = routeKey
    ? `model-path-${encodeURIComponent(routeKey)}`
    : view === "permissions"
      ? `model-relationship-${selection.name}`
      : `model-focus-definition-${type}`;
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

function useTypeLink(onLink: (source: string, target: string) => void) {
  const [linking, setLinking] = useState(false);
  const [source, setSource] = useState("");
  return {
    linking,
    source,
    choose(name: string) {
      if (!linking) return false;
      if (!source) setSource(name);
      else {
        onLink(source, name);
        setLinking(false);
        setSource("");
      }
      return true;
    },
    toggle() {
      setLinking(!linking);
      setSource("");
    },
  };
}
function LinkPrompt({ linking, source }: { linking: boolean; source: string }) {
  if (!linking) return null;
  return (
    <p className="model-link-prompt" role="status">
      {source
        ? `Source: ${source}. Select a target type. You can select the same type for a loop.`
        : "Select a source type on the diagram, then its target type."}
    </p>
  );
}

function ModelReadingToolbar({
  schema,
  selected,
  view,
  busy,
  linking,
  onSelectType,
  onView,
  onBrowse,
  onCreate,
  onInspectType,
  onLink,
}: {
  schema: Schema;
  selected: string;
  view: "overview" | "focus" | "permissions";
  busy: boolean;
  linking: boolean;
  onSelectType(name: string): void;
  onView(view: "overview" | "focus" | "permissions"): void;
  onBrowse(type: string, focusId?: string): void;
  onCreate(): void;
  onInspectType(): void;
  onLink(): void;
}) {
  return (
    <div className="model-map-toolbar">
      <div role="group" aria-label="Model representations" className="model-read-modes">
        {(
          [
            ["overview", "Overview"],
            ["focus", "Inputs and outputs"],
            ["permissions", "Connection permissions"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            disabled={busy || (mode === "focus" && !selected)}
            aria-pressed={view === mode}
            onClick={() => onView(mode)}
          >
            {label}
          </button>
        ))}
      </div>
      <label>
        Focus type{" "}
        <select
          aria-label="Focus type"
          id={`model-type-${selected}`}
          value={selected}
          disabled={busy}
          onChange={(event) => onSelectType(event.target.value)}
        >
          <option value="">Workflow overview</option>
          <NativeTypeOptions names={Object.keys(schema.entityTypes)} />
        </select>
      </label>
      {selected && view === "overview" && (
        <button disabled={busy} onClick={onInspectType}>
          Type definition · {selected.replaceAll("_", " ")}
        </button>
      )}
      {selected && (
        <button
          id={`model-browse-${selected}`}
          disabled={busy}
          onClick={() => onBrowse(selected, `model-browse-${selected}`)}
        >
          Browse items · {selected}
        </button>
      )}
      <button
        disabled={busy || !Object.keys(schema.entityTypes).length}
        aria-pressed={linking}
        onClick={onLink}
      >
        {linking ? "Cancel linking" : "Link types"}
      </button>
      <button disabled={busy || !Object.keys(schema.entityTypes).length} onClick={onCreate}>
        New item
      </button>
    </div>
  );
}
function ModelPermissionRegister({
  schema,
  busy,
  onSelect,
  onOpen,
}: {
  schema: Schema;
  busy: boolean;
  onSelect(name: string): void;
  onOpen(name: string, focusId?: string): void;
}) {
  return (
    <section className="model-declarations" aria-label="Native relationship permissions">
      <h3>Native relationship permissions · {Object.keys(schema.relationshipTypes).length}</h3>
      <p>Allowed endpoints are alternatives, not recorded connections or a development sequence.</p>
      <label>
        Connection{" "}
        <select
          aria-label="Workflow connection"
          disabled={busy}
          value=""
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="">Select a native relationship</option>
          {Object.keys(schema.relationshipTypes).map((name) => (
            <option key={name} value={name}>
              {name.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <ul className="model-relationships">
        {Object.entries(schema.relationshipTypes).map(([name, definition]) => (
          <li key={name}>
            <button
              id={`model-relationship-${name}`}
              disabled={busy}
              onClick={() => onSelect(name)}
            >
              {name}
            </button>
            <p>
              {endpointSummary(definition.source, "source")} →{" "}
              {endpointSummary(definition.target, "target")}
            </p>
            <button
              id={`model-permission-records-${name}`}
              disabled={busy}
              onClick={() => onOpen(name, `model-permission-records-${name}`)}
            >
              View recorded connections · {name}
            </button>
          </li>
        ))}
      </ul>
      {!Object.keys(schema.relationshipTypes).length && <p>No relationships configured.</p>}
    </section>
  );
}
