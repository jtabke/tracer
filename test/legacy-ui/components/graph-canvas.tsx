import type { PointerEvent } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Graph } from "../../../src/application/views.ts";
import { label } from "../../../ui/fields.tsx";
import type { Camera, GraphEdge, Point } from "./graph-model.ts";
import { edges, fit, layout, nodeHeight, nodeWidth, title, zoom } from "./graph-model.ts";
import { graphEdgeGeometry } from "./graph-route.ts";
import { nodeStatus } from "./graph-status.ts";

type Gesture = {
  pointer: number;
  start: Point;
  camera: Camera;
  node?: string;
  origin?: Point;
  moved: boolean;
};
const shorten = (value: string, length: number) =>
  value.length > length ? value.slice(0, length - 1) + "…" : value;
export function GraphCanvas({
  graph,
  selectedNode,
  selectedEdge,
  receiptId,
  onNode,
  onEdge,
  onExpand,
  onFocus,
  canExpand = false,
  actionsDisabled = false,
  initialScale,
  provenance = "selected",
}: {
  graph: Graph;
  selectedNode?: string;
  selectedEdge?: string;
  receiptId?: string;
  onNode: (id: string) => void;
  onEdge: (edge: GraphEdge) => void;
  onExpand?: (id: string) => void;
  onFocus?: (id: string) => void;
  canExpand?: boolean;
  actionsDisabled?: boolean;
  initialScale?: number;
  provenance?: "native" | "selected" | "all";
}) {
  const canvasId = useId();
  const svg = useRef<SVGSVGElement>(null),
    gesture = useRef<Gesture | null>(null),
    suppressClick = useRef(false);
  const { points, camera, setCamera, setPositions, viewport, allLabels, setAllLabels } =
    useGraphPositions(graph, initialScale, svg, selectedNode);
  const screen = (x: number, y: number): Point => {
    const matrix = svg.current?.getScreenCTM();
    const point = matrix ? new DOMPoint(x, y).matrixTransform(matrix.inverse()) : { x, y };
    return { x: point.x, y: point.y };
  };
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const center = screen(event.clientX, event.clientY);
      setCamera((previous) =>
        zoom(previous, Math.exp(-Math.max(-150, Math.min(150, event.deltaY)) * 0.002), center),
      );
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  const down = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    if ((event.target as Element).closest("[data-edge], [data-node-actions]")) return;
    const node =
      (event.target as Element).closest("[data-node]")?.getAttribute("data-node") ?? undefined;
    const start = screen(event.clientX, event.clientY);
    gesture.current = {
      pointer: event.pointerId,
      start,
      camera,
      node,
      origin: node ? points[node] : undefined,
      moved: false,
    };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const action = gesture.current;
    if (!action || action.pointer !== event.pointerId) return;
    const point = screen(event.clientX, event.clientY),
      dx = point.x - action.start.x,
      dy = point.y - action.start.y;
    if (Math.hypot(dx, dy) > 4) action.moved = true;
    if (!action.moved) return;
    if (action.node && action.origin) {
      const id = action.node,
        origin = action.origin;
      setPositions((previous) => ({
        ...previous,
        [id]: { x: origin.x + dx / action.camera.scale, y: origin.y + dy / action.camera.scale },
      }));
    } else setCamera({ ...action.camera, x: action.camera.x + dx, y: action.camera.y + dy });
  };
  const up = (event: PointerEvent<SVGSVGElement>) => {
    const action = gesture.current;
    if (!action || action.pointer !== event.pointerId) return;
    suppressClick.current = action.moved;
    if (action.node && !action.moved) onNode(action.node);
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  function edgeClass(edge: GraphEdge) {
    return `graph-edge ${edge.phase ?? ""} ${graph.differences?.links.find((value) => value.id === edge.relationshipId)?.state ?? ""} ${edge.receiptId ? "dependency" : "ordinary"} ${selectedEdge === edge.id ? "selected" : ""}`;
  }
  const connections = edges(graph, receiptId, selectedNode, provenance === "all");
  const edgeGeometry = (edge: GraphEdge) => graphEdgeGeometry(edge, points, connections);
  return (
    <div className="graph-stage" data-all-labels={allLabels}>
      <div className="graph-canvas-toolbar">
        <GraphCanvasTools
          graph={graph}
          points={points}
          camera={camera}
          setCamera={setCamera}
          selectedNode={selectedNode}
          viewport={viewport}
          allLabels={allLabels}
          onLabels={setAllLabels}
        />
        <SelectedNodeActions
          id={selectedNode}
          onFocus={onFocus}
          onExpand={onExpand}
          canExpand={canExpand}
          disabled={actionsDisabled}
        />
      </div>
      <svg
        ref={svg}
        className="graph-canvas"
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        role="group"
        aria-label="Graph canvas"
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          gesture.current = null;
          suppressClick.current = true;
        }}
        onKeyDown={(event) => panCanvasWithKeyboard(event, setCamera)}
      >
        <defs>
          <pattern id={`${canvasId}-dots`} width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#39404c" />
          </pattern>
          <marker
            id={`${canvasId}-arrow`}
            markerWidth="9"
            markerHeight="9"
            refX="8"
            refY="4.5"
            orient="auto"
          >
            <path d="M0 0 L9 4.5 L0 9" fill="#687a6e" />
          </marker>
          <marker
            id={`${canvasId}-dependency-arrow`}
            markerWidth="9"
            markerHeight="9"
            refX="8"
            refY="4.5"
            orient="auto"
          >
            <path d="M0 0 L9 4.5 L0 9" fill="#7760ac" />
          </marker>
        </defs>
        <rect width={viewport.width} height={viewport.height} fill={`url(#${canvasId}-dots)`} />
        <g
          data-testid="graph-world"
          transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}
        >
          <GraphConnections
            connections={connections}
            graph={graph}
            geometry={edgeGeometry}
            edgeClass={edgeClass}
            canvasId={canvasId}
            selectedEdge={selectedEdge}
            selectedNode={selectedNode ?? graph.rootId}
            onEdge={onEdge}
          />
          <GraphNodes
            graph={graph}
            points={points}
            selectedNode={selectedNode}
            onNode={onNode}
            suppressClick={suppressClick}
            setPositions={setPositions}
          />
        </g>
      </svg>
      <GraphHelp historical={!!graph.temporal} nativeOnly={provenance === "native"} />
    </div>
  );
}

