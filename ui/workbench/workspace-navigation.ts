import type { Camera, GraphLink, GraphPaths, Point } from "./graph-geometry.ts";
import type { MatrixDraft } from "./matrix-types.ts";

type Perspective = "graph" | "matrix" | "history";
type HistorySubject = { key: string; linkId: string | null };
type Investigation = { subject: HistorySubject; event: number; revision: number };
type FocusReturn = {
  visible: string[];
  baseScope?: string[];
  filter: string;
  pathIds: string[] | null;
  matrixScope?: string;
  layout?: [string, Point][];
};
type InvestigationPaths = GraphPaths & { roots: string[]; links: GraphLink[] };
type FocusTarget =
  | Perspective
  | "inspector-close"
  | "draft-title"
  | "details"
  | "artifact-heading"
  | { key: string };
type NavigationState = {
  selected: string;
  visible: Set<string>;
  baseScope: Set<string>;
  perspective: Perspective;
  revision: number;
  event: number;
  assessment: number | null;
  inspector: boolean;
  inspectorPrefs: Record<Perspective, boolean>;
  sheetState: "collapsed" | "partial";
  pathLinkIds: Set<string> | null;
  pathRoot: string | null;
  pathRevision: number | null;
  investigation: Investigation | null;
  editing: boolean;
  inlineField: string | null;
  filter: string;
  timelineFilter: string;
  historySubject: HistorySubject | null;
  matrixScope: string;
  matrixSubject: string | null;
  // These drafts/previews retain their existing owners; navigation only checks presence or clears the preview.
  matrixDraft: MatrixDraft | null;
  pathPreview: { keys: string[]; links: string[]; revision: number } | null;
  artifactFull: boolean;
  evidenceOpen: boolean;
  focusReturn: FocusReturn | null;
  expansions: Map<string, string[]>;
  layout: Map<string, Point>;
  expandedLayout: boolean;
  pendingInvestigationLayout: InvestigationPaths | null;
  camera: Camera;
  edge: string | null;
  more: boolean;
  notice: string;
};
type Options = {
  state: NavigationState;
  head(): number;
  trace(): { root: string; keys: string[] };
  relevantFeed(): { revision: number }[];
  paths(revision: number): InvestigationPaths;
  neighborhood(): { keys: string[]; omitted: number };
  selection: { clear(): void; flush(): void };
  rememberDraft(): void;
  beginDraft(): void;
  render(): void;
  notify(message: string): void;
  panelMode(): string;
  focus(target: FocusTarget): void;
  revealMatrixRelationship(): void;
};

export function createNavigationState(
  root: string,
  keys: string[],
  head: number,
  view: string | null,
  wide: boolean,
): NavigationState {
  return {
    selected: root,
    visible: new Set(keys),
    baseScope: new Set(keys),
    perspective: view === "matrix" || view === "history" ? view : "graph",
    revision: head,
    event: head,
    assessment: null,
    inspector: view === "matrix" ? false : wide,
    inspectorPrefs: { graph: wide, matrix: false, history: wide },
    sheetState: "collapsed",
    pathLinkIds: null,
    pathRoot: null,
    pathRevision: null,
    investigation: null,
    editing: false,
    inlineField: null,
    filter: "all",
    timelineFilter: "selected",
    historySubject: null,
    matrixScope: "selected",
    matrixSubject: null,
    matrixDraft: null,
    pathPreview: null,
    artifactFull: false,
    evidenceOpen: false,
    focusReturn: null,
    expansions: new Map(),
    layout: new Map(),
    expandedLayout: false,
    pendingInvestigationLayout: null,
    camera: { zoom: 1, x: 0, y: 0 },
    edge: null,
    more: false,
    notice: "",
  };
}

