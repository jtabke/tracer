import { useEffect, useEffectEvent, useRef, useState, type RefObject, type ReactNode } from "react";
import type { InitialView } from "../src/core/presentation.ts";
import type { Schema, SchemaObject } from "../src/core/model.ts";
import { workflowProposal } from "../src/core/workflow-presets.ts";
import { SchemaDraftRecovery } from "./schema-draft-recovery.tsx";
import { captureDraft, parseDraft, pendingChanges, rootExtensions } from "./schema-draft.ts";
import { SchemaEditingSurface } from "./schema-editing-surface.tsx";
import { SchemaEditorNotices } from "./schema-editor-notices.tsx";
import type { DefinitionSelection } from "./schema-guided.tsx";
import { SchemaStarter } from "./schema-starter.tsx";
import { SchemaModelPreview } from "./schema-model-preview.tsx";

export function SchemaEditor({
  schema,
  busy,
  onSave,
  onCancel,
  initialSelection,
  onDirty,
  flowOverview,
}: {
  schema: SchemaObject | null;
  flowOverview?: boolean;
  busy: boolean;
  onSave(
    draft: Schema,
    version: number,
    initialViews?: InitialView[],
  ): Promise<SchemaObject | false>;
  onCancel(): void;
  initialSelection?: DefinitionSelection;
  onDirty?(value: boolean): void;
}) {
  const heading = useModelHeading();
  const [captured, setCaptured] = useState(() => captureDraft(schema));
  const { base, version } = captured;
  const [draft, setDraft] = useState(() => workflowProposal(base));
  const [text, setText] = useState(JSON.stringify(workflowProposal(base), null, 2));
  const [starter, setStarter] = useState({
    views: [] as InitialView[],
    includeViews: true,
    generation: 0,
  });
  const { views: initialViews, includeViews } = starter;
  const [notice, setNotice] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [invalid, setInvalid] = useState("");
  const dirty = text !== JSON.stringify(base, null, 2);
  useModelDirty(dirty, onDirty);
  const jsonInput = useRef<HTMLTextAreaElement>(null);
  const update = (next: Schema) => {
    setNotice("");
    setDraft(next);
    setText(JSON.stringify(next, null, 2));
  };
  const changes = pendingChanges(base, draft);
  const extensions = rootExtensions(draft);
  const cancel = () => {
    if (text !== JSON.stringify(base, null, 2) && !window.confirm("Discard unsaved model changes?"))
      return;
    update(base);
    setInvalid("");
    setStarter({ views: [], includeViews: true, generation: starter.generation + 1 });
    onCancel();
  };
  return (
    <section className="schema-editor" aria-label="Configure project model">
      <ModelIntroduction setup={version === 0} heading={heading}>
        <DraftActions
          busy={busy}
          setup={version === 0}
          disabled={Boolean(invalid.length + extensions.length)}
          empty={!Object.keys(draft.entityTypes).length}
          onSave={() => void save()}
          onCancel={cancel}
        />
      </ModelIntroduction>
      <ModelSaveNotice text={notice} />
      <SchemaDraftRecovery
        schema={schema}
        text={text}
        version={version}
        busy={busy}
        onRestart={() => {
          const next = captureDraft(schema);
          setCaptured(next);
          setStarter({ views: [], includeViews: true, generation: starter.generation + 1 });
          update(next.base);
          setInvalid("");
          setAdvanced(false);
          heading.current?.focus();
        }}
      />
      <fieldset disabled={busy}>
        <legend>Native model draft</legend>
        {version === 0 && (
          <SchemaStarter
            key={starter.generation}
            changed={!!changes.length}
            onChange={(next, views) => {
              setStarter({ views, includeViews: true, generation: starter.generation });
              update(next);
              setInvalid("");
            }}
          />
        )}
        <StarterViewOption
          version={version}
          count={initialViews.length}
          checked={includeViews}
          onChange={(includeViews) => setStarter({ ...starter, includeViews })}
        />
        <SchemaModelPreview initial={version === 0} draft={draft} />
        <ModelCustomization setup={version === 0}>
          <SchemaEditingSurface
            key={`${version}:${starter.generation}:${initialViews.length}`}
            initialSelection={initialSelection}
            flowOverview={flowOverview}
            draft={draft}
            version={version}
            advanced={advanced}
            invalid={invalid}
            text={text}
            jsonInput={jsonInput}
            onAdvanced={setAdvanced}
            onChange={update}
            onText={(value) => {
              setNotice("");
              setText(value);
              try {
                setDraft(parseDraft(value));
                setInvalid("");
              } catch (error) {
                setInvalid(error instanceof Error ? error.message : String(error));
              }
            }}
          />
        </ModelCustomization>
        <SchemaEditorNotices base={base} draft={draft} invalid={invalid} />
      </fieldset>
      <details className="schema-editing-notes">
        <summary>About model changes</summary>
        <p>
          The server validates recorded items and connections before saving. Changes do not
          automatically rename, backfill or repair records.
        </p>
      </details>
      <DraftVersion version={version} schema={schema} />
    </section>
  );
  async function save() {
    setNotice("");
    const views = version === 0 && includeViews && initialViews.length ? initialViews : undefined;
    const saved = await onSave(draft, version, views);
    if (!saved) return;
    const next = captureDraft(saved);
    setCaptured(next);
    setStarter({ views: [], includeViews: true, generation: starter.generation + 1 });
    update(next.base);
    setNotice(
      `Model saved as v${saved.version}${views ? ` with ${views.length} Matrix views` : ""}. Saved setup persists in this project database.`,
    );
    setInvalid("");
  }
}

