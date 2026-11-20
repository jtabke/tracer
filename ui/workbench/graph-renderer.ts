import { escapeHtml as e, mono } from "./html.ts";
import { titleCase, typeName } from "./presentation.ts";
import type { Point } from "./graph-geometry.ts";
import type { WorkspaceEntity } from "./workspace-snapshot.ts";
type Link = { id: string; source: string; target: string; type: string };
type EdgeState = {
  density: string;
  edge: string | null;
  selected: string;
  pathLinkIds: ReadonlySet<string> | null;
  fade: boolean;
};
type GraphState = EdgeState & {
  visible: ReadonlySet<string>;
  focusConfig: { direction: string; depth: number };
  focusReturn: unknown;
  filter: string;
  pathPreview: { revision: number } | null;
  inspector: boolean;
  localEntities: ReadonlyMap<string, unknown>;
};
type GraphShell = {
  state: GraphState;
  links: Link[];
  count: number;
  native: boolean;
  pathContext(): string;
  edgeDetail(): string;
};
export function graphPanel({ state, links, count, native, pathContext, edgeDetail }: GraphShell) {
  const filterTypes = [
    ...new Set(
      links
        .filter((link) => state.visible.has(link.source) && state.visible.has(link.target))
        .map((link) => link.type),
    ),
  ];
  return `<div class="graph-toolbar"><label class="sr-only" for="link-filter">Relationship filter</label><select id="link-filter"><option value="all">All relationships</option>${filterTypes.map((type) => `<option value="${e(type)}" ${state.filter === type ? "selected" : ""}>${e(titleCase(type))}</option>`).join("")}</select><form id="focus-form" class="neighborhood-controls" aria-label="Neighborhood focus"><label class="sr-only" for="focus-direction">Connection direction</label><select id="focus-direction" name="direction"><option value="downstream">Downstream</option><option value="upstream" ${state.focusConfig.direction === "upstream" ? "selected" : ""}>Upstream</option><option value="both" ${state.focusConfig.direction === "both" ? "selected" : ""}>Both directions</option></select><label class="sr-only" for="focus-depth">Connection depth</label><select id="focus-depth" name="depth">${[0, 1, 2, 3].map((depth) => `<option value="${depth}" ${state.focusConfig.depth === depth ? "selected" : ""}>${depth === 0 ? "This artifact" : `${depth} ${depth === 1 ? "step" : "steps"}`}</option>`).join("")}</select><button type="submit" class="focus-apply" title="Focus the scope on ${e(state.selected)}">Focus</button></form><label class="sr-only" for="node-detail">Node detail</label><select id="node-detail" aria-label="Node detail">${[
    ["compact", "Titles"],
    ["expanded", "Details"],
    ["overview", "Identifiers"],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}" ${state.density === value ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select>${state.focusReturn ? '<button class="return-scope" data-action="return-focus" title="Return to previous scope">← Previous scope</button>' : `<span class="graph-count">${count} links</span>`}</div>
${state.pathPreview ? `<div class="matrix-path-context"><span>Selected matrix path · r${state.pathPreview.revision}</span><button data-view="matrix">Back to matrix</button><button data-action="clear-matrix-path">Show neighborhood</button></div>` : state.pathLinkIds ? pathContext() : ""}
 <div class="canvas density-${state.density} mode-trace" aria-label="Engineering graph"><div class="scene"><svg class="edges" aria-label="Directed relationships"></svg><div class="node-layer"></div></div><div class="node-action-layer"></div><div class="canvas-tools" title="Scroll or pinch to zoom · Drag canvas to pan · Shift-scroll to pan"><button data-action="zoom-out" aria-label="Zoom out">−</button><button data-action="frame">Fit</button><button data-action="zoom-in" aria-label="Zoom in">+</button></div>${state.edge && !(state.inspector && native) ? edgeDetail() : ""}</div>`;
}