// Operates on the workspace's single state object. Draft capture and presentation
// effects stay explicit so navigation preserves their original ordering.
export function createWorkspaceNavigation(options: Options) {
  const { state } = options;
  function pickEvent(revision: number | string, { showHistory = false } = {}) {
    state.evidenceOpen = false;
    options.rememberDraft();
    if (showHistory && !state.historySubject)
      state.historySubject = { key: state.selected, linkId: state.edge };
    state.event = Number(revision);
    state.revision = state.event;
    state.assessment = state.event;
    state.inlineField = null;
    state.editing = false;
    if (showHistory && state.perspective !== "history") {
      changePerspective("history");
      return;
    }
    options.render();
  }

  function stepEvent(delta: number) {
    const feed = options.relevantFeed().sort((a, b) => a.revision - b.revision),
      index = feed.findIndex((event) => event.revision === state.event);
    const next =
      index < 0
        ? delta < 0
          ? feed.filter((event) => event.revision < state.event).at(-1)
          : feed.find((event) => event.revision > state.event)
        : feed[index + delta];
    if (next) pickEvent(next.revision);
  }

  function select(key: string, open = false) {
    state.evidenceOpen = false;
    options.selection.clear();
    options.rememberDraft();
    state.selected = key;
    if (!state.pathPreview && !state.matrixDraft) state.matrixSubject = null;
    state.historySubject = null;
    state.edge = null;
    state.more = false;
    state.editing = false;
    state.inlineField = null;
    if (open) state.inspector = true;
    options.render();
    if (state.inspector && options.panelMode() === "drawer" && !state.artifactFull)
      options.focus("inspector-close");
    else options.focus({ key });
  }

  function showDetails(edit = false) {
    options.rememberDraft();
    state.inspector = true;
    state.editing = edit && state.revision === options.head();
    state.inlineField = null;
    if (state.editing) {
      options.beginDraft();
      state.sheetState = "partial";
    }
    options.render();
    if (options.panelMode() === "drawer") options.focus("inspector-close");
    else if (edit) options.focus("draft-title");
  }

  function closeDetails() {
    options.rememberDraft();
    state.inspector = false;
    state.artifactFull = false;
    state.inlineField = null;
    state.editing = false;
    options.render();
    options.focus("details");
  }

  function changePerspective(view: Perspective) {
    state.evidenceOpen = false;
    options.selection.flush();
    options.rememberDraft();
    if (view === "history" && !state.historySubject)
      state.historySubject = { key: state.selected, linkId: state.edge };
    if (!state.artifactFull) state.inspectorPrefs[state.perspective] = state.inspector;
    state.perspective = view;
    state.inspector = state.inspectorPrefs[view];
    state.artifactFull = false;
    options.render();
    if (view === "matrix" && state.edge) options.revealMatrixRelationship();
    options.focus(view);
  }

  function visitRevision(revision: number | string) {
    state.evidenceOpen = false;
    options.rememberDraft();
    state.revision = Math.max(1, Math.min(options.head(), Number(revision)));
    state.event = state.revision;
    state.editing = false;
    state.inlineField = null;
    state.assessment = state.revision;
    options.notify(
      state.revision === options.head()
        ? "Latest revision · local edits restored"
        : `Revision ${state.revision} · read-only`,
    );
    options.render();
  }

  function openArtifactAction() {
    state.inspectorPrefs[state.perspective] = state.inspector;
    state.artifactFull = true;
    state.inspector = true;
    options.render();
    options.focus("artifact-heading");
    return;
  }

  function backWorkspaceAction() {
    state.inspector = state.inspectorPrefs[state.perspective];
    state.artifactFull = false;
    state.editing = false;
    state.inlineField = null;
    options.render();
  }

  function artifactHistoryAction() {
    state.edge = null;
    state.historySubject = { key: state.selected, linkId: null };
    state.timelineFilter = "selected";
    changePerspective("history");
    return;
  }

  function relationshipHistoryAction() {
    state.historySubject = { key: state.selected, linkId: state.edge };
    state.timelineFilter = "selected";
    changePerspective("history");
    return;
  }

  function returnFocusAction() {
    if (state.focusReturn) {
      state.visible = new Set(state.focusReturn.visible);
      state.baseScope = new Set(state.focusReturn.baseScope ?? state.focusReturn.visible);
      state.filter = state.focusReturn.filter;
      state.pathLinkIds = state.focusReturn.pathIds ? new Set(state.focusReturn.pathIds) : null;
      state.matrixScope = state.focusReturn.matrixScope ?? state.matrixScope;
      if (state.focusReturn.layout) state.layout = new Map(state.focusReturn.layout);
      state.focusReturn = null;
      state.expansions.clear();
    }
    options.render();
  }

  function resetAction() {
    state.expandedLayout = false;
    state.visible = new Set(options.trace().keys);
    state.baseScope = new Set(options.trace().keys);
    state.expansions.clear();
    state.pathLinkIds = null;
    state.investigation = null;
    state.focusReturn = null;
    state.historySubject = null;
    state.selected = options.trace().root;
    state.pathPreview = null;
    state.matrixSubject = null;
    state.filter = "all";
    state.edge = null;
    state.camera = { zoom: 1, x: 0, y: 0 };
    options.render();
  }

  function focusAction() {
    if (!state.focusReturn)
      state.focusReturn = {
        visible: [...state.visible],
        filter: state.filter,
        pathIds: state.pathLinkIds ? [...state.pathLinkIds] : null,
        matrixScope: state.matrixScope,
      };
    const result = options.neighborhood();
    state.visible = new Set(result.keys);
    state.baseScope = new Set(result.keys);
    state.expansions.clear();
    options.notify(
      `Focused ${state.selected}${result.omitted ? `; ${result.omitted} beyond the 50-artifact limit` : ""}`,
    );
    options.render();
  }

  function returnChangeAction() {
    if (state.investigation) {
      state.historySubject = { ...state.investigation.subject };
      state.event = state.investigation.event;
      state.revision = state.investigation.revision;
      changePerspective("history");
    }
    return;
  }

  function expandSheetAction() {
    state.sheetState = "partial";
    state.inspector = true;
    options.render();
  }

  function collapseSheetAction() {
    options.rememberDraft();
    state.sheetState = "collapsed";
    state.editing = false;
    state.inlineField = null;
    options.render();
  }

  function inspectRevisionAction() {
    options.rememberDraft();
    const paths = options.paths(state.event);
    state.investigation = {
      subject: state.historySubject
        ? { ...state.historySubject }
        : { key: state.selected, linkId: state.edge },
      event: state.event,
      revision: state.event,
    };
    if (!state.focusReturn)
      state.focusReturn = {
        visible: [...state.visible],
        filter: state.filter,
        pathIds: state.pathLinkIds ? [...state.pathLinkIds] : null,
        matrixScope: state.matrixScope,
      };
    if (!state.focusReturn.layout)
      state.focusReturn.layout = [...state.layout].map(([key, point]) => [key, { ...point }]);
    state.pendingInvestigationLayout = paths;
    state.pathPreview = null;
    state.visible = new Set(paths.keys);
    state.baseScope = new Set(paths.keys);
    state.pathLinkIds = new Set(paths.links.map((link) => link.id));
    state.pathRoot = paths.roots[0];
    state.pathRevision = state.event;
    state.matrixScope = "neighborhood";
    if (paths.roots.length && !paths.keys.includes(state.selected)) state.selected = paths.roots[0];
    state.edge = null;
    state.filter = "all";
    visitRevision(state.event);
    state.notice = "";
    changePerspective("graph");
    return;
  }
  return {
    pickEvent,
    stepEvent,
    select,
    showDetails,
    closeDetails,
    changePerspective,
    visitRevision,
    openArtifactAction,
    backWorkspaceAction,
    artifactHistoryAction,
    relationshipHistoryAction,
    returnFocusAction,
    resetAction,
    focusAction,
    returnChangeAction,
    expandSheetAction,
    collapseSheetAction,
    inspectRevisionAction,
  };
}
