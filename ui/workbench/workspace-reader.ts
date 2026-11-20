import type * as Native from "./native-client.ts";
import type { ViewRequest } from "./native-client.ts";
import type { WorkspaceData } from "./workspace-session.ts";

type IntentState = {
  perspective: string;
  revision: number;
  timelineScope: string;
  timelineFilter: string;
  investigation: unknown;
  matrixMode: string;
  pathPreview?: unknown;
  selected: string;
  selectedId?: string;
  edge: string | null;
  historySubject: { key: string; id?: string; linkId?: string | null } | null;
  historyLimit: number;
  matrixRootType: string;
  matrixSteps: { type: string; targetType: string }[];
};
function viewScope(
  state: IntentState,
  head: number,
  wide: boolean,
  catalog: boolean,
): ViewRequest["scope"] {
  if (wide || state.revision !== head || state.perspective === "history" || state.investigation)
    return "project";
  if (state.perspective === "graph" && state.pathPreview) return "matrix";
  if (state.perspective === "matrix")
    return state.matrixMode === "relationships" ? "project" : "matrix";
  return catalog ? "catalog" : "opening";
}
function historyId(state: IntentState, records: ReadonlyMap<string, { id: string }> | undefined) {
  if (state.timelineFilter === "project" && state.timelineScope !== "selected") return undefined;
  const subject = state.historySubject;
  return subject
    ? (subject.linkId ?? subject.id ?? records?.get(subject.key)?.id)
    : (state.edge ?? records?.get(state.selected)?.id ?? state.selectedId);
}
export function viewIntent(
  state: IntentState,
  head: number,
  records: ReadonlyMap<string, { id: string }> | undefined,
  wideRequested: boolean,
  catalogRequested: boolean,
): ViewRequest {
  const scope = viewScope(state, head, wideRequested, catalogRequested);
  const history =
    state.perspective === "history" ||
    state.timelineScope === "selected" ||
    Boolean(state.investigation) ||
    state.revision !== head;
  return {
    revision: state.revision,
    history,
    subject: history ? historyId(state, records) : undefined,
    limit: state.historyLimit,
    focusId:
      scope === "catalog" ? (records?.get(state.selected)?.id ?? state.selectedId) : undefined,
    scope,
    entityTypes:
      scope === "matrix"
        ? [state.matrixRootType, ...state.matrixSteps.map((step) => step.targetType)].filter(
            Boolean,
          )
        : [],
    linkTypes: scope === "matrix" ? state.matrixSteps.map((step) => step.type) : [],
  };
}

/** Only publish a complete read for the latest intent. Loading never authorizes editing. */
export function createWorkspaceReader(
  native: Pick<typeof Native, "restoreWindow" | "installView" | "readView">,
  initial: WorkspaceData,
  callbacks: {
    replace(data: WorkspaceData): void;
    busy(value: boolean): void;
    ready(): void;
    failed(error: unknown): void;
  },
) {
  let base = initial,
    generation = 0,
    installed = "",
    requested = "";
  let pending: Promise<boolean> | undefined;
  let installedCurrent = false;
  return {
    reset(value: WorkspaceData) {
      base = value;
      generation++;
      installed = requested = "";
      installedCurrent = false;
      pending = undefined;
      callbacks.busy(false);
    },
    prepare(intent: ViewRequest) {
      const local =
        intent.revision === base.modelRevision &&
        !intent.history &&
        (base.projectWide || intent.scope === "opening");
      const key = local ? "initial" : JSON.stringify(intent);
      if (key === requested && pending) return pending;
      // A current typed/catalog view already contains the opening records and may own
      // the selected matrix artifact. Do not discard it simply for switching to Graph.
      if ((key === installed || (local && installedCurrent)) && !pending) return;
      const ticket = ++generation;
      requested = key;
      if (local) {
        installedCurrent = true;
        native.restoreWindow();
        callbacks.replace(base);
        installed = key;
        pending = undefined;
        callbacks.busy(false);
        return;
      }
      callbacks.busy(true);
      pending = native.readView(intent).then(
        ({ data, current }) => {
          if (ticket !== generation) return false;
          native.installView(current);
          callbacks.replace(data);
          installed = key;
          installedCurrent = intent.revision === base.modelRevision && !intent.history;
          pending = undefined;
          callbacks.busy(false);
          callbacks.ready();
          return true;
        },
        (error) => {
          if (ticket === generation) {
            pending = undefined;
            callbacks.busy(false);
            callbacks.failed(error);
          }
          return false;
        },
      );
      return pending;
    },
  };
}
