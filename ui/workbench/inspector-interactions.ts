type EditorCallbacks = {
  save(field: string | null): void;
  cancel(inline: boolean): void;
  changed(): boolean;
  locked(): boolean;
  saving(): boolean;
};

// Tab-local reading positions are keyed by the rendered subject, never the next selection.
export function createInspectorInteractions(app: HTMLElement) {
  const positions = new Map<string, number>();
  let focused: { context: string; id: string; start: number | null; end: number | null } | null =
    null;
  const inspector = () => app.querySelector<HTMLElement>(".inspector[data-inspector-context]");

  function capture() {
    const panel = inspector();
    focused = null;
    if (!panel) return;
    const context = panel.dataset.inspectorContext!;
    positions.set(context, panel.scrollTop);
    const control = document.activeElement;
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) return;
    if (!panel.contains(control) || !control.id) return;
    focused = { context, id: control.id, start: control.selectionStart, end: control.selectionEnd };
  }
  function restore() {
    const panel = inspector();
    if (!panel) return;
    const context = panel.dataset.inspectorContext!;
    panel.scrollTop = positions.get(context) ?? 0;
    if (focused?.context !== context) return;
    const control = panel.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `#${CSS.escape(focused.id)}`,
    );
    if (!control) return;
    control.focus({ preventScroll: true });
    control.setSelectionRange(focused.start, focused.end);
  }
  function focusDrawer() {
    const panel = inspector();
    if (panel?.contains(document.activeElement)) return;
    panel?.querySelector<HTMLButtonElement>('[data-action="close-inspector"]')?.focus();
  }
  function busy(locked: boolean, saving = false) {
    app
      .querySelectorAll<HTMLButtonElement>(
        '[data-action="cancel-edit"], [data-action="cancel-inline"]',
      )
      .forEach((button) => (button.disabled = locked));
    app
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        ".editor-fields input, .editor-fields textarea, #inline-value",
      )
      .forEach((input) => (input.readOnly = locked));
    app
      .querySelectorAll<HTMLButtonElement>('[data-action="apply-edit"], [data-apply-field]')
      .forEach((button) => {
        if (!button.dataset.restingLabel) button.dataset.restingLabel = button.textContent!;
        button.textContent = saving ? "Saving…" : button.dataset.restingLabel;
        button.disabled = locked;
      });
  }
  function bind(callbacks: EditorCallbacks) {
    const editor = app.querySelector<HTMLElement>(".inline-edit, .editor-fields");
    if (!editor) return;
    function updateStatus() {
      const status = editor!.querySelector<HTMLElement>("[data-inspector-draft-status]");
      if (status) status.textContent = callbacks.changed() ? "Unsaved changes" : "No changes yet";
    }
    function cancelEditing() {
      if (!callbacks.locked()) callbacks.cancel(editor!.classList.contains("inline-edit"));
    }
    function saveEditing() {
      if (callbacks.locked()) return;
      callbacks.save(
        app.querySelector<HTMLElement>("[data-apply-field]")?.dataset.applyField ?? null,
      );
    }
    function handleEditorKey(event: KeyboardEvent) {
      if (event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelEditing();
      }
      if (saveShortcut(event)) {
        event.preventDefault();
        saveEditing();
      }
    }
    editor.oninput = updateStatus;
    editor.onkeydown = handleEditorKey;
    updateStatus();
    busy(callbacks.locked(), callbacks.saving());
  }
  return { capture, restore, focusDrawer, busy, bind };
}

function saveShortcut(event: KeyboardEvent) {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}
