import type { EdgeTypes, NodeTypes } from "@xyflow/react";
import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import type { RefObject } from "react";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readableLabels } from "./connection-labels.ts";
import { typeNames } from "./model.ts";
import "./trace-walk.css";
import { WALK_LIMIT, appendWalkStep, connectionChoices, walkProjection } from "./trace-walk.ts";
import type {
  Display,
  FlowEdge,
  FlowNode,
  Geometry,
  MapEntity,
  MapIndex,
  MapLink,
  Organization,
  WalkSession,
  WalkStep,
} from "./types.ts";
import { useTraceDialog } from "./use-trace-dialog.ts";
import { useWalkLayout } from "./use-walk-layout.ts";
type PathReading = {
  index: MapIndex;
  organization: Organization;
  current: string;
  entity: MapEntity;
  startingScope: Set<string>;
  heading: RefObject<HTMLHeadingElement | null>;
  inspected: MapLink | undefined | null;
  steps: WalkStep[];
  follow(id: string): void;
  working: boolean;
  backTo(i: number): void;
  arrange(): void;
};
type WalkerProps = {
  session: WalkSession;
  model: { index: MapIndex; organization: Organization };
  renderer: { nodeTypes: NodeTypes; edgeTypes: EdgeTypes };
  onClose(): void;
  railVisible: boolean;
  initialDirection: Display["direction"];
};

function Choices({
  index,
  current,
  organization,
  visited,
  startingScope,
  onFollow,
  limited,
  busy,
}: {
  index: MapIndex;
  current: string;
  organization: Organization;
  visited: Set<string>;
  startingScope: Set<string>;
  onFollow(id: string): void;
  limited: boolean;
  busy: boolean;
}) {
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [page, setPage] = useState(0);
  const all = connectionChoices(index, current, organization);
  const choices = connectionChoices(index, current, organization, query, kind);
  const kinds = [...new Set(all.map(({ link }) => link.type))];
  const pageCount = Math.max(1, Math.ceil(choices.length / 8)),
    shown = choices.slice(page * 8, page * 8 + 8);
  return (
    <section className="walk-choices" aria-label="Next recorded connection">
      <h3>
        Follow a connection <small>{all.length}</small>
      </h3>
      <p>All recorded links, including hidden kinds. The starting map stays unchanged.</p>
      <input
        type="search"
        aria-label="Find a connection to follow"
        placeholder="Find item, folder or connection…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
        }}
      />
      <label>
        Connection kind{" "}
        <select
          aria-label="Connection kind to follow"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All kinds · {all.length}</option>
          {kinds.map((type) => (
            <option key={type} value={type}>
              {type.replaceAll("_", " ")} · {all.filter(({ link }) => link.type === type).length}
            </option>
          ))}
        </select>
      </label>
      {limited && (
        <p className="boundary">
          30-step path limit reached. Go back to a step or return to the map to start another path.
        </p>
      )}
      <div className="walk-options">
        {shown.map(({ link, outgoing, other, path }) => (
          <button
            key={link.id}
            disabled={limited || busy}
            aria-label={`Follow ${other.key} via ${link.type.replaceAll("_", " ")}`}
            onClick={() => onFollow(link.id)}
          >
            <span className="walk-relation">
              {outgoing ? "→" : "←"} {link.type.replaceAll("_", " ")} ·{" "}
              {outgoing ? "outgoing" : "incoming"}
            </span>
            <strong>
              {other.key} · {other.fields.title}
            </strong>
            <span className="walk-target-folder">
              {typeNames[other.type]} / {path.join(" / ")}
            </span>
            <span>
              {visited.has(other.id)
                ? "Already in this path · reuse item"
                : !startingScope.has(other.id)
                  ? "Outside starting scope · follow without changing it"
                  : "In starting scope"}
            </span>
          </button>
        ))}
        {!choices.length && (
          <p>
            {all.length
              ? "No matching connections. Clear the search or choose another kind."
              : "This item has no recorded connections."}
          </p>
        )}
      </div>
      <div className="walk-pager">
        <span>
          {choices.length ? page * 8 + 1 : 0}–{Math.min((page + 1) * 8, choices.length)} of{" "}
          {choices.length}
        </span>
        <button
          aria-label="Previous connection choices"
          disabled={!page}
          onClick={() => setPage((n) => n - 1)}
        >
          ←
        </button>
        <button
          aria-label="Next connection choices"
          disabled={page + 1 >= pageCount}
          onClick={() => setPage((n) => n + 1)}
        >
          →
        </button>
      </div>
    </section>
  );
}