function ModelCustomization({ setup, children }: { setup: boolean; children: ReactNode }) {
  return (
    <details className="schema-customization" open={!setup || undefined}>
      <summary>{setup ? "Customize model" : "Edit model"}</summary>
      {children}
    </details>
  );
}

function ModelIntroduction({
  setup,
  heading,
  children,
}: {
  setup: boolean;
  heading: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  return (
    <>
      <div className="toolbar">
        <h2 tabIndex={-1} ref={heading}>
          {setup ? "Set up your project" : "Configure model"}
        </h2>
        {children}
      </div>
      <p className="schema-introduction">
        {setup
          ? "Choose the records and connections your project needs. Start with a model, review it, then make it your own."
          : "Review and adapt your project’s record types, fields and connections."}
      </p>
    </>
  );
}

function useModelDirty(dirty: boolean, onDirty?: (value: boolean) => void) {
  const notify = useEffectEvent((value: boolean) => onDirty?.(value));
  useEffect(() => {
    notify(dirty);
    return () => notify(false);
  }, [dirty]);
}

function ModelSaveNotice({ text }: { text: string }) {
  return text ? <p role="status">{text}</p> : null;
}
function StarterViewOption({
  version,
  count,
  checked,
  onChange,
}: {
  version: number;
  count: number;
  checked: boolean;
  onChange(value: boolean): void;
}) {
  if (version !== 0 || count === 0) return null;
  return (
    <label className="schema-starter-views">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>Save {count} starter Matrix views with this model</span>
    </label>
  );
}

function DraftVersion({ version, schema }: { version: number; schema: SchemaObject | null }) {
  return (
    <p>
      Based on schema v{version} · Current project v{schema?.version ?? 0}
    </p>
  );
}

function DraftActions({
  busy,
  disabled,
  setup,
  empty,
  onSave,
  onCancel,
}: {
  busy: boolean;
  disabled: boolean;
  setup: boolean;
  empty: boolean;
  onSave(): void;
  onCancel(): void;
}) {
  return (
    <>
      <button className="primary" disabled={busy || disabled || (setup && empty)} onClick={onSave}>
        {setup ? "Use this model" : "Save model"}
      </button>
      <button disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}

function useModelHeading() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return heading;
}
