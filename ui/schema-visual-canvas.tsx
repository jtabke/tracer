import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Schema } from "../src/core/model.ts";
import { fitModelScale } from "./model-canvas-scale.ts";
import { ModelConnectionForm } from "./model-connection-form.tsx";
import { modelFlow } from "./model-flow.ts";
import { ModelMap } from "./model-map.tsx";
import { routeDefinition, selectedWorkflowKey } from "./model-selection.ts";
import type { DefinitionSelection } from "./schema-guided.tsx";
import "./schema-visual.css";

export function SchemaVisualCanvas({
  draft,
  version,
  selection,
  onSelect,
  onChange,
  flowOverview,
}: {
  draft: Schema;
  flowOverview?: boolean;
  version: number;
  selection: DefinitionSelection;
  onSelect(selection: DefinitionSelection): void;
  onChange(value: Schema): void;
}) {
  const layout = useCanvasLayout(draft, flowOverview);
  const [source, setSource] = useState("");
  const [connecting, setConnecting] = useState<{ source: string; target: string } | null>(null);
  const [notice, setNotice] = useState("");
  const { canvas, frame, frameSelection } = useModelFraming(
    draft,
    layout.positions,
    layout.setScale,
  );
  const connect = (source: string, target: string) => {
    if (!Object.hasOwn(draft.entityTypes, source) || !Object.hasOwn(draft.entityTypes, target))
      return;
    setConnecting({ source, target });
    setSource("");
    setNotice("");
  };
  return (
    <div className="schema-visual-canvas" ref={canvas}>
      <div className="schema-canvas-toolbar">
        <button type="button" onClick={() => onSelect({ group: "entityTypes", name: "" })}>
          ＋ Add type
        </button>
        <span>Drag types to arrange · connect output to input ports</span>
        <CanvasControls
          canFrame={!!selection.name}
          onFrame={() => {
            frameSelection();
          }}
          scale={layout.scale}
          onScale={layout.setScale}
          onReset={layout.reset}
          onFit={() => layout.setScale(fitModelCanvas(canvas.current, draft, layout.positions))}
        />
      </div>
      {source && (
        <p className="model-link-prompt" role="status">
          Connecting from {source}. Choose a target port.{" "}
          <button type="button" onClick={() => setSource("")}>
            Cancel connection
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {connecting && (
        <ModelConnectionForm
          schema={draft}
          source={connecting.source}
          target={connecting.target}
          busy={false}
          version={version}
          draftOnly
          onCancel={() => setConnecting(null)}
          onCreate={async (name, definition) => {
            onChange({
              ...draft,
              relationshipTypes: { ...draft.relationshipTypes, [name]: definition },
            });
            onSelect({ group: "relationshipTypes", name });
            return true;
          }}
        />
      )}
      <ModelMap
        workflowParticipantsOnly={flowOverview}
        frameRequest={frame}
        focus=""
        schema={draft}
        selectedType={selection.group === "entityTypes" ? selection.name : ""}
        relationship={selection.group === "relationshipTypes" ? selection.name : ""}
        selectedRouteKey={selectedWorkflowKey(draft, selection)}
        linking={false}
        source=""
        positions={layout.positions}
        scale={layout.scale}
        editing={{
          source,
          onSource: (name) => {
            setSource(name);
            setNotice("");
          },
          onTarget: (name) => {
            if (source) connect(source, name);
            else setNotice("Choose a source output port first, then this target port.");
          },
          onConnect: connect,
          onMove: layout.move,
        }}
        onSelectType={(name) => onSelect({ group: "entityTypes", name })}
        onSelectRelationship={(name) => onSelect({ group: "relationshipTypes", name })}
        onSelectRoute={(route) => onSelect(routeDefinition(draft, route))}
      />
      {!Object.keys(draft.entityTypes).length && (
        <p className="schema-canvas-empty">
          Add your first type, then connect it to the types it feeds or references.
        </p>
      )}
      <p className="schema-layout-note">
        Arrange with drag or Alt + arrow keys. Layout is retained while configuring; Save model
        saves definitions and connection rules.
      </p>
      {layout.scale < 0.7 && (
        <p className="schema-layout-note">
          Overview scale. Select a type, then Frame selection to read its connections.
        </p>
      )}
    </div>
  );
}

function CanvasControls({
  scale,
  onScale,
  onFit,
  onReset,
  onFrame,
  canFrame,
}: {
  scale: number;
  onScale(value: number): void;
  onFit(): void;
  onReset(): void;
  onFrame(): void;
  canFrame: boolean;
}) {
  return (
    <div className="schema-canvas-controls" aria-label="Model canvas controls">
      <button
        type="button"
        aria-label="Zoom out model"
        disabled={scale <= 0.15}
        onClick={() => onScale(Math.max(0.15, scale - 0.1))}
      >
        −
      </button>
      <span>{Math.round(scale * 100)}%</span>
      <button
        type="button"
        aria-label="Zoom in model"
        disabled={scale >= 1.5}
        onClick={() => onScale(Math.min(1.5, scale + 0.1))}
      >
        ＋
      </button>
      <button type="button" disabled={!canFrame} onClick={onFrame}>
        Frame selection
      </button>
      <button type="button" onClick={onFit}>
        Overview
      </button>
      <button type="button" onClick={onReset}>
        Reset layout
      </button>
    </div>
  );
}

function initialPositions(draft: Schema) {
  return Object.fromEntries(
    modelFlow(
      draft,
      Object.values(draft.relationshipTypes).some((definition) => definition.workflow?.length)
        ? "workflow"
        : "trace",
    ).nodes.map((node) => [node.name, { x: node.x, y: node.y }]),
  );
}
function useCanvasLayout(draft: Schema, flowOverview = false) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() =>
    flowOverview ? {} : initialPositions(draft),
  );
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!flowOverview) setPositions((before) => appendPositions(before, draft));
  }, [draft, flowOverview]);
  return {
    positions,
    scale,
    setScale,
    move: (name: string, x: number, y: number) =>
      setPositions((before) => ({ ...before, [name]: { x, y } })),
    reset: () => {
      setPositions(flowOverview ? {} : initialPositions(draft));
      setScale(1);
    },
  };
}
function appendPositions(before: Record<string, { x: number; y: number }>, draft: Schema) {
  const names = Object.keys(draft.entityTypes).filter((name) => !Object.hasOwn(before, name));
  if (!names.length) return before;
  const y = Math.max(0, ...Object.values(before).map((position) => position.y));
  return {
    ...before,
    ...Object.fromEntries(
      names.map((name, index) => [
        name,
        { x: 48 + (index % 4) * 270, y: y + 140 + Math.floor(index / 4) * 140 },
      ]),
    ),
  };
}