function SelectedNodeActions({
  id,
  onFocus,
  onExpand,
  canExpand,
  disabled,
}: {
  id?: string;
  onFocus?: (id: string) => void;
  onExpand?: (id: string) => void;
  canExpand: boolean;
  disabled: boolean;
}) {
  if (!id || !onFocus) return null;
  return (
    <div className="graph-node-actions" role="group" aria-label="Selected node actions">
      <button disabled={!canExpand} onClick={() => onExpand?.(id)}>
        Expand selected node
      </button>
      <button disabled={disabled} onClick={() => onFocus(id)}>
        Focus selected node
      </button>
    </div>
  );
}

function GraphHelp({ historical, nativeOnly }: { historical: boolean; nativeOnly: boolean }) {
  if (nativeOnly)
    return (
      <details className="graph-help">
        <summary>Canvas help and legend</summary>
        <p>
          Select a native record or connection to inspect it. Drag the background to pan, scroll to
          zoom, and drag nodes to arrange. Tab to a node and press Enter to inspect; arrow keys move
          a node or pan the focused canvas. Layout lasts for this session. These lines are recorded
          native relationships; evaluation dependencies and freshness are read in the inspector.
        </p>
      </details>
    );
  return (
    <details className="graph-help">
      <summary>Canvas help and legend</summary>
      <p>
        {historical
          ? "Select a native object to inspect its read-only snapshots."
          : "Select an evaluation to reveal its declared dependencies."}{" "}
        Drag the background to pan · scroll to zoom · drag nodes to arrange. Keyboard: Tab to a
        node, Enter to inspect, arrows to move; focus canvas for arrow-key panning. Layout lasts for
        this session only.
      </p>
      {historical ? (
        <div className="graph-legend">
          Native snapshots only · Added / Removed / Modified / Unchanged. No evidence freshness is
          reconstructed.
        </div>
      ) : (
        <div className="graph-legend">
          <span>
            <i className="ordinary" /> Ordinary relationship
          </span>
          <span>
            <i className="dependency" /> Declared evaluation dependency
          </span>
          <span className="graph-badge changed">Inputs changed</span>
          <span className="graph-badge unknown">Unknown</span>
          <span className="graph-badge current">Current</span>
        </div>
      )}
    </details>
  );
}