const layers = new WeakMap<Element, string>();
export function updateGraphNodes(
  layer: Element,
  state: GraphState,
  records: ReadonlyMap<string, WorkspaceEntity>,
  keys: string[],
  links: Link[],
  trace: { keys: string[]; preset?: boolean },
  changed: ReadonlySet<string>,
  latest: boolean,
  position: (key: string) => Point,
  icon: (type: string) => string,
) {
  const related = new Set([
    state.selected,
    ...links
      .filter((link) => link.source === state.selected || link.target === state.selected)
      .flatMap((link) => [link.source, link.target]),
  ]);
  const markup =
    (keys.every((key) => trace.keys.includes(key))
      ? `<div class="graph-lane" data-style="left:4%;width:28%"><span>${trace.preset ? "Product requirement" : "Selected artifact"}</span></div><div class="graph-lane" data-style="left:37%;width:28%"><span>${trace.preset ? "Subsystem allocations" : "Connections"}</span></div><div class="graph-lane" data-style="left:70%;width:28%"><span>${trace.preset ? "Verification plan" : "Connected artifacts"}</span></div>`
      : "") +
    keys
      .map((key) => {
        const record = records.get(key)!,
          point = position(key);
        return `<button class="node ${state.pathLinkIds ? "path-context" : ""} ${changed.has(key) ? "changed" : ""} ${key === state.selected ? "selected" : ""} ${state.fade && !related.has(key) ? "dim" : ""}" data-key="${e(key)}" data-style="left:${point.x}px;top:${point.y}px" aria-pressed="${key === state.selected}" title="${e(key)}: ${e(record.title)}" aria-label="${e(key)}: ${e(record.title)}"><span class="node-meta">${icon(record.type)}${mono(key)}${changed.has(key) ? '<span class="change-mark" title="Changed in selected revision">Δ</span>' : ""}${state.localEntities.has(key) && latest ? '<span class="local-dot" title="Local edit">●</span>' : ""}</span><strong>${e(record.title)}</strong>${state.density === "expanded" ? `<span class="node-type">${e(typeName(record.type))}</span>` : ""}</button>`;
      })
      .join("");

  if (layers.get(layer) !== markup) {
    layer.innerHTML = markup;
    layers.set(layer, markup);
  }
}
function edgeRoleClass(type: string) {
  if (type === "verified_by") return "verification-edge";
  if (["executed_as", "examines_output"].includes(type)) return "evidence-edge";
  if (type === "realized_by") return "implementation-edge";
  return ["decomposes_into", "depends_on"].includes(type) ? "" : "reference-edge";
}

export function graphEdges(
  links: Link[],
  state: EdgeState,
  trace: { root: string; keys: string[]; preset?: boolean },
  changed: ReadonlySet<string>,
  point: (key: string) => Point,
  bottom: () => number,
) {
  function renderEdge(link: Link, d: string, focused: boolean) {
    return `<g><title>${e(link.source)} → ${e(titleCase(link.type))} → ${e(link.target)}</title><path class="edge ${state.pathLinkIds?.has(link.id) ? "recorded-path" : ""} ${changed.has(link.id) ? "changed-edge" : ""} ${focused ? "focused" : state.fade ? "dim" : ""} ${edgeRoleClass(link.type)}" d="${d}" marker-end="url(#arrow)"/><path class="edgehit" d="${d}" data-edge="${e(link.id)}" tabindex="0" role="button" aria-label="${e(link.source)} ${e(titleCase(link.type))} ${e(link.target)}"/></g>`;
  }

  return (
    `<defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 8 4 0 8" fill="none" stroke="var(--edge)"/></marker></defs>` +
    links
      .map((link) => {
        const a = point(link.source),
          b = point(link.target),
          width = state.density === "overview" ? 72 : 174,
          height = state.density === "expanded" ? 100 : state.density === "overview" ? 32 : 66;
        const reverse = b.x < a.x;
        let sx = a.x + (reverse ? -width / 2 : width / 2),
          tx = b.x + (reverse ? width / 2 : -width / 2),
          sy = a.y,
          ty = b.y;
        let d;
        if (link.source === link.target) {
          d = `M${a.x + width / 2} ${a.y} C${a.x + width} ${a.y - height - 60} ${a.x - width} ${a.y - height - 60} ${a.x - width / 2} ${a.y}`;
        } else if (
          trace.preset &&
          link.source === trace.root &&
          link.target === trace.keys.at(-1)
        ) {
          sx = a.x;
          sy = a.y + height / 2;
          tx = b.x;
          ty = b.y + height / 2;
          const top = bottom() + height / 2 + 24;
          d = `M${sx} ${sy} V${top - 12} Q${sx} ${top} ${sx + 12} ${top} H${tx - 12} Q${tx} ${top} ${tx} ${top - 12} V${ty}`;
        } else if (Math.abs(a.x - b.x) < 2) {
          const side = a.x + width / 2 + 40;
          d = `M${a.x + width / 2} ${a.y} C${side} ${a.y} ${side} ${b.y} ${b.x + width / 2} ${b.y}`;
        } else {
          const mid = (sx + tx) / 2;
          d = `M${sx} ${sy} C${mid} ${sy} ${mid} ${ty} ${tx} ${ty}`;
        }
        const focused =
          link.id === state.edge ||
          link.source === state.selected ||
          link.target === state.selected;
        return renderEdge(link, d, focused);
      })
      .join("")
  );
}
