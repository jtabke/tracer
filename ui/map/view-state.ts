import type { ViewChanges, WorkingView } from "./types.ts";
// Only the working view belongs here. Drafts, open tools, histories and native data keep their owners.
export function initialView({
  presets,
  defaultPreset,
  relationTypes,
}: {
  presets: Record<string, string[]>;
  defaultPreset: string;
  relationTypes: string[];
}): WorkingView {
  return {
    area: "All areas",
    folderScope: null,
    detail: "folders",
    representation: "graph",
    revealed: [],
    showBoundary: false,
    tray: null,
    preset: defaultPreset,
    types: presets[defaultPreset],
    relations: relationTypes,
    expanded: [],
    pages: {},
    focus: null,
    depth: 1,
    traceBranches: { key: null, steps: [] },
    direction: "downstream",
    selected: null,
    routeSelection: { key: null, route: null },
    display: {
      direction: "DOWN",
      spacing: "comfortable",
      labels: "context",
      links: "all",
      traceEmphasis: "context",
    },
  };
}
function applyField<K extends keyof WorkingView>(
  view: WorkingView,
  next: WorkingView,
  key: K,
  value: ViewChanges[K],
) {
  if (value === undefined) throw new Error("A view field cannot be undefined: " + key);
  const update = value as WorkingView[K] | ((previous: WorkingView[K]) => WorkingView[K]);
  next[key] = typeof update === "function" ? update(view[key]) : update;
}
export function viewReducer(view: WorkingView, changes: ViewChanges): WorkingView {
  const next = { ...view };
  for (const key of Object.keys(changes) as (keyof WorkingView)[]) {
    if (!Object.hasOwn(view, key)) throw new Error("Unknown view field: " + key);
    applyField(view, next, key, changes[key]);
  }
  return next;
}
function restoreField<K extends keyof WorkingView>(
  next: WorkingView,
  snapshot: WorkingView,
  key: K,
) {
  next[key] = snapshot[key];
}
// Snapshot envelopes contain camera/geometry too; restore only fields owned by the view.
export function viewOf(snapshot: WorkingView, current: WorkingView): WorkingView {
  const next = { ...current };
  for (const key of Object.keys(current) as (keyof WorkingView)[])
    restoreField(next, snapshot, key);
  return next;
}
