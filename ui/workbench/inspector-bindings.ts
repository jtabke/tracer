import { createDomBindings } from "./dom-bindings.ts";
import { textDraftChanged, type TextField } from "./artifact-draft.ts";
import type { EditingContext } from "./editing-context.ts";
import type { createInspectorInteractions } from "./inspector-interactions.ts";
import { MAX_VISIBLE } from "./presentation.ts";

type Options = {
  app: HTMLElement;
  state: EditingContext["state"] & {
    width: number;
    artifactFull: boolean;
    explainedRoute?: string[] | null;
    historySubject: { key: string; linkId: string | null } | null;
    timelineFilter: string;
    evidenceOpen: boolean;
  };
  interactions: ReturnType<typeof createInspectorInteractions>;
  model: EditingContext["model"];
  render(): void;
  notify(message: string): void;
  rememberDraft(): void;
  beginInline(field: TextField): void;
  applyDraft(field: TextField | null): void;
  cancelInline(): void;
  cancelEdit(): void;
  select(key: string, inspector: boolean): void;
  pickEvent(revision: string, options: { showHistory: boolean }): void;
  action(name: string): void;
  bindRelationshipScope(signal: AbortSignal): void;
  locked(): boolean;
  saving(): boolean;
  panelMode(): string;
};

function isTextField(value: string | undefined): value is TextField {
  return value === "title" || value === "statement" || value === "acceptance";
}

// One binding lifetime per rendered inspector, including detached DOM and bfcache suspension.
export function createInspectorBindings(options: Options) {
  const { app, state, render, notify } = options;
  const bindings = createDomBindings(app);
  const clicks = bindings.click;
  function bind() {
    const signal = bindings.reset();
    options.bindRelationshipScope(signal);
    options.interactions.bind(
      {
        save: (field) => {
          const editable = field ?? undefined;
          options.applyDraft(isTextField(editable) ? editable : null);
        },
        cancel: (inline) => (inline ? options.cancelInline() : options.cancelEdit()),
        changed: () => {
          options.rememberDraft();
          return textDraftChanged(
            options.model().records.get(state.selected),
            state.drafts.get(state.selected) ?? {},
          );
        },
        locked: options.locked,
        saving: options.saving,
      },
      signal,
    );
    clicks(".inspector [data-action]", (button) => options.action(button.dataset.action!));
    clicks("[data-related]", (button) => {
      const key = button.dataset.related!;
      if (!state.visible.has(key) && state.visible.size >= MAX_VISIBLE) {
        notify("50-artifact graph limit reached. Reset the trace to reveal another record.");
        render();
        return;
      }
      state.visible.add(key);
      options.select(key, true);
    });
    clicks("[data-edit-field]", (button) => {
      if (isTextField(button.dataset.editField)) options.beginInline(button.dataset.editField);
    });
    clicks("[data-apply-field]", (button) => {
      if (isTextField(button.dataset.applyField)) options.applyDraft(button.dataset.applyField);
    });
    clicks("[data-trace-route]", (button) => {
      options.rememberDraft();
      state.artifactFull = false;
      state.explainedRoute = JSON.parse(button.dataset.traceRoute!);
      state.edge = state.explainedRoute!.at(-1) ?? null;
      render();
    });
    clicks("[data-inspect-link]", (button) => {
      options.rememberDraft();
      state.edge = button.dataset.inspectLink!;
      state.historySubject = null;
      render();
    });
    clicks("[data-artifact-event]", (button) => {
      state.historySubject = { key: state.selected, linkId: null };
      state.timelineFilter = "selected";
      options.pickEvent(button.dataset.artifactEvent!, { showHistory: true });
    });
    bindResize(signal);
  }
  function bindResize(signal: AbortSignal) {
    const handle = app.querySelector<HTMLElement>(".inspector-resize");
    if (!handle) return;
    let start: { x: number; width: number } | null = null;
    function startResize(event: PointerEvent) {
      start = { x: event.clientX, width: state.width };
      handle!.setPointerCapture(event.pointerId);
    }
    function moveResize(event: PointerEvent) {
      if (!start) return;
      const available = innerWidth - 68 - 22 - 640;
      state.width = Math.round(
        Math.max(300, Math.min(460, available, start.width + start.x - event.clientX)),
      );
      app
        .querySelector<HTMLElement>(".inspector")!
        .style.setProperty("--inspector-width", state.width + "px");
      handle!.setAttribute("aria-valuenow", String(state.width));
    }
    function finishResize() {
      start = null;
      render();
    }
    function cancelResize() {
      start = null;
    }
    function resizeWithKey(event: KeyboardEvent) {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      state.width = Math.max(
        300,
        Math.min(460, innerWidth - 730, state.width + (event.key === "ArrowLeft" ? 20 : -20)),
      );
      render();
      app.querySelector<HTMLElement>(".inspector-resize")?.focus();
    }
    handle.addEventListener("pointerdown", startResize, { signal });
    handle.addEventListener("pointermove", moveResize, { signal });
    handle.addEventListener("pointerup", finishResize, { signal });
    handle.addEventListener("pointercancel", cancelResize, { signal });
    handle.addEventListener("keydown", resizeWithKey, { signal });
  }
  function trapFocus(event: KeyboardEvent) {
    if (
      event.key !== "Tab" ||
      state.evidenceOpen ||
      !state.inspector ||
      options.panelMode() !== "drawer" ||
      state.artifactFull
    )
      return;
    const elements = [
      ...app
        .querySelector(".inspector")!
        .querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,textarea,select,[tabindex="0"]',
        ),
    ];
    const first = elements[0],
      last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  return { bind, dispose: bindings.dispose, trapFocus };
}
