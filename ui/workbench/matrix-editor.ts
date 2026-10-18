import { createMatrixInput } from "./matrix-input.ts";
import { locate, focusCell } from "./matrix-selection.ts";
import { matrixProposal } from "./matrix-proposal.ts";
import { requiredField, suggestedKey } from "./authoring-policy.ts";
import { allowedTypes } from "./relationship-policy.ts";
import { MAX_VISIBLE } from "./presentation.ts";
import type { MatrixActions, MatrixDraft, MatrixEditorContext } from "./matrix-types.ts";

function beginRoot(get: () => MatrixEditorContext) {
  const { state, data, head, native, model } = get();
  if (!native || state.revision !== head || state.matrixDraft) return;
  state.matrixDraft = {
    kind: "root",
    origin: document.activeElement?.matches("[data-grid-create-root]") ? "row" : "toolbar",
    type: state.matrixRootType,
    key: suggestedKey(model.records, state.matrixRootType),
    title: "",
    statement: "",
    schemaVersion: data.schema.version,
    id: crypto.randomUUID(),
  };
  get().render();
  get()
    .app.querySelector<HTMLInputElement>('#matrix-cell-popover [name="title"]')
    ?.focus({ preventScroll: true });
}
function beginEdit(
  get: () => MatrixEditorContext,
  row: number,
  column: number,
  mode: "replace" | "add" | "artifact" = "replace",
  seed: string | null = null,
) {
  row = Number(locate(get(), row, column)?.dataset.gridRow ?? row);
  const { state, projection, model, data, head, native } = get();
  if (!native || state.revision !== head || state.matrixDraft) return;
  const line = projection.rows[row];
  if (!line) return;
  const link =
    model.links.find(
      (link) =>
        link.id === state.edge &&
        link.source === line.keys[column - 1] &&
        link.type === state.matrixSteps[column - 1]?.type,
    ) ?? model.links.find((link) => link.id === line.links[column - 1]);
  const key =
    column === state.matrixSteps.length &&
    line.terminals?.some((item) => item.key === state.selected)
      ? state.selected
      : line.keys[column];
  const record = model.records.get(key ?? "");
  function captureArtifactDraft() {
    if (!record) return;
    state.matrixDraft = {
      kind: "artifact",
      row,
      column,
      key: record.key,
      title: record.title,
      statement: record.statement,
      id: record.id,
      version: record.version,
      fields: { ...record.fields },
      schemaVersion: data.schema.version,
      quickTitle: seed !== null,
    };
    if (seed !== null) state.matrixDraft.title = seed;

    return true;
  }
  function captureRelationshipDraft() {
    const source = model.records.get(line.keys[column - 1] ?? ""),
      step = state.matrixSteps[column - 1];
    if (
      !source ||
      !step ||
      !allowedTypes(data.schema, source, { type: step.targetType }).includes(step.type)
    )
      return;
    const existing = mode === "add" ? null : link;
    const target = existing ? model.records.get(existing.target) : undefined;
    state.matrixDraft = {
      kind: "relationship",
      row,
      column,
      ...(existing
        ? { mode: "replace" as const, version: existing.version }
        : { mode: "add" as const, version: undefined }),
      sourceKey: source.key,
      sourceId: source.id,
      sourceVersion: source.version,
      type: step.type,
      targetType: step.targetType,
      targetKey: existing?.target ?? "",
      targetId: target?.id,
      targetVersion: target?.version,
      scope: existing?.scope ?? "",
      query: seed ?? "",
      id: existing?.id ?? crypto.randomUUID(),
      fields: { ...(existing?.fields ?? {}) },
      schemaVersion: data.schema.version,
    };

    return true;
  }
  if (column === 0 || mode === "artifact") {
    if (!captureArtifactDraft()) return;
  } else if (!captureRelationshipDraft()) return;
  get().render();
  const input = get().app.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "#matrix-cell-form input, #matrix-cell-form textarea",
  );
  input?.focus();
  if (seed !== null) input?.setSelectionRange(seed.length, seed.length);
}