function markerUrl(canvasId: string, dependency: boolean) {
  return `url(#${canvasId}-${dependency ? "dependency-arrow" : "arrow"})`;
}

function initialGraphCamera(
  points: Point[],
  scale: number | undefined,
  viewport: { width: number; height: number },
): Camera {
  return scale === undefined ? fit(points, viewport) : { x: 40, y: 0, scale };
}
function edgeDescription(edge: GraphEdge, graph: Graph) {
  return `${edge.receiptId ? "Dependency" : "Connection"}: ${label(graph.nodes.find((value) => value.id === edge.source)!)} → ${label(graph.nodes.find((value) => value.id === edge.target)!)} (${capturedEdgeLabel(edge, graph)})`;
}
function capturedEdgeLabel(edge: GraphEdge, graph: Graph) {
  if (!edge.receiptId) return edge.name;
  const receipt = graph.evaluations.find((value) => value.receipt.id === edge.receiptId)?.receipt;
  const input = receipt?.inputs.find((value) => value.entityId === edge.target);
  return input ? `${edge.name} · captured v${input.entity.version}` : edge.name;
}
function edgeTitle(edge: GraphEdge) {
  return `${edge.name}${edge.receiptId ? " · explicitly declared evaluation input" : " · ordinary relationship"}`;
}

function GraphConnections({
  connections,
  graph,
  geometry,
  edgeClass,
  canvasId,
  selectedEdge,
  selectedNode,
  onEdge,
}: {
  connections: GraphEdge[];
  graph: Graph;
  geometry(
    edge: GraphEdge,
  ): { path: string; x1: number; x2: number; y1: number; y2: number; bend: number } | undefined;
  edgeClass(edge: GraphEdge): string;
  canvasId: string;
  selectedEdge?: string;
  selectedNode: string;
  onEdge(edge: GraphEdge): void;
}) {
  return (
    <>
      {connections.map((edge, index) => {
        const route = geometry(edge);
        if (!route) return null;
        const { path, x1, x2, y1, y2, bend } = route;
        return (
          <g
            key={edge.id}
            data-edge={edge.id}
            role="button"
            tabIndex={0}
            aria-label={edgeDescription(edge, graph)}
            aria-pressed={selectedEdge === edge.id}
            className={`${edgeClass(edge)} ${contextEdge(edge, selectedNode, selectedEdge) ? "is-context" : ""}`}
            onClick={() => onEdge(edge)}
            onKeyDown={(event) => {
              if (["Enter", " "].includes(event.key)) {
                event.preventDefault();
                onEdge(edge);
              }
            }}
          >
            <title>{edgeTitle(edge)}</title>
            <path d={path} className="edge-hit" />
            <path
              d={path}
              className="edge-line"
              markerEnd={markerUrl(canvasId, !!edge.receiptId)}
            />
            <text
              x={(x1 + x2) / 2}
              y={(y1 + y2) / 2 - bend * 0.75 - (index % 2) * 5}
              className="edge-label"
              textAnchor="middle"
            >
              {capturedEdgeLabel(edge, graph)}
            </text>
          </g>
        );
      })}
    </>
  );
}

