import { requiredField } from "./authoring-policy.ts";
import type { EditingContext } from "./editing-context.ts";
import type { WorkspaceRelationship } from "./workspace-snapshot.ts";

type ScopeDraft = WorkspaceRelationship & { schemaVersion: number; error?: string };
type Options = EditingContext & {
  state: EditingContext["state"] & {
    saving: boolean;
    readBlocked: boolean;
    relationshipDrafts: Map<string, ScopeDraft>;
  };
  unknown(): boolean;
  writesBlocked(): boolean;
};

export function createRelationshipScopeEditor(context: Options) {
  const { app, state, notify, render, commit, writesBlocked } = context;
  function beginRelationshipScopeEdit() {
    const link = context.model().links.find((link) => link.id === state.edge);
    if (!link || state.saving || state.readBlocked || context.unknown()) return;
    notify("");
    state.relationshipDrafts.set(link.id, {
      ...link,
      fields: { ...link.fields },
      schemaVersion: context.schema().version,
    });
    render();
    app.querySelector<HTMLTextAreaElement>("#relationship-scope-form textarea")?.focus();
  }
  function handleRelationshipScopeKey(
    event: KeyboardEvent,
    form: HTMLFormElement,
    cancel: () => void,
  ) {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      form.requestSubmit();
    }
  }
  function bindRelationshipScope(signal: AbortSignal) {
    app
      .querySelector("[data-edit-relationship-scope]")
      ?.addEventListener("click", beginRelationshipScopeEdit, { signal });
    const form = app.querySelector<HTMLFormElement>("#relationship-scope-form");
    if (!form) return;
    const input = form.querySelector<HTMLTextAreaElement>("textarea")!,
      draft = state.relationshipDrafts.get(state.edge!);
    if (!draft) return;
    const locked = state.saving || state.readBlocked || context.unknown();
    form
      .querySelectorAll<HTMLTextAreaElement | HTMLButtonElement>("textarea,button")
      .forEach((control) => (control.disabled = locked));
    input.addEventListener(
      "input",
      () => {
        draft.scope = input.value;
      },
      { signal },
    );
    const cancel = () => {
      if (state.saving || context.unknown()) return;
      state.relationshipDrafts.delete(draft.id);
      render();
      app.querySelector<HTMLButtonElement>("[data-edit-relationship-scope]")?.focus();
    };
    form
      .querySelector<HTMLButtonElement>("[data-cancel-relationship-scope]")!
      .addEventListener("click", cancel, { signal });

    form.addEventListener("keydown", (event) => handleRelationshipScopeKey(event, form, cancel), {
      signal,
    });
    const saveRelationshipScope = async (event: SubmitEvent) => {
      event.preventDefault();
      if (state.readBlocked || writesBlocked()) return;
      if (
        requiredField(context.schema(), "relationshipTypes", draft.type, "scope") &&
        !draft.scope.trim()
      )
        return;
      if ([draft.scope, draft.scope.trim()].includes(String(draft.fields.scope ?? ""))) {
        state.relationshipDrafts.delete(draft.id);
        notify("No changes to save.");
        render();
        app.querySelector<HTMLButtonElement>("[data-edit-relationship-scope]")?.focus();
        return;
      }
      const source = context.model().records.get(draft.source),
        target = context.model().records.get(draft.target);
      const controls = [
        ...form.querySelectorAll<HTMLTextAreaElement | HTMLButtonElement>("textarea,button"),
      ];
      controls.forEach((control) => (control.disabled = true));
      const result = await commit(
        [
          {
            op: "relationship.update",
            id: draft.id,
            expectedVersion: draft.version,
            input: {
              source: source!.id!,
              target: target!.id!,
              type: draft.type,
              fields: { ...draft.fields, scope: draft.scope.trim() },
            },
          },
        ],
        form.querySelector<HTMLElement>(".form-error"),
        draft.schemaVersion,
      );
      if (!result) {
        draft.error = form.querySelector<HTMLElement>(".form-error")?.textContent ?? undefined;
        controls.forEach((control) => (control.disabled = state.readBlocked || context.unknown()));
        return;
      }
      state.relationshipDrafts.delete(draft.id);
      notify(`Relationship saved · r${context.head()}`);
      render();
      app.querySelector<HTMLButtonElement>("[data-edit-relationship-scope]")?.focus();
    };
    form.addEventListener("submit", saveRelationshipScope, { signal });
  }

  return { bindRelationshipScope };
}
