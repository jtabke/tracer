import { requiredField, suggestedKey } from "./authoring-policy.ts";
import type {
  MatrixActions,
  MatrixContext,
  MatrixDraft,
  RelationshipDraft,
} from "./matrix-types.ts";

function updateField(draft: MatrixDraft, name: string, value: string) {
  switch (name) {
    case "key":
    case "title":
    case "statement":
      draft[name] = value;
      break;
    case "scope":
    case "query":
      if (draft.kind === "relationship") draft[name] = value;
      break;
    case "type":
      if (draft.kind === "root") draft.type = value;
      break;
  }
}
function bindPicker(
  get: () => MatrixContext,
  form: HTMLFormElement,
  draft: RelationshipDraft,
  signal: AbortSignal,
) {
  function finishPick(commit: boolean) {
    const next = get().app.querySelector<HTMLFormElement>("#matrix-cell-form");
    if (
      (commit && draft.scope.trim()) ||
      !requiredField(get().data.schema, "relationshipTypes", draft.type, "scope")
    )
      next?.requestSubmit();
    else next?.querySelector<HTMLInputElement>('[name="scope"]')?.focus();
  }
  function pick(button: HTMLButtonElement | null | undefined, commit = false) {
    if (!button || button.disabled) return;
    const chosen = get().model.records.get(button.dataset.pickerKey!);
    if (!chosen) return;
    draft.targetKey = chosen.key;
    draft.targetId = chosen.id;
    draft.targetVersion = chosen.version;
    get().render();
    finishPick(commit);
  }
  for (const button of form.querySelectorAll<HTMLButtonElement>("[data-picker-key]"))
    button.addEventListener("click", () => pick(button), { signal });
  function searchKey(event: KeyboardEvent) {
    const buttons = [
      ...form.querySelectorAll<HTMLButtonElement>("[data-picker-key]:not(:disabled)"),
    ];
    if (event.key === "ArrowDown") {
      event.preventDefault();
      buttons[0]?.focus();
    }
    if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (draft.targetKey) {
      finishPick(true);
      return;
    }
    pick(
      form.querySelector<HTMLButtonElement>(
        '[data-picker-key][aria-selected="true"]:not(:disabled)',
      ) ?? buttons[0],
      true,
    );
  }
  form
    .querySelector<HTMLInputElement>('[name="query"]')
    ?.addEventListener("keydown", searchKey, { signal });
  const choices = [...form.querySelectorAll<HTMLButtonElement>("[data-picker-key]:not(:disabled)")];
  choices.forEach((button, index) => {
    button.tabIndex = -1;
    button.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          pick(button, true);
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          choices[
            Math.max(0, Math.min(choices.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))
          ]?.focus();
        }
      },
      { signal },
    );
  });
  form.querySelector("[data-cell-create]")?.addEventListener(
    "click",
    () => {
      Object.assign(draft, {
        create: true,
        targetId: null,
        targetVersion: null,
        newId: crypto.randomUUID(),
        key: suggestedKey(get().model.records, draft.targetType),
        expanded: false,
        fullDetails: false,
        title: "",
        statement: "",
      });
      get().render();
      get().app.querySelector<HTMLInputElement>('#matrix-cell-form [name="title"]')?.focus();
    },
    { signal },
  );
}
/** Bind only this rendered form; rerenders abort the scope without discarding its draft. */
export function bindMatrixForm(
  get: () => MatrixContext,
  form: HTMLFormElement,
  actions: MatrixActions,
  signal: AbortSignal,
) {
  const draft = get().state.matrixDraft;
  if (!draft) return;
  for (const input of form.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("input,textarea,select"))
    input.addEventListener(
      "input",
      () => {
        updateField(draft, input.name, input.value);
        if (input.name !== "query" || draft.kind !== "relationship") return;
        draft.targetKey = "";
        draft.targetId = null;
        draft.targetVersion = null;
        const caret = (input as HTMLInputElement).selectionStart;
        get().render();
        const field = get().app.querySelector<HTMLInputElement>('[name="query"]');
        field?.focus();
        field?.setSelectionRange(caret, caret);
      },
      { signal },
    );
  form.querySelector("[data-cell-details]")?.addEventListener(
    "click",
    () => {
      draft.expanded = true;
      draft.fullDetails = true;
      get().render();
      get().app.querySelector<HTMLTextAreaElement>('[name="statement"]')?.focus();
    },
    { signal },
  );
  form.querySelector<HTMLSelectElement>('[name="type"]')?.addEventListener(
    "change",
    (event) => {
      if (draft.kind !== "root") return;
      draft.type = (event.currentTarget as HTMLSelectElement).value;
      draft.key = suggestedKey(get().model.records, draft.type);
      get().render();
    },
    { signal },
  );
  if (draft.kind === "relationship") bindPicker(get, form, draft, signal);
  form.querySelector("[data-cell-cancel]")?.addEventListener("click", actions.cancel, { signal });
  form.querySelector("[data-cell-edit-artifact]")?.addEventListener(
    "click",
    () => {
      if (draft.kind === "root") return;
      get().state.matrixDraft = null;
      actions.beginEdit(draft.row, draft.column, "artifact");
    },
    { signal },
  );
  form.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        actions.cancel();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        form.requestSubmit();
      }
    },
    { signal },
  );
  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      void actions.save(form);
    },
    { signal },
  );
}
