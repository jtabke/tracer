import type { WorkspaceEntity } from "./workspace-snapshot.ts";

type State = {
  selected: string;
  selectedId?: string;
  recordIds?: Map<string, string>;
  visible: Set<string>;
  baseScope: Set<string>;
  matrixSubject: string | null;
  historySubject: { key: string; linkId: string | null; id?: string } | null;
  layout: Map<string, unknown>;
  drafts: Map<string, unknown>;
};
function remapKeys<T>(map: Map<string, T>, resolve: (key: string) => string) {
  const moved = [...map].map(([key, value]) => [resolve(key), value] as const);
  map.clear();
  for (const [key, value] of moved) map.set(key, value);
}
/** The recovery map carries only identities referenced by this view, never a project-wide label registry. */
function contextIds(state: State, records: Map<string, WorkspaceEntity>) {
  const ids = new Map<string, string>();
  for (const key of [
    state.selected,
    ...state.visible,
    ...state.baseScope,
    ...state.layout.keys(),
    ...state.drafts.keys(),
    state.matrixSubject,
    state.historySubject?.key,
  ]) {
    if (!key) continue;
    const id = records.get(key)?.id ?? state.recordIds?.get(key);
    if (id) ids.set(key, id);
  }
  return ids;
}
/** DOM labels stay readable, but selections, scope and drafts follow the same native object across snapshots. */
export function createWorkspaceIdentities() {
  let previous: Map<string, WorkspaceEntity> | undefined,
    selection = "";
  return (state: State, records: Map<string, WorkspaceEntity>) => {
    const identify = (key: string) => previous?.get(key)?.id ?? state.recordIds?.get(key);
    const selectedId =
      (!previous || selection === state.selected ? state.selectedId : undefined) ??
      identify(state.selected) ??
      records.get(state.selected)?.id;
    if (records !== previous) {
      const keys = new Map([...records.values()].map((record) => [record.id, record.key]));
      const resolve = (key: string, id = identify(key)) => {
        if (!id) return key;
        const resolved = keys.get(id) ?? (records.has(key) ? id : key);
        if (!keys.has(id)) (state.recordIds ??= new Map()).set(resolved, id);
        return resolved;
      };
      state.selected = resolve(state.selected, selectedId);
      state.visible = new Set([...state.visible].map((k) => resolve(k)));
      state.baseScope = new Set([...state.baseScope].map((k) => resolve(k)));
      if (state.matrixSubject) state.matrixSubject = resolve(state.matrixSubject);
      if (state.historySubject) {
        state.historySubject.id ??= identify(state.historySubject.key);
        state.historySubject.key = resolve(state.historySubject.key, state.historySubject.id);
      }
      remapKeys(state.layout, resolve);
      remapKeys(state.drafts, resolve);
      previous = records;
    }
    if (state.historySubject) state.historySubject.id ??= records.get(state.historySubject.key)?.id;
    state.selectedId = selectedId ?? records.get(state.selected)?.id;
    state.recordIds = contextIds(state, records);
    selection = state.selected;
  };
}