function expandRequiredDetails(
  context: MatrixEditorContext,
  draft: MatrixDraft,
  get: () => MatrixEditorContext,
) {
  if (
    (draft.kind === "root" || (draft.kind === "relationship" && draft.create)) &&
    draft.title?.trim() &&
    !draft.expanded &&
    requiredField(
      context.data.schema,
      "entityTypes",
      draft.kind === "root" ? draft.type : draft.targetType,
      "statement",
    ) &&
    !draft.statement?.trim()
  ) {
    draft.expanded = true;
    context.render();
    get().app.querySelector<HTMLTextAreaElement>('[name="statement"]')?.focus();
    return true;
  }
  return false;
}
async function saveDraft(get: () => MatrixEditorContext, form: HTMLFormElement) {
  const context = get(),
    { state } = context,
    draft = state.matrixDraft;
  if (!draft) return;
  if (expandRequiredDetails(context, draft, get)) return;
  const proposal = matrixProposal(context, draft);
  if (proposal.status !== "ready") {
    if (proposal.error) {
      draft.error = proposal.error;
      form.querySelector<HTMLElement>(".form-error")!.textContent = proposal.error;
    }
    return;
  }
  const { operations, selected } = proposal;
  const controls = [
    ...form.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement
    >("input,textarea,select,button"),
  ];
  controls.forEach((control) => (control.disabled = true));
  const result = await context.commit(
    operations,
    form.querySelector<HTMLElement>(".form-error"),
    draft.schemaVersion,
  );
  if (!result) {
    const locked = state.readBlocked || context.native?.mutations.snapshot().status === "unknown";
    controls.forEach((control) => (control.disabled = locked));
    draft.error = form.querySelector<HTMLElement>(".form-error")?.textContent ?? undefined;
    return;
  }
  state.matrixDraft = null;
  state.selected = selected;
  state.historySubject = null;
  state.edge = draft.kind === "relationship" ? draft.id : null;
  if (draft.kind === "root") {
    state.matrixSubject = selected;
    state.matrixRootType = draft.type;
    state.matrixCell = null;
    state.matrixAnchor = null;
  }
  if (state.visible.size < MAX_VISIBLE) state.visible.add(selected);
  if (draft.kind === "relationship")
    state.recentConnection = { id: draft.id, source: draft.sourceKey, target: selected };
  context.notify(
    draft.kind === "relationship"
      ? `Connected to ${selected} · r${get().head}`
      : `Saved · r${get().head}`,
  );
  context.render();
  if (draft.kind !== "root") focusCell(get(), draft.row, draft.column);
}
function cancelGridEdit(get: () => MatrixEditorContext) {
  const context = get(),
    { state, native } = context;
  if (state.saving || native?.mutations.snapshot().status === "unknown") return;
  const draft = state.matrixDraft;
  if (!draft) return;
  state.matrixDraft = null;
  context.render();
  if (draft.kind !== "root") focusCell(get(), draft.row, draft.column);
  else
    get()
      .app.querySelector<HTMLElement>(
        draft.origin === "row" ? "[data-grid-create-root]" : '[data-action="create-artifact"]',
      )
      ?.focus({ preventScroll: true });
}

// One binding lifetime per workspace; drafts remain owned by workspace state.
export function createGridEditor(get: () => MatrixEditorContext) {
  let binding: ReturnType<typeof createMatrixInput>;
  const actions: MatrixActions = {
    beginRoot: () => {
      binding.cancelSelection();
      beginRoot(get);
    },
    beginEdit: (...args) => {
      binding.cancelSelection();
      beginEdit(get, ...args);
    },
    save: (form) => saveDraft(get, form),
    cancel: () => cancelGridEdit(get),
  };
  binding = createMatrixInput(get, actions);
  return {
    bind: binding.bind,
    dispose: binding.dispose,
    beginRoot: actions.beginRoot,
    cancel: actions.cancel,
  };
}