function Walker({ session, model, renderer, onClose, railVisible, initialDirection }: WalkerProps) {
  const { index, organization } = model;
  const { nodeTypes, edgeTypes } = renderer;
  const { start, firstLink, returnFocus, origin, startingScope } = session;
  const flow = useReactFlow<FlowNode, FlowEdge>();
  const [steps, setSteps] = useState(() =>
    firstLink ? appendWalkStep(index, [{ id: start }], firstLink) : [{ id: start }],
  );
  const orientation = initialDirection;
  const [inspectedLink, setInspectedLink] = useState<string | null>(null);
  const current = steps.at(-1)!.id,
    entity = index.entities.get(current)!;
  const projection = useMemo(
    () => walkProjection(index, organization, steps),
    [index, organization, steps],
  );
  const frames = useRef<
    {
      geometry: Geometry;
      viewport: ReturnType<typeof flow.getViewport>;
      orientation: Display["direction"];
      width: number;
    }[]
  >([]);
  const { dialog, canvas, returnButton, heading, keyDown } = useTraceDialog(
    flow,
    current,
    steps.length,
    returnFocus,
    onClose,
  );
  const { geometry, working, error, request, arrange, moveNodes } = useWalkLayout(
    flow,
    projection,
    orientation,
    current,
    canvas,
  );
  function follow(linkId: string) {
    const source = geometry.nodes.find((node) => node.id === current);
    const position = source
      ? {
          x: source.position.x + (orientation === "RIGHT" ? source.width + 110 : 0),
          y: source.position.y + (orientation === "DOWN" ? source.height + 100 : 0),
        }
      : undefined;
    frames.current[steps.length - 1] = {
      geometry: geometry,
      viewport: flow.getViewport(),
      orientation,
      width: canvas.current?.clientWidth ?? 0,
    };
    request.current = { anchor: current };
    setSteps((old) => appendWalkStep(index, old, linkId, position));
    setInspectedLink(linkId);
  }
  function backTo(i: number) {
    if (i >= steps.length - 1 || working) return;
    const frame = frames.current[i];
    request.current =
      frame &&
      frame.orientation === orientation &&
      frame.width === (canvas.current?.clientWidth ?? 0)
        ? { geometry: frame.geometry, viewport: frame.viewport }
        : { fit: true };
    frames.current = frames.current.slice(0, i);
    setSteps((old) => old.slice(0, i + 1));
    setInspectedLink(i ? (steps[i].via ?? null) : null);
  }
  const nodes = geometry.nodes.map((node) => ({
    ...node,
    selected: node.id === current,
    zIndex: 2,
    data: { ...node.data, vertical: orientation === "DOWN", selected: node.id === current },
  }));
  const edges = geometry.edges.map((edge) => ({
    ...edge,
    data: {
      ...edge.data,
      showLabel: true,
      vertical: orientation === "DOWN",
      selfWidth: 280,
      selfHeight: 126,
      selected: edge.linkIds.includes(inspectedLink ?? ""),
      inspect: () => setInspectedLink(edge.linkIds[0]),
    },
  }));
  const labels = readableLabels(geometry.nodes, edges, orientation === "DOWN");
  for (const edge of edges) edge.data.readableLabel = labels.get(edge.id);
  const inspected = inspectedLink ? index.linkById.get(inspectedLink) : null;
  const reading: PathReading = {
    index,
    organization,
    current,
    entity,
    startingScope,
    heading,
    inspected,
    steps,
    follow,
    working,
    backTo,
    arrange,
  };
  return (
    <section
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Follow trace across folders"
      className={`trace-walker ${railVisible ? "" : "walk-full-width"}`}
      onKeyDown={keyDown}
    >
      <header className="walk-header">
        <div>
          <h1>Follow trace</h1>
          <p>Starting view: {origin} · kept unchanged</p>
        </div>
        <button ref={returnButton} onClick={onClose}>
          ← Return to starting view
        </button>
      </header>
      <WalkTrail reading={reading} />
      <div className="walk-workspace">
        <div
          className="walk-canvas"
          ref={canvas}
          aria-label="Chosen trace path"
          aria-busy={working}
          data-node-count={nodes.length}
          data-edge-count={edges.length}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            zIndexMode="manual"
            minZoom={0.2}
            maxZoom={1.8}
            nodesDraggable={!working}
            nodesConnectable={false}
            deleteKeyCode={null}
            edgesReconnectable={false}
            zoomOnDoubleClick={false}
            panOnScroll
            colorMode="dark"
            onNodesChange={moveNodes}
            onNodeClick={(_, node) => backTo(steps.findLastIndex((step) => step.id === node.id))}
            onEdgeClick={(_, edge) => setInspectedLink(edge.linkIds[0])}
          >
            <Background color="#353e43" gap={24} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
          {error && <p className="canvas-error">{error}</p>}
        </div>
        <WalkInspector reading={reading} />
      </div>
      <footer className="walk-status" aria-live="polite">
        {steps.length - 1} followed steps · {projection.totalRecords} unique items ·{" "}
        {projection.scopedLinks} recorded links. Only the chosen path is drawn; arrows retain native
        direction. {working ? "Updating path…" : ""}
      </footer>
    </section>
  );
}

