type ContextState = Record<string, unknown>;
type ContextStorage = {
  getItem(key: string): string | null | undefined;
  setItem(key: string, value: string): void;
};
type SavedContext = {
  version: 1;
  head: number;
  drafts: boolean;
  uncertain: boolean;
  context: ContextState;
};
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const point = (value: unknown) =>
  object(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
function camera(value: unknown) {
  return point(value) && object(value) && Number.isFinite(value.zoom);
}
function matrixSteps(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 7 &&
    value.every(
      (step) =>
        object(step) && typeof step.type === "string" && typeof step.targetType === "string",
    )
  );
}
// Browser-local presentation context. Never restore drafts, evidence tokens or mutation attempts.
const fields = [
  "selected",
  "visible",
  "baseScope",
  "perspective",
  "revision",
  "inspector",
  "inspectorPrefs",
  "sheetState",
  "pathLinkIds",
  "pathRoot",
  "pathRevision",
  "timelineScope",
  "investigation",
  "width",
  "filter",
  "timelineFilter",
  "historySubject",
  "matrixScope",
  "matrixSubject",
  "matrixPresentation",
  "matrixDensity",
  "matrixScroll",
  "matrixPath",
  "pathPreview",
  "matrixMode",
  "matrixRootType",
  "matrixSteps",
  "matrixSearch",
  "evidenceSubject",
  "evidenceReturnView",
  "evidenceOpen",
  "focusConfig",
  "focusReturn",
  "expansions",
  "pinned",
  "event",
  "layout",
  "scene",
  "expandedLayout",
  "projectedHeight",
  "camera",
  "fittedTitles",
  "fade",
];
const replace = (_key: string, value: unknown) =>
  value instanceof Map ? { $map: [...value] } : value instanceof Set ? { $set: [...value] } : value;
function revive(_key: string, value: unknown): unknown {
  if (!object(value)) return value;
  if (Array.isArray(value.$map)) return new Map(value.$map as [unknown, unknown][]);
  if (Array.isArray(value.$set)) return new Set(value.$set);
  return value;
}
function compatibleField(context: ContextState, state: ContextState, field: string) {
  if (!Object.hasOwn(context, field)) return state[field] === undefined;
  const value = context[field],
    initial = state[field];
  if (initial instanceof Map) return value instanceof Map;
  if (initial instanceof Set) return value instanceof Set;
  if (Array.isArray(initial)) return Array.isArray(value);
  return initial === null || typeof value === typeof initial;
}
function validContext(
  context: unknown,
  state: ContextState,
  head: number,
): context is ContextState {
  if (!object(context)) return false;
  if (!fields.every((field) => compatibleField(context, state, field))) return false;
  if (typeof context.revision !== "number" || !Number.isInteger(context.revision)) return false;
  if (context.revision < 0 || context.revision > head) return false;
  if (
    typeof context.perspective !== "string" ||
    !["graph", "matrix", "history"].includes(context.perspective)
  )
    return false;
  return (
    camera(context.camera) &&
    matrixSteps(context.matrixSteps) &&
    context.layout instanceof Map &&
    [...context.layout.values()].every(point)
  );
}
function validSave(saved: unknown, state: ContextState, head: number): saved is SavedContext {
  if (!object(saved) || saved.version !== 1 || typeof saved.head !== "number" || saved.head > head)
    return false;
  return (
    typeof saved.drafts === "boolean" &&
    typeof saved.uncertain === "boolean" &&
    validContext(saved.context, state, head)
  );
}
export function createRecovery(storage: ContextStorage, identity?: string) {
  const key = identity ? `tracer.workspace.v1.${identity}` : null;
  return {
    restore(state: ContextState, head: number): SavedContext | null {
      if (!key) return null;
      try {
        const saved: unknown = JSON.parse(storage.getItem(key) ?? "null", revive);
        if (!validSave(saved, state, head)) return null;
        for (const field of fields)
          if (Object.hasOwn(saved.context, field)) state[field] = saved.context[field];
        // A latest workspace follows latest; explicit historical investigations keep their revision.
        if (saved.context.revision === saved.head) state.revision = head;
        return saved;
      } catch {
        return null;
      }
    },
    save(state: ContextState, head: number, drafts: boolean, uncertain: boolean) {
      if (!key) return false;
      try {
        storage.setItem(
          key,
          JSON.stringify(
            {
              version: 1,
              head,
              drafts,
              uncertain,
              context: Object.fromEntries(fields.map((field) => [field, state[field]])),
            },
            replace,
          ),
        );
        return true;
      } catch {
        return false;
      }
    },
  };
}