function useGraphPositions(
  graph: Graph,
  initialScale: number | undefined,
  svg: React.RefObject<SVGSVGElement | null>,
  selectedNode?: string,
) {
  const viewport = useCanvasViewport(svg);
  const root = useRef("");
  const [allLabels, setAllLabels] = useState(false);
  const dimensions = useRef({ width: 0, height: 0 });
  const [positions, setPositions] = useState<Record<string, Point>>({}),
    [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const defaults = layout(graph),
    points = { ...defaults, ...positions };
  useEffect(() => {
    const scope = `${graph.rootId}:${graph.trace?.depth ?? "family"}`;
    if (!viewport.ready) return;
    if (root.current !== scope) {
      root.current = scope;
      dimensions.current = viewport;
      setPositions(defaults);
      setCamera(readableGraphCamera(defaults, graph.rootId, initialScale, viewport, selectedNode));
    } else {
      if (Math.abs(dimensions.current.width - viewport.width) > 50) {
        const dx = (viewport.width - dimensions.current.width) / 2;
        const dy = (viewport.height - dimensions.current.height) / 2;
        setCamera((previous) => ({ ...previous, x: previous.x + dx, y: previous.y + dy }));
      }
      dimensions.current = viewport;
      setPositions((previous) => ({ ...defaults, ...previous }));
    }
  }, [graph, selectedNode, viewport.width, viewport.height, viewport.ready]);

  return { points, camera, setCamera, setPositions, viewport, allLabels, setAllLabels };
}

function centerCamera(
  point: Point | undefined,
  viewport: { width: number; height: number },
  scale = 1,
): Camera {
  if (!point) return { x: 0, y: 0, scale: 1 };
  return {
    x: viewport.width / 2 - (point.x + nodeWidth / 2) * scale,
    y: viewport.height / 2 - (point.y + nodeHeight / 2) * scale,
    scale,
  };
}
function centerGraphSelection(
  points: Record<string, Point>,
  selected: string | undefined,
  root: string,
  viewport: { width: number; height: number },
) {
  return centerCamera(points[selected ?? root], viewport);
}
function readableGraphCamera(
  points: Record<string, Point>,
  root: string,
  scale: number | undefined,
  viewport: { width: number; height: number },
  selected?: string,
) {
  const overview = initialGraphCamera(Object.values(points), scale, viewport);
  if (overview.scale >= 0.7) return overview;
  const focus = selected && points[selected] ? selected : root;
  const context = fit([points[root], points[focus]], viewport);
  return focus !== root && context.scale >= 0.7
    ? context
    : centerCamera(points[focus], viewport, 0.8);
}

function GraphCanvasTools({
  graph,
  points,
  camera,
  setCamera,
  selectedNode,
  viewport,
  allLabels,
  onLabels,
}: {
  graph: Graph;
  viewport: { width: number; height: number };
  points: Record<string, Point>;
  camera: Camera;
  setCamera: React.Dispatch<React.SetStateAction<Camera>>;
  selectedNode?: string;
  allLabels: boolean;
  onLabels(value: boolean): void;
}) {
  return (
    <div className="graph-canvas-tools">
      <button
        onClick={() =>
          setCamera((previous) =>
            zoom(previous, 1.25, { x: viewport.width / 2, y: viewport.height / 2 }),
          )
        }
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        onClick={() =>
          setCamera((previous) =>
            zoom(previous, 0.8, { x: viewport.width / 2, y: viewport.height / 2 }),
          )
        }
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        onClick={() =>
          setCamera(
            fit(
              graph.nodes.map((node) => points[node.id]),
              viewport,
            ),
          )
        }
      >
        Overview
      </button>
      <button
        onClick={() =>
          setCamera(centerGraphSelection(points, selectedNode, graph.rootId, viewport))
        }
      >
        Center selection
      </button>
      <span aria-live="polite">{Math.round(camera.scale * 100)}%</span>
      <label className="graph-label-control">
        <input
          type="checkbox"
          checked={allLabels}
          onChange={(event) => onLabels(event.target.checked)}
        />
        All labels
      </label>
    </div>
  );
}

function GraphNodes({
  graph,
  points,
  selectedNode,
  onNode,
  suppressClick,
  setPositions,
}: {
  graph: Graph;
  points: Record<string, Point>;
  selectedNode?: string;
  onNode(id: string): void;
  suppressClick: React.RefObject<boolean>;
  setPositions: React.Dispatch<React.SetStateAction<Record<string, Point>>>;
}) {
  return (
    <>
      {graph.nodes.map((node) => {
        const point = points[node.id],
          status = nodeStatus(graph, node.id);
        return (
          <g
            key={node.id}
            data-node={node.id}
            data-testid={`graph-node-${label(node)}`}
            transform={`translate(${point.x} ${point.y})`}
            role="button"
            tabIndex={0}
            aria-label={`Node ${label(node)}: ${title(node)}`}
            aria-pressed={selectedNode === node.id}
            className={`graph-node ${status.state} ${selectedNode === node.id ? "selected" : ""}`}
            onClick={() => {
              if (!suppressClick.current) onNode(node.id);
              suppressClick.current = false;
            }}
            onKeyDown={(event) => {
              if (["Enter", " "].includes(event.key)) {
                event.preventDefault();
                onNode(node.id);
              }
              const offset: Record<string, Point> = {
                ArrowLeft: { x: -20, y: 0 },
                ArrowRight: { x: 20, y: 0 },
                ArrowUp: { x: 0, y: -20 },
                ArrowDown: { x: 0, y: 20 },
              };
              if (offset[event.key]) {
                event.preventDefault();
                event.stopPropagation();
                setPositions((previous) => ({
                  ...previous,
                  [node.id]: {
                    x: point.x + offset[event.key].x,
                    y: point.y + offset[event.key].y,
                  },
                }));
              }
            }}
          >
            <title>{`${title(node)} · ${status.text}`}</title>
            <rect width={nodeWidth} height={nodeHeight} rx="12" />
            <text x="16" y="23" className="node-type">
              {node.type.replaceAll("_", " ")}
            </text>
            <text x="16" y="47" className="node-name">
              {shorten(`${label(node)} · v${node.version}`, 30)}
            </text>
            <text x="16" y="68" className="node-title">
              {shorten(title(node), 32)}
            </text>
            <text x="16" y="94" className="node-status">
              {status.text}
            </text>
            {node.id === graph.rootId && <circle cx="212" cy="20" r="5" className="root-dot" />}
          </g>
        );
      })}
    </>
  );
}

function panCanvasWithKeyboard(
  event: React.KeyboardEvent<SVGSVGElement>,
  setCamera: React.Dispatch<React.SetStateAction<Camera>>,
) {
  if (event.target !== event.currentTarget) return;
  const direction: Record<string, Point> = {
    ArrowLeft: { x: 40, y: 0 },
    ArrowRight: { x: -40, y: 0 },
    ArrowUp: { x: 0, y: 40 },
    ArrowDown: { x: 0, y: -40 },
  };
  if (direction[event.key]) {
    event.preventDefault();
    setCamera((previous) => ({
      ...previous,
      x: previous.x + direction[event.key].x,
      y: previous.y + direction[event.key].y,
    }));
  }
  if (["+", "=", "-"].includes(event.key)) {
    event.preventDefault();
    setCamera((previous) => zoom(previous, event.key === "-" ? 0.8 : 1.25));
  }
}

function useCanvasViewport(svg: React.RefObject<SVGSVGElement | null>) {
  const [viewport, setViewport] = useState({ width: 1100, height: 650, ready: false });
  useLayoutEffect(() => {
    if (!svg.current) return;
    const bounds = svg.current.getBoundingClientRect();
    if (bounds.width > 0 && bounds.height > 0)
      setViewport({ width: bounds.width, height: bounds.height, ready: true });
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0)
        setViewport({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
          ready: true,
        });
    });
    observer.observe(svg.current);
    return () => observer.disconnect();
  }, []);
  return viewport;
}

function contextEdge(edge: GraphEdge, node: string, selected?: string) {
  return edge.source !== node && edge.target !== node && edge.id !== selected;
}
