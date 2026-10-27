import type { RefObject } from "react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { Schema } from "../src/core/model.ts";
import { FlowLabel } from "./model-flow-label.tsx";
import type { FlowEditing } from "./model-flow-types.tsx";
import { FlowTypeCards } from "./model-flow-types.tsx";
import "./model-flow.css";
import type { FlowRoute } from "./model-flow.ts";
import { flowPath, focusFlow, modelFlow, overviewRoutes, routeActive } from "./model-flow.ts";
import { endpointSummary } from "./schema-draft.ts";

export function ModelMap({
  focus,
  schema,
  relationship,
  linking,
  source,
  onSelectType,
  onSelectRelationship,
  selectedType = "",
  editing,
  positions = {},
  scale = 1,
  frameRequest = 0,
  workflowOnly = false,
  workflowParticipantsOnly,
  onSelectRoute,
  selectedRouteKey = "",
}: {
  focus: string;
  schema: Schema;
  relationship: string;
  linking: boolean;
  source: string;
  selectedType?: string;
  editing?: FlowEditing;
  positions?: Record<string, { x: number; y: number }>;
  scale?: number;
  frameRequest?: number;
  workflowOnly?: boolean;
  workflowParticipantsOnly?: boolean;
  onSelectRoute?(route: FlowRoute): void;
  selectedRouteKey?: string;
  onSelectType(name: string): void;
  onSelectRelationship(name: string): void;
}) {
  const { hasWorkflow, mode, setPreferred, whole, layout, active } = useModelProjection(
    schema,
    focus,
    relationship,
    positions,
    workflowOnly,
    workflowParticipantsOnly,
  );
  const scroll = useFlowScroll(
    flowSelectionPoint(layout.nodes, active, selectedType, relationship, selectedRouteKey, focus),
    scale,
    frameRequest,
  );
  const marker = useId().replaceAll(":", "");
  return (
    <div className="model-connection-plan" data-mode={mode} data-authored-only={workflowOnly}>
      <ModelMapControls
        schema={schema}
        mode={mode}
        hasWorkflow={hasWorkflow}
        workflowOnly={workflowOnly}
        relationship={relationship}
        onMode={setPreferred}
        onSelectRelationship={onSelectRelationship}
      />
      <WorkflowContext
        count={Object.keys(schema.entityTypes).length - whole.nodes.length}
        onShow={() => setPreferred("trace")}
      />
      <ModelFlowViewport
        scroll={scroll}
        layout={layout}
        scale={scale}
        editing={editing}
        focus={focus}
        selectedType={selectedType}
        marker={marker}
        active={active}
        mode={mode}
        source={source}
        linking={linking}
        onSelectType={onSelectType}
        onSelectRelationship={onSelectRelationship}
        onSelectRoute={onSelectRoute}
      />

      <div className="model-flow-key">
        <p>
          <span aria-hidden="true">→</span> Directed connections <span aria-hidden="true">↶</span>{" "}
          Return paths / self loops
        </p>
        <p>
          {active.length} of {whole.routes.length} explicit type routes · select a connection to
          inspect its definition.
        </p>
      </div>
    </div>
  );
}

function WorkflowContext({ count, onShow }: { count: number; onShow(): void }) {
  if (!count) return null;
  return (
    <p className="model-context-note">
      {count} supporting types are available in{" "}
      <button type="button" aria-label="Show supporting types" onClick={onShow}>
        Trace connections
      </button>
      . Run results are available in Evaluations.
    </p>
  );
}