function useInitialModelPageFit(
  canvas: { current: HTMLDivElement | null },
  draft: Schema,
  positions: Record<string, { x: number; y: number }>,
  setScale: (value: number) => void,
) {
  const fit = useEffectEvent(() => {
    if (canvas.current?.closest(".model-page"))
      setScale(fitModelCanvas(canvas.current, draft, positions));
  });
  useEffect(() => {
    fit();
  }, []);
}

function fitModelCanvas(
  element: HTMLDivElement | null,
  draft: Schema,
  positions: Record<string, { x: number; y: number }>,
) {
  const workflow = Object.values(draft.relationshipTypes).some(
    (definition) => definition.workflow?.length,
  );
  const bounds = modelFlow(draft, workflow ? "workflow" : "trace");
  const canvas = element?.querySelector<HTMLElement>(".model-flow-canvas");
  const width =
    canvas?.offsetWidth ||
    Math.max(bounds.width, ...Object.values(positions).map((point) => point.x + 250));
  const height =
    canvas?.offsetHeight ||
    Math.max(bounds.height, ...Object.values(positions).map((point) => point.y + 140));
  const viewport = element?.querySelector<HTMLElement>(".model-flow-scroll");
  return fitModelScale(
    {
      width: Math.max(100, (viewport?.clientWidth || element?.clientWidth || 1110) - 24),
      height: viewport?.clientHeight || 660,
    },
    { width, height },
  );
}

function useModelFraming(
  draft: Schema,
  positions: Record<string, { x: number; y: number }>,
  setScale: (value: number) => void,
) {
  const [frame, setFrame] = useState(0);
  const canvas = useRef<HTMLDivElement>(null);
  useInitialModelPageFit(canvas, draft, positions, setScale);
  return {
    canvas,
    frame,
    frameSelection() {
      setScale(1);
      setFrame((value) => value + 1);
    },
  };
}