export function TraceWalker(props: WalkerProps) {
  return createPortal(
    <ReactFlowProvider>
      <Walker {...props} />
    </ReactFlowProvider>,
    document.body,
  );
}

function WalkInspector({ reading }: { reading: PathReading }) {
  const {
    index,
    organization,
    current,
    entity,
    startingScope,
    heading,
    inspected,
    steps,
    follow,
    working,
  } = reading;
  return (
    <aside className="walk-inspector" aria-label="Current path item">
      <p className="type-label">
        {typeNames[entity.type]} / {(organization[current]?.path ?? ["Unfiled"]).join(" / ")}
      </p>
      {!startingScope.has(current) && (
        <p className="walk-outside">Outside starting scope · original filters kept</p>
      )}
      <h2 ref={heading} tabIndex={-1}>
        {entity.key} · {entity.fields.title}
      </h2>
      <p className="statement">{entity.fields.statement}</p>
      <details className="walk-mobile-details">
        <summary>Read item statement</summary>
        <p>{entity.fields.statement}</p>
      </details>
      {inspected && (
        <details className="walk-link-detail">
          <summary>Connection used · {inspected.type.replaceAll("_", " ")}</summary>
          <p>
            {index.entities.get(inspected.nativeSource)!.key} →{" "}
            {index.entities.get(inspected.nativeTarget)!.key}
          </p>
          <p>
            {inspected.fields?.scope
              ? typeof inspected.fields.scope === "string"
                ? inspected.fields.scope
                : JSON.stringify(inspected.fields.scope)
              : "No additional scope recorded."}
          </p>
        </details>
      )}
      <Choices
        key={current}
        index={index}
        current={current}
        organization={organization}
        visited={new Set(steps.map((step) => step.id))}
        startingScope={startingScope}
        onFollow={follow}
        limited={steps.length >= WALK_LIMIT}
        busy={working}
      />
    </aside>
  );
}
function WalkTrail({ reading }: { reading: PathReading }) {
  const { index, steps, working, backTo, arrange } = reading;
  return (
    <nav className="walk-trail" aria-label="Followed path">
      <button disabled={steps.length < 2 || working} onClick={() => backTo(steps.length - 2)}>
        ← Back one step
      </button>
      <button disabled={working} onClick={arrange}>
        Arrange path
      </button>
      <ol>
        {steps.map((step, i) => {
          const link = i ? index.linkById.get(step.via ?? "") : null;
          return (
            <li key={i}>
              {link && (
                <span
                  title={`${index.entities.get(link.nativeSource)!.key} → ${index.entities.get(link.nativeTarget)!.key}`}
                >
                  {link.nativeSource === steps[i - 1].id ? "→" : "←"}{" "}
                  {link.type.replaceAll("_", " ")}
                </span>
              )}
              <button
                disabled={working}
                aria-current={i === steps.length - 1 ? "step" : undefined}
                title={index.entities.get(step.id)!.fields.title}
                onClick={() => backTo(i)}
              >
                {index.entities.get(step.id)!.key}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
