import {
  fitCamera,
  graphProjection,
  investigationLayout,
  missingPosition,
  pathLayout,
  projectPoint as scalePoint,
  zoomCamera,
} from "./graph-geometry.ts";
import type { Camera, GraphLink, GraphPaths, Point, Size } from "./graph-geometry.ts";
type GraphLayoutState = {
  layout: Map<string, Point>;
  camera: Camera;
  scene: Size | null;
  projectedHeight: number | null;
  selected: string;
  pinned: Set<string>;
  visible: Set<string>;
  expandedLayout: boolean;
  pathLinkIds: Set<string> | null;
  pendingInvestigationLayout: GraphPaths | null;
  sheetState: string;
  fittedTitles: boolean;
  edge: string | null;
};
type Options = {
  state: GraphLayoutState;
  app: HTMLElement;
  native: boolean;
  trace(): { root: string; keys: string[] };
  links(): GraphLink[];
  visibleKeys(): string[];
  visibleLinks(): GraphLink[];
  panelMode(): string;
  drawNodeActions(): void;
};
export function createGraphLayout(options: Options) {
  const { state, app, visibleKeys, visibleLinks, panelMode } = options;
  function sceneSize() {
    if (!state.scene) throw new Error("Graph scene has not been measured");
    return state.scene;
  }
  function initialLayout(width: number, height: number) {
    if (!options.trace().keys.includes("PRS-01")) {
      const levels = new Map<string, number>([[options.trace().root, 0]]);
      for (let pass = 0; pass < 4; pass++)
        for (const link of visibleLinks())
          if (levels.has(link.source) && !levels.has(link.target))
            levels.set(link.target, levels.get(link.source)! + 1);
      state.layout = pathLayout({ keys: visibleKeys(), levels }, width, height);
      return;
    }
    const base = new Map([
      ["PRS-01", { x: width * 0.18, y: height * 0.46 }],
      ["SYS-03", { x: width * 0.51, y: height * 0.23 }],
      ["SYS-04", { x: width * 0.51, y: height * 0.41 }],
      ["SYS-09", { x: width * 0.51, y: height * 0.59 }],
      ["SYS-10", { x: width * 0.51, y: height * 0.77 }],
      ["VER-03", { x: width * 0.84, y: height * 0.46 }],
    ]);
    for (const [key, point] of base) state.layout.set(key, point);
  }
  function canvasViewport(canvas: HTMLElement = app.querySelector<HTMLElement>(".canvas")!) {
    const bounds = canvas.getBoundingClientRect();
    const inspector = app.querySelector<HTMLElement>(".inspector:not(.full-artifact)");
    let overlap = 0;
    if (panelMode() === "sheet" && inspector) {
      if (state.sheetState === "partial") {
        const area = app.querySelector<HTMLElement>(".workarea")!;
        inspector.style.height = `${Math.max(76, Math.min(260, area.clientHeight * 0.34, canvas.clientHeight - 300))}px`;
      }
      const sheet = inspector.getBoundingClientRect();
      if (sheet.top < bounds.bottom && sheet.right > bounds.left && sheet.left < bounds.right)
        overlap = Math.min(bounds.height, Math.max(0, bounds.bottom - sheet.top));
    }
    canvas.style.setProperty("--inspector-overlap", `${overlap}px`);
    const toolsHeight = canvas.querySelector<HTMLElement>(".canvas-tools")?.offsetHeight ?? 34;
    return {
      width: canvas.clientWidth,
      height: Math.max(80, canvas.clientHeight - overlap - toolsHeight - 30),
    };
  }
  function placeConnectionEndpoints() {
    if (!options.native || !state.edge) return false;
    const link = options.links().find((link) => link.id === state.edge);
    if (!link || [link.source, link.target].every((key) => state.layout.has(key))) return false;
    if (!state.expandedLayout) {
      for (const [key, point] of state.layout) state.layout.set(key, projectPoint(point));
    }
    const row = Math.max(...visibleKeys().map((key) => state.layout.get(key)?.y ?? 0)) + 120;
    for (const [index, key] of [link.source, link.target].entries()) {
      if (!state.layout.has(key)) state.layout.set(key, { x: 200 + index * 280, y: row });
    }
    state.expandedLayout = true;
    return true;
  }
  function placeMissing() {
    const known = state.layout;
    let index = 0;
    for (const key of visibleKeys())
      if (!known.has(key)) {
        const link = options
            .links()
            .find(
              (link) =>
                (link.source === key && known.has(link.target)) ||
                (link.target === key && known.has(link.source)),
            ),
          anchor = (link
            ? known.get(link.source === key ? link.target : link.source)
            : undefined) ?? {
            x: sceneSize().width / 2,
            y: sceneSize().height / 2,
          };
        known.set(key, missingPosition(anchor, sceneSize(), index, known.values()));
        index++;
      }
  }
  function expandedSlotAvailable(point: Point, key: string) {
    return [...state.layout].every(
      ([otherKey, other]) =>
        !state.visible.has(otherKey) ||
        otherKey === key ||
        Math.abs(point.x - other.x) >= 200 ||
        Math.abs(point.y - other.y) >= 90,
    );
  }
  function expansionRow(attempt: number) {
    if (!attempt) return 0;
    return Math.ceil(attempt / 2) * (attempt % 2 ? -1 : 1);
  }
  function arrangeExpanded(added: string[] = []) {
    // Existing node positions stay fixed. Only newly revealed cards claim free slots.
    if (!state.expandedLayout) {
      for (const [key, point] of state.layout) state.layout.set(key, projectPoint(point));
    }
    const anchor = state.layout.get(state.selected);
    if (!anchor) return;
    for (const key of added) {
      const incoming = visibleLinks().some(
        (link) => link.source === key && link.target === state.selected,
      );
      const direction = incoming ? -1 : 1;
      let point: Point = { ...anchor };
      for (let attempt = 0; attempt < 500; attempt++) {
        const row = expansionRow(attempt);
        point = { x: anchor.x + direction * 250, y: anchor.y + row * 104 };
        if (expandedSlotAvailable(point, key)) break;
      }
      state.layout.set(key, point);
    }
    state.expandedLayout = true;
  }
  function layoutInvestigation(canvas: HTMLElement, investigation: GraphPaths) {
    const viewport = canvasViewport(canvas),
      scale = projection();
    const workarea = app.querySelector<HTMLElement>(".workarea")!.getBoundingClientRect();
    const potentialHeight =
      panelMode() === "sheet"
        ? Math.min(
            viewport.height,
            Math.max(
              100,
              canvas.clientHeight -
                Math.max(76, Math.min(260, workarea.height * 0.34, canvas.clientHeight - 300)) -
                62,
            ),
          )
        : viewport.height;
    state.layout = investigationLayout(
      investigation,
      viewport,
      potentialHeight,
      scale,
      state.layout,
      state.pinned,
    );
    state.pendingInvestigationLayout = null;
  }
  function prepare(canvas: HTMLElement) {
    if (!state.scene) {
      state.scene = {
        width: Math.max(640, canvas.clientWidth),
        height: Math.max(510, canvas.clientHeight),
      };
      initialLayout(state.scene.width, state.scene.height);
    }
    if (state.projectedHeight === null)
      state.projectedHeight = Math.max(
        510,
        Math.min(sceneSize().height, canvas.clientHeight - 60 - (panelMode() === "sheet" ? 86 : 0)),
      );
    const investigation = state.pendingInvestigationLayout;
    if (investigation) layoutInvestigation(canvas, investigation);
    const frameNewConnection = placeConnectionEndpoints();
    placeMissing();
    const scene = canvas.querySelector<HTMLElement>(".scene")!;
    scene.style.width = projection().width + "px";
    scene.style.height = projection().height + "px";
    return frameNewConnection || Boolean(investigation);
  }
  function projection() {
    const points = visibleKeys().flatMap((key) => {
      const point = state.layout.get(key);
      return point ? [point] : [];
    });
    return graphProjection(
      sceneSize(),
      state.projectedHeight,
      state.expandedLayout && !state.pathLinkIds,
      points,
      app.querySelector<HTMLElement>(".canvas")?.clientWidth,
    );
  }
  function projectPoint(point: Point) {
    return scalePoint(point, projection());
  }
  function transform() {
    const canvas = app.querySelector<HTMLElement>(".canvas"),
      scene = app.querySelector<HTMLElement>(".scene");
    if (canvas) {
      canvas.classList.toggle("zoom-overview", state.camera.zoom < 0.7 && !state.fittedTitles);
      canvas.classList.toggle("fitted-titles", state.fittedTitles);
      canvas.style.setProperty("--camera-zoom", String(state.camera.zoom));
      canvasViewport(canvas);
    }
    if (scene)
      scene.style.transform = `translate(${state.camera.x}px,${state.camera.y}px) scale(${state.camera.zoom})`;
  }
  function zoomAt(value: number, x: number, y: number) {
    state.fittedTitles = false;
    state.camera = zoomCamera(state.camera, value, { x, y });
    transform();
    options.drawNodeActions();
  }
  function frame() {
    const canvas = app.querySelector<HTMLElement>(".canvas");
    if (!canvas || !visibleKeys().length) return;
    state.fittedTitles = true;
    for (let pass = 0; pass < 4; pass++) {
      transform();
      const nodes = [...canvas.querySelectorAll<HTMLElement>(".node")].map((node) => ({
        point: projectPoint(state.layout.get(node.dataset.key!)!),
        width: node.offsetWidth,
        height: node.offsetHeight,
      }));
      if (!nodes.length) return;
      state.camera = fitCamera(nodes, canvasViewport(canvas));
    }
    transform();
    options.drawNodeActions();
  }
  return {
    prepare,
    viewport: canvasViewport,
    projection,
    projectPoint,
    transform,
    zoomAt,
    arrangeExpanded,
    frame,
  };
}
