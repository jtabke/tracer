import { useEffect, useRef, useState } from "react";
import type { Schema, SchemaObject } from "../src/core/model.ts";
import { workflowProposal } from "../src/core/workflow-presets.ts";
import { SchemaDraftRecovery } from "./schema-draft-recovery.tsx";
import { captureDraft, parseDraft, pendingChanges, rootExtensions } from "./schema-draft.ts";
import { SchemaEditingSurface } from "./schema-editing-surface.tsx";
import { SchemaEditorNotices } from "./schema-editor-notices.tsx";
import type { DefinitionSelection } from "./schema-guided.tsx";
import { SchemaStarter } from "./schema-starter.tsx";

export function SchemaEditor({
  schema,
  busy,
  onSave,
  onCancel,
  initialSelection,
}: {
  schema: SchemaObject | null;
  busy: boolean;
  onSave(draft: Schema, version: number): Promise<boolean>;
  onCancel(): void;
  initialSelection?: DefinitionSelection;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const [captured, setCaptured] = useState(() => captureDraft(schema));
  const { base, version } = captured;
  const [draft, setDraft] = useState(() => workflowProposal(base));
  const [text, setText] = useState(JSON.stringify(workflowProposal(base), null, 2));
  const [advanced, setAdvanced] = useState(false);
  const [invalid, setInvalid] = useState("");
  const jsonInput = useRef<HTMLTextAreaElement>(null);
  const update = (next: Schema) => {
    setDraft(next);
    setText(JSON.stringify(next, null, 2));
  };
  const changes = pendingChanges(base, draft);
  const extensions = rootExtensions(draft);
  const cancel = () => {
    if (text !== JSON.stringify(base, null, 2) && !window.confirm("Discard unsaved model changes?"))
      return;
    onCancel();
  };
  return (
    <section className="schema-editor" aria-label="Configure project model">
      <div className="toolbar">
        <h2 tabIndex={-1} ref={heading}>
          Configure model
        </h2>
        <DraftActions
          busy={busy}
          disabled={Boolean(invalid.length + extensions.length)}
          onSave={() => void onSave(draft, version)}
          onCancel={cancel}
        />
      </div>
      <DraftVersion version={version} schema={schema} />
      {workflowProposal(base) !== base && (
        <p className="schema-flow-proposal">
          Suggested development flow is included in this draft. Review the paths before saving.
        </p>
      )}
      <SchemaDraftRecovery
        schema={schema}
        text={text}
        version={version}
        busy={busy}
        onRestart={() => {
          const next = captureDraft(schema);
          setCaptured(next);
          update(next.base);
          setInvalid("");
          setAdvanced(false);
          heading.current?.focus();
        }}
      />
      <details className="schema-editing-notes">
        <summary>About model changes</summary>
        <p>
          The server validates recorded items and connections before saving. Changes do not
          automatically rename, backfill or repair records.
        </p>
      </details>
      <fieldset disabled={busy}>
        <legend>Native model draft</legend>
        {version === 0 && (
          <SchemaStarter
            changed={!!changes.length}
            onChange={(next) => {
              update(next);
              setInvalid("");
            }}
          />
        )}
        <SchemaEditingSurface
          key={version}
          initialSelection={initialSelection}
          draft={draft}
          version={version}
          advanced={advanced}
          invalid={invalid}
          text={text}
          jsonInput={jsonInput}
          onAdvanced={setAdvanced}
          onChange={update}
          onText={(value) => {
            setText(value);
            try {
              setDraft(parseDraft(value));
              setInvalid("");
            } catch (error) {
              setInvalid(error instanceof Error ? error.message : String(error));
            }
          }}
        />
        <SchemaEditorNotices base={base} draft={draft} invalid={invalid} />
      </fieldset>
    </section>
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
  onSave,
  onCancel,
}: {
  busy: boolean;
  disabled: boolean;
  onSave(): void;
  onCancel(): void;
}) {
  return (
    <>
      <button className="primary" disabled={busy || disabled} onClick={onSave}>
        Save model
      </button>
      <button disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}