function useFlowScroll(node: { x: number; y: number } | undefined, scale: number, frame: number) {
  const ref = useRef<HTMLDivElement>(null);
  const x = node?.x,
    y = node?.y;
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let width = element.clientWidth;
    let height = element.clientHeight;
    const center = () => {
      if (x === undefined || y === undefined) return;
      element.scrollLeft = Math.max(0, x * scale - (element.clientWidth - 190 * scale) / 2);
      element.scrollTop = Math.max(0, y * scale - (element.clientHeight - 90 * scale) / 2);
    };
    center();
    const observer = new ResizeObserver(() => {
      // Hidden task stages retain their camera. Returning at the same size is
      // not a new selection or a request to center the diagram again.
      if (!element.clientWidth || !element.clientHeight) return;
      if (element.clientWidth === width && element.clientHeight === height) return;
      width = element.clientWidth;
      height = element.clientHeight;
      center();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [x, y, scale, frame]);
  return ref;
}

function flowSelectionPoint(
  nodes: { name: string; x: number; y: number }[],
  routes: FlowRoute[],
  name: string,
  relationship: string,
  selectedRouteKey: string,
  focus = "",
) {
  name ||= focus;
  if (name) return nodes.find((node) => node.name === name);
  if (!relationship || !routes.length) return undefined;
  const route = routes.find((route) => route.key === selectedRouteKey) ?? routes[0];
  return { x: (route.source.x + route.target.x) / 2, y: (route.source.y + route.target.y) / 2 };
}

function workflowName(name: string, definition: Schema["relationshipTypes"][string]) {
  return definition.workflow?.length
    ? [...new Set(definition.workflow.map((route) => route.label))].join(" · ")
    : name.replaceAll("_", " ");
}

function connectionPath(name: string, definition: Schema["relationshipTypes"][string]) {
  return `${definition.source?.join(", ") ?? "Any configured type"} → ${name} → ${definition.target?.join(", ") ?? "Any configured type"}`;
}

function FlowConnection({
  route,
  index,
  marker,
  showLabel,
  onSelect,
  onSelectRoute,
}: {
  route: FlowRoute;
  index: number;
  marker: string;
  showLabel: boolean;
  onSelect(name: string): void;
  onSelectRoute?(route: FlowRoute): void;
}) {
  const returning = route.feedback || route.target.x <= route.source.x;
  const select = () => (onSelectRoute ? onSelectRoute(route) : onSelect(route.name));
  return (
    <g className={`model-flow-route is-active ${returning ? "is-return" : ""}`}>
      <path d={flowPath(route, index)} markerEnd={`url(#${marker})`} />
      {showLabel && <FlowLabel route={route} index={index} onSelect={() => select()} />}
      <path className="flow-hit-target" d={flowPath(route, index)} onClick={select}>
        <title>
          {route.source.name} → {route.label} → {route.target.name}
        </title>
      </path>
    </g>
  );
}

function moveFlow(
  flow: ReturnType<typeof modelFlow>,
  positions: Record<string, { x: number; y: number }>,
) {
  const nodes = flow.nodes.map((node) => ({ ...node, ...positions[node.name] }));
  const byName = new Map(nodes.map((node) => [node.name, node]));
  return {
    ...flow,
    nodes,
    routes: flow.routes.map((route) => ({
      ...route,
      source: byName.get(route.source.name)!,
      target: byName.get(route.target.name)!,
    })),
    width: Math.max(flow.width, ...nodes.map((node) => node.x + 250)),
    height: Math.max(flow.height, ...nodes.map((node) => node.y + 140)),
  };
}

function dropType(event: React.DragEvent<HTMLDivElement>, scale: number, editing?: FlowEditing) {
  event.preventDefault();
  const name = event.dataTransfer.getData("application/tracer-type");
  if (!editing || !name) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  editing.onMove(
    name,
    Math.max(24, (event.clientX - bounds.left) / scale - 95),
    Math.max(60, (event.clientY - bounds.top) / scale - 40),
  );
}

function ModelFlowModes({
  mode,
  available,
  onMode,
}: {
  mode: "trace" | "workflow";
  available: boolean;
  onMode(mode: "trace" | "workflow"): void;
}) {
  return (
    <div className="model-flow-modes" role="group" aria-label="Model connection view">
      <button
        type="button"
        disabled={!available}
        aria-pressed={mode === "workflow"}
        onClick={() => onMode("workflow")}
      >
        Development flow
      </button>
      <button type="button" aria-pressed={mode === "trace"} onClick={() => onMode("trace")}>
        Trace connections
      </button>
      <span>
        {mode === "workflow"
          ? "Project-defined inputs, outputs and feedback."
          : "Stored relationship directions · configure explicit development flow in the model."}
      </span>
    </div>
  );
}

function displayedRoutes(
  layout: ReturnType<typeof modelFlow>,
  focus: string,
  relationship: string,
  mode: "trace" | "workflow",
) {
  if (focus || relationship)
    return layout.routes.filter((route) => routeActive(route, focus, relationship));
  return mode === "workflow" ? layout.routes : overviewRoutes(layout.routes, layout.nodes);
}

function useModelProjection(
  schema: Schema,
  focus: string,
  relationship: string,
  positions: Record<string, { x: number; y: number }>,
  workflowOnly: boolean,
  workflowParticipantsOnly = false,
) {
  const hasWorkflow = Object.values(schema.relationshipTypes).some(
    (definition) => definition.workflow?.length,
  );
  const [preferred, setPreferred] = useState<"workflow" | "trace">("workflow");
  const mode = workflowOnly ? "workflow" : hasWorkflow ? preferred : "trace";
  const whole = modelFlow(schema, mode, workflowParticipantsOnly);
  const layout = moveFlow(focusFlow(whole, focus), positions);
  const active = displayedRoutes(layout, focus, relationship, mode);
  return { hasWorkflow, mode, setPreferred, whole, layout, active };
}

function ModelMapControls({
  schema,
  mode,
  hasWorkflow,
  workflowOnly,
  relationship,
  onMode,
  onSelectRelationship,
}: {
  schema: Schema;
  mode: "trace" | "workflow";
  hasWorkflow: boolean;
  workflowOnly: boolean;
  relationship: string;
  onMode(mode: "trace" | "workflow"): void;
  onSelectRelationship(name: string): void;
}) {
  return (
    <>
      {" "}
      {!workflowOnly && <ModelFlowModes mode={mode} available={hasWorkflow} onMode={onMode} />}
      {workflowOnly && !hasWorkflow && (
        <p>
          No development paths are authored in this model. Types remain available; native
          permissions are separate.
        </p>
      )}
      {!workflowOnly && (
        <>
          <label className="model-route-select">
            Connection
            <select
              aria-label="Workflow connection"
              value={relationship}
              onChange={(event) => onSelectRelationship(event.target.value)}
            >
              <option value="">Overview</option>
              {Object.keys(schema.relationshipTypes).map((name) => (
                <option key={name} value={name}>
                  {mode === "workflow"
                    ? workflowName(name, schema.relationshipTypes[name])
                    : name.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <ul className="model-map-routes" aria-label="Workflow connections">
            {Object.entries(schema.relationshipTypes).map(([name, definition]) => (
              <li key={name}>
                <button
                  aria-label={`Select connection · ${connectionPath(name, definition)}`}
                  aria-pressed={relationship === name}
                  onClick={() => onSelectRelationship(name)}
                >
                  <strong>{name.replaceAll("_", " ")}</strong>
                  <small>
                    {endpointSummary(definition.source, "source")}
                    {definition.resourceSource ? " + native resources" : ""} →{" "}
                    {endpointSummary(definition.target, "target")}
                    {definition.resourceTarget ? " + native resources" : ""}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          <p className="model-pan-hint">Swipe or scroll horizontally to follow connections.</p>
        </>
      )}
    </>
  );
}

function ModelFlowRoutes({
  width,
  height,
  marker,
  routes,
  mode,
  onSelectRelationship,
  onSelectRoute,
}: {
  width: number;
  height: number;
  marker: string;
  routes: FlowRoute[];
  mode: "workflow" | "trace";
  onSelectRelationship(name: string): void;
  onSelectRoute?(route: FlowRoute): void;
}) {
  return (
    <svg width={width} height={height}>
      <defs>
        <marker
          id={marker}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
      </defs>
      {routes.map((route, index) => (
        <FlowConnection
          key={route.key}
          route={route}
          index={index}
          marker={marker}
          showLabel={mode === "workflow"}
          onSelect={onSelectRelationship}
          onSelectRoute={onSelectRoute}
        />
      ))}
    </svg>
  );
}

function ModelFlowViewport({
  scroll,
  layout,
  scale,
  editing,
  focus,
  selectedType,
  marker,
  active,
  mode,
  source,
  linking,
  onSelectType,
  onSelectRelationship,
  onSelectRoute,
}: {
  scroll: RefObject<HTMLDivElement | null>;
  layout: ReturnType<typeof modelFlow>;
  scale: number;
  editing?: FlowEditing;
  focus: string;
  selectedType: string;
  marker: string;
  active: FlowRoute[];
  mode: "trace" | "workflow";
  source: string;
  linking: boolean;
  onSelectType(name: string): void;
  onSelectRelationship(name: string): void;
  onSelectRoute?(route: FlowRoute): void;
}) {
  return (
    <div
      ref={scroll}
      className="model-flow-scroll"
      tabIndex={0}
      aria-label="Development workflow diagram"
    >
      <div
        className="model-flow-scaled"
        style={{ width: layout.width * scale, height: layout.height * scale }}
      >
        <div
          className="model-flow-canvas"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => dropType(event, scale, editing)}
        >
          {focus && (
            <div className="model-flow-headings" aria-hidden="true">
              <span>Incoming →</span>
              <span>Focus type</span>
              <span>→ Outgoing</span>
            </div>
          )}
          <ModelFlowRoutes
            width={layout.width}
            height={layout.height}
            marker={marker}
            routes={active}
            mode={mode}
            onSelectRelationship={onSelectRelationship}
            onSelectRoute={onSelectRoute}
          />
          <FlowTypeCards
            nodes={layout.nodes}
            routes={active}
            selected={selectedType || focus}
            source={source}
            linking={linking}
            editing={editing}
            showLabels={mode === "trace"}
            onSelect={onSelectType}
          />
        </div>
      </div>
    </div>
  );
}
