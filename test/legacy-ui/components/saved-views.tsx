import { useState } from "react";
import type { ViewSave } from "../../../src/application/saved-views.ts";
import type { SavedView, ViewDefinition } from "../../../src/core/presentation.ts";
import "./saved-views.css";
import { useSavedViews } from "./use-saved-views.ts";

function useViewDraft({
  definition,
  schemaVersion,
  disabled,
  onOpen,
}: {
  definition?: ViewDefinition;
  schemaVersion: number;
  disabled: boolean;
  onOpen(definition: ViewDefinition): Promise<boolean> | boolean;
}) {
  const library = useSavedViews();
  const [captured, setCaptured] = useState<SavedView>();
  const [name, setName] = useState("");
  const [attempt, setAttempt] = useState<ViewSave>();
  const [opening, setOpening] = useState(false);
  const kind = definition?.kind ?? "family";
  const choices = library.views?.filter((view) => view.definition.kind === kind) ?? [];
  const blocked = disabled || library.busy || library.uncertain || opening || !library.views;
  const select = (value?: SavedView) => {
    setCaptured(value);
    setName(value?.name ?? "");
    setAttempt(undefined);
  };
  const save = async (proposal: ViewSave) => {
    setAttempt(proposal);
    const saved = await library.save(proposal);
    if (saved) select(saved);
  };
  const current = (update: boolean): ViewSave => ({
    ...(update && captured ? { id: captured.id } : {}),
    name,
    definition: definition!,
    expectedVersion: update ? captured!.version : 0,
    expectedSchemaVersion: schemaVersion,
  });
  const open = async () => {
    if (!captured) return;
    setOpening(true);
    try {
      await onOpen(captured.definition);
    } catch (error) {
      library.report(error);
    } finally {
      setOpening(false);
    }
  };
  const remove = async () => {
    if (captured && (await library.remove(captured))) select();
  };
  const adopt = (latest: SavedView) => {
    setCaptured(latest);
    setAttempt((value) =>
      value?.id === latest.id ? { ...value, expectedVersion: latest.version } : value,
    );
  };
  const retry = () => {
    if (attempt) void save(attempt);
  };
  return {
    library,
    captured,
    name,
    setName,
    attempt,
    choices,
    kind,
    blocked,
    select,
    save,
    current,
    open,
    remove,
    adopt,
    retry,
    opening,
  };
}
export function SavedViewPanel(props: Parameters<typeof useViewDraft>[0]) {
  const { definition } = props;
  const [configuring, setConfiguring] = useState(false);
  const draft = useViewDraft(props);
  const {
    library,
    captured,
    name,
    setName,
    attempt,
    choices,
    kind,
    blocked,
    select,
    save,
    current,
    open,
    remove,
    adopt,
    retry,
    opening,
  } = draft;
  return (
    <div
      className="saved-view-panel"
      hidden={emptyViewPanel(definition, draft, configuring)}
      aria-label={`Saved ${kind === "family" ? "family" : "trace"} views`}
    >
      {library.message && <p role="status">{library.message}</p>}
      {library.error && <p role="alert">{library.error}</p>}
      <SavedViewRecovery library={library} />
      <div className="toolbar">
        <label>
          <span className="saved-view-label">Saved view</span>
          <select
            aria-label="Saved view"
            value={captured?.id ?? ""}
            disabled={blocked}
            onChange={(event) => select(choices.find((view) => view.id === event.target.value))}
          >
            <option value="">New view</option>
            {choices.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </label>
        {captured && (
          <button disabled={blocked} onClick={() => void open()}>
            Open saved view
          </button>
        )}
        <button aria-expanded={configuring} onClick={() => setConfiguring(!configuring)}>
          {configuring ? "Close view settings" : "Save view…"}
        </button>
      </div>
      <div className="toolbar" hidden={!configuring}>
        <label>
          Name{" "}
          <input
            aria-label="Saved view name"
            maxLength={80}
            value={name}
            disabled={library.busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          disabled={blocked || !definition || !name.trim()}
          onClick={() => void save(current(false))}
        >
          Save as new view
        </button>
        <ViewUpdateActions
          captured={captured}
          choices={choices}
          blocked={blocked}
          canSave={!!definition && !!name.trim()}
          update={() => void save(current(true))}
          remove={remove}
          adopt={adopt}
        />
        <button
          className="text-action"
          disabled={library.busy || opening}
          onClick={() => void library.refresh()}
        >
          Refresh saved views
        </button>
      </div>
      <RetainedViewProposal attempt={attempt} blocked={blocked} retry={retry} />
    </div>
  );
}

function emptyViewPanel(
  definition: ViewDefinition | undefined,
  draft: ReturnType<typeof useViewDraft>,
  configuring: boolean,
) {
  const { library } = draft;
  const retainedWork = [definition, configuring, draft.name.trim(), draft.captured, draft.attempt];
  const catalogueState = [
    draft.choices.length,
    library.busy,
    library.uncertain,
    library.error,
    library.message,
  ];
  return ![...retainedWork, ...catalogueState].some(Boolean);
}

function ViewUpdateActions({
  captured,
  choices,
  blocked,
  canSave,
  update,
  remove,
  adopt,
}: {
  captured?: SavedView;
  choices: SavedView[];
  blocked: boolean;
  canSave: boolean;
  update(): void;
  remove(): Promise<void>;
  adopt(value: SavedView): void;
}) {
  if (!captured) return null;
  const latest = choices.find((value) => value.id === captured.id);
  return (
    <>
      <button disabled={blocked || !canSave} onClick={update}>
        Update selected view
      </button>
      <button
        disabled={blocked}
        onClick={() => {
          if (window.confirm(`Delete saved view “${captured.name}”?`)) void remove();
        }}
      >
        Delete saved view
      </button>
      {latest && latest.version !== captured.version && (
        <button disabled={blocked} onClick={() => adopt(latest)}>
          Use latest saved version
        </button>
      )}
    </>
  );
}
function RetainedViewProposal({
  attempt,
  blocked,
  retry,
}: {
  attempt?: ViewSave;
  blocked: boolean;
  retry(): void;
}) {
  if (!attempt) return null;
  return (
    <details open>
      <summary>Retained view proposal</summary>
      <p>
        {attempt.name} · {attempt.definition.kind} · expected saved version{" "}
        {attempt.expectedVersion}
      </p>
      <pre>{JSON.stringify(attempt.definition, null, 2)}</pre>
      <button disabled={blocked} onClick={retry}>
        Retry retained view proposal
      </button>
    </details>
  );
}

function SavedViewRecovery({ library }: { library: ReturnType<typeof useSavedViews> }) {
  if (!library.uncertain) return null;
  return (
    <section aria-label="Saved-view recovery">
      <p>The save outcome is unknown. Inspect the refreshed catalogue before continuing.</p>
      {library.views?.map((value) => (
        <details key={value.id}>
          <summary>Recorded view: {value.name}</summary>
          <pre>{JSON.stringify(value.definition, null, 2)}</pre>
        </details>
      ))}
      <button disabled={!library.canResume} onClick={library.resume}>
        I inspected refreshed views; continue editing
      </button>
    </section>
  );
}
