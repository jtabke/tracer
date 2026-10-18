import type { Fields } from "../../src/core/model.ts";
import {
  applyTextDraft,
  cancelTextDraft,
  remainingTextDraft,
  textFields,
  type TextDraft,
  type TextField,
} from "./artifact-draft.ts";
import { requiredField } from "./authoring-policy.ts";
import type { EditingContext, EditingRecord } from "./editing-context.ts";

export function createArtifactEditor(context: EditingContext) {
  const { app, state, native, notify, render, commit } = context;
  function rememberDraft() {
    const draft = state.drafts.get(state.selected) ?? {};
    const inline = app.querySelector<HTMLTextAreaElement>("#inline-value");
    if (state.inlineField && inline) {
      state.drafts.set(state.selected, { ...draft, [state.inlineField]: inline.value });
    } else if (state.editing && app.querySelector(".editor-fields")) {
      const captured = { ...draft };
      for (const field of textFields)
        captured[field] =
          app.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#draft-${field}`)?.value ??
          draft[field];
      state.drafts.set(state.selected, captured);
    }
  }
  function beginDraft() {
    const record = context.model().records.get(state.selected);
    if (!record || state.revision !== context.head()) return false;
    notify("");
    if (!state.drafts.has(state.selected))
      state.drafts.set(state.selected, {
        title: record.title,
        statement: record.statement,
        acceptance: String(record.fields.acceptance ?? ""),
        expectedVersion: record.version,
        expectedLocal: record.localGeneration ?? 0,
      });
    return true;
  }
  function supportsTextField(record: EditingRecord | undefined, field: TextField) {
    return record && context.schema().entityTypes[record.type]?.fields?.[field]?.type === "string";
  }
  function beginInline(field: TextField) {
    if (!supportsTextField(context.model().records.get(state.selected), field)) return;
    rememberDraft();
    if (!beginDraft()) return;
    state.inlineField = field;
    state.sheetState = "partial";
    state.editing = false;
    state.inspector = true;
    render();
    app.querySelector<HTMLInputElement | HTMLTextAreaElement>("#inline-value")?.focus();
  }
  function validateArtifactDraft(record: EditingRecord, draft: TextDraft) {
    if (
      draft.expectedVersion !== record.version ||
      draft.expectedLocal !== (record.localGeneration ?? 0)
    ) {
      notify(
        "This local draft is based on an older version. Cancel the draft, then reopen the field to review it.",
      );
      render();
      return false;
    }
    if (
      (supportsTextField(record, "title") && !(draft.title ?? "").trim()) ||
      (requiredField(context.schema(), "entityTypes", record.type, "statement") &&
        !(draft.statement ?? "").trim())
    ) {
      notify("Title and statement are required.");
      render();
      return false;
    }
    return true;
  }
  function artifactDraftFields(record: EditingRecord, draft: TextDraft, field: TextField | null) {
    const editable = (field ? [field] : textFields).filter((key) => supportsTextField(record, key));
    return applyTextDraft(record, draft, editable);
  }
  function finishArtifactEdit(
    record: EditingRecord,
    draft: TextDraft,
    field: TextField | null,
    confirmed = record,
  ) {
    const remaining = field && remainingTextDraft(confirmed, draft, field);
    if (remaining) state.drafts.set(record.key, remaining);
    else state.drafts.delete(record.key);
    state.inlineField = null;
    state.editing = false;
  }
  function focusArtifactControl(field: TextField | null) {
    const selector = field ? `[data-edit-field="${field}"]` : '[data-action="edit"]';
    app.querySelector<HTMLElement>(`.inspector ${selector}`)?.focus({ preventScroll: true });
  }

  async function applyDraft(field: TextField | null = null) {
    rememberDraft();
    const record = context.model().records.get(state.selected),
      draft = state.drafts.get(state.selected);
    if (state.revision !== context.head() || !record || !draft) return;
    if (!validateArtifactDraft(record, draft)) return;
    if (field && !supportsTextField(record, field)) {
      notify(
        "This field is not a text field in the current model. Review the model before saving.",
      );
      render();
      return;
    }
    const fields = artifactDraftFields(record, draft, field);
    if (JSON.stringify(fields) === JSON.stringify(record.fields)) {
      finishArtifactEdit(record, draft, field);
      notify("No changes to save.");
      render();
      focusArtifactControl(field);
      return;
    }
    const confirmed = native
      ? await saveNativeDraft(record, draft, fields)
      : saveLocalDraft(record, fields);
    if (!confirmed) return;
    context.refreshModel();
    finishArtifactEdit(record, draft, field, confirmed);
    notify(
      native
        ? `${record.key} saved · r${context.head()}`
        : `${record.key} updated locally · no database save`,
    );
    render();
    focusArtifactControl(field);
  }
  async function saveNativeDraft(record: EditingRecord, draft: TextDraft, fields: Fields) {
    const result = await commit([
      {
        op: "entity.update",
        id: record.id!,
        expectedVersion: draft.expectedVersion!,
        input: { fields },
      },
    ]);
    if (!result) return null;
    return {
      ...record,
      fields,
      title: String(fields.title ?? record.title),
      statement: String(fields.statement ?? record.statement),
      version: result.results[0].version,
    };
  }
  function saveLocalDraft(record: EditingRecord, fields: Fields) {
    const confirmed = {
      ...record,
      fields,
      title: String(fields.title ?? ""),
      statement: String(fields.statement ?? ""),
      localGeneration: (record.localGeneration ?? 0) + 1,
    };
    state.localEntities.set(record.key, confirmed);
    return confirmed;
  }
  function cancelEditAction() {
    state.drafts.delete(state.selected);
    state.editing = false;
    render();
    focusArtifactControl(null);
  }

  function cancelInlineAction() {
    const field = state.inlineField;
    const record = context.model().records.get(state.selected);
    const draft = state.drafts.get(state.selected);
    const remaining = record && draft && cancelTextDraft(record, draft, field!);
    if (remaining) state.drafts.set(state.selected, remaining);
    else state.drafts.delete(state.selected);
    state.inlineField = null;
    render();
    focusArtifactControl(field);
  }
  return {
    rememberDraft,
    beginDraft,
    supportsTextField,
    beginInline,
    applyDraft,
    cancelEditAction,
    cancelInlineAction,
  };
}
