import type { FlowRoute, FlowType } from "./model-flow.ts";

export type FlowEditing = {
  source: string;
  onSource(name: string): void;
  onTarget(name: string): void;
  onConnect(source: string, target: string): void;
  onMove(name: string, x: number, y: number): void;
};

export function FlowTypeCards({
  nodes,
  routes,
  selected,
  linking,
  source,
  editing,
  showLabels = true,
  onSelect,
}: {
  nodes: FlowType[];
  routes: FlowRoute[];
  selected: string;
  linking: boolean;
  source: string;
  editing?: FlowEditing;
  showLabels?: boolean;
  onSelect(name: string): void;
}) {
  const connected = new Set(routes.flatMap((route) => [route.source.name, route.target.name]));
  return (
    <ul className="model-flow-types">
      {nodes.map((node) => (
        <li key={node.name} style={{ left: node.x, top: node.y }}>
          <button
            id={`model-node-${node.name}`}
            aria-label={`Select type · ${node.name}`}
            aria-pressed={linking ? source === node.name : selected === node.name}
            className={connected.has(node.name) || editing ? "flow-connected" : ""}
            onClick={() => onSelect(node.name)}
            draggable={!!editing}
            onDragStart={(event) => {
              event.dataTransfer.setData("application/tracer-type", node.name);
            }}
            onKeyDown={(event) => moveWithKeyboard(event, node, editing)}
          >
            <strong>{node.name.replaceAll("_", " ")}</strong>
            {!linking && showLabels && (
              <span className="flow-node-outputs">{outgoingLabels(routes, node.name)}</span>
            )}
            {linking && <small>{source === node.name ? "Source selected" : "Choose type"}</small>}
          </button>
          {editing && <FlowPorts node={node} editing={editing} />}
        </li>
      ))}
    </ul>
  );
}

function outgoingLabels(routes: FlowRoute[], name: string) {
  const names = [
    ...new Set(routes.filter((route) => route.source.name === name).map((route) => route.label)),
  ];
  return names.slice(0, 2).join(" · ") + (names.length > 2 ? ` · +${names.length - 2}` : "");
}

function moveWithKeyboard(event: React.KeyboardEvent, node: FlowType, editing?: FlowEditing) {
  if (!editing || !event.altKey) return;
  const steps: Record<string, [number, number]> = {
    ArrowLeft: [-40, 0],
    ArrowRight: [40, 0],
    ArrowUp: [0, -40],
    ArrowDown: [0, 40],
  };
  const step = steps[event.key];
  if (!step) return;
  event.preventDefault();
  editing.onMove(node.name, Math.max(24, node.x + step[0]), Math.max(60, node.y + step[1]));
}

function FlowPorts({ node, editing }: { node: FlowType; editing: FlowEditing }) {
  return (
    <>
      <button
        className="model-flow-port is-input"
        type="button"
        aria-label={`Connect to ${node.name}`}
        onClick={() => editing.onTarget(node.name)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const source = event.dataTransfer.getData("application/tracer-source");
          if (source) editing.onConnect(source, node.name);
        }}
      />
      <button
        className="model-flow-port is-output"
        type="button"
        aria-label={`Connect from ${node.name}`}
        aria-pressed={editing.source === node.name}
        onClick={() => editing.onSource(node.name)}
        draggable
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.setData("application/tracer-source", node.name);
          editing.onSource(node.name);
        }}
      />
    </>
  );
}
