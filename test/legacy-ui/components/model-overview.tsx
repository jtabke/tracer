import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import type { Schema, SchemaObject } from "../../../src/core/model.ts";
import { emptySchema } from "../../../ui/schema-draft.ts";
import { SchemaEditor } from "../../../ui/schema-editor.tsx";
import type { DefinitionSelection } from "../../../ui/schema-guided.tsx";
import { RecordedConnections } from "./model-connections.tsx";
import type { ModelLinkDraft } from "./model-link-composer.tsx";
import { ModelLinkComposer } from "./model-link-composer.tsx";
import "./model-overview.css";
import { ModelRegister } from "./model-register.tsx";

export function ModelOverview({
  schema,
  visible,
  epoch,
  busy,
  report,
  onSave,
  onCreate,
  onBrowse,
  onInspect,
}: {
  visible: boolean;
  schema: SchemaObject | null;
  epoch: number;
  busy: boolean;
  report(error: unknown): void;
  onSave(draft: Schema, version: number): Promise<boolean>;
  onCreate(): void;
  onBrowse(type: string): void;
  onInspect(id: string): void;
}) {
  const [configuring, setConfiguring] = useState(false);
  const [initialSelection, setInitialSelection] = useState<DefinitionSelection>();
  const [relationship, setRelationship] = useState("");
  const [returnFocus, setReturnFocus] = useState("");
  const link = useModelLinkDraft(schema, busy);
  const focus = useModelReturnFocus(visible, returnFocus, configuring);
  const browse = (type: string, focusId = `model-type-${type}`) => {
    setReturnFocus(focusId);
    onBrowse(type);
  };
  const openRelationship = (name: string, focusId = `model-records-${name}`) => {
    setReturnFocus(focusId);
    setRelationship(name);
  };
  const close = () => {
    focus.beforeClose();
    setConfiguring(false);
  };
  const save = async (draft: Schema, version: number) => {
    const saved = await onSave(draft, version);
    if (saved) close();
    return saved;
  };
  const openConfigure = (selection?: DefinitionSelection) => {
    setInitialSelection(selection);
    setConfiguring(true);
  };
  const backToModel = () => {
    setRelationship("");
    focusAfterRender(returnFocus);
  };
  return (
    <section className="model-overview" aria-label="Project model">
      <div hidden={!configuring}>
        {configuring && (
          <SchemaEditor
            schema={schema}
            busy={busy}
            onCancel={close}
            initialSelection={initialSelection}
            onSave={save}
          />
        )}
      </div>
      <div hidden={configuring}>
        <div className="toolbar">
          <h2>Project model</h2>
          <button ref={focus.configure} disabled={link.blocked} onClick={() => openConfigure()}>
            Configure model
          </button>
        </div>
        <p>Development workflow · inputs, outputs and feedback connections between item types.</p>
        <NewProjectNotice schema={schema} />
        <ModelDraft draft={link.draft} busy={busy} onSave={onSave} onCancel={link.close} />
        <div hidden={!!relationship || !!link.draft}>
          <ModelRegister
            onCreate={onCreate}
            schema={schema ?? emptySchema}
            onBrowse={browse}
            onOpen={openRelationship}
            busy={link.blocked}
            onLink={link.open}
            onConfigure={openConfigure}
          />
        </div>
        <ModelRecords
          key={relationship}
          name={relationship}
          epoch={epoch}
          report={report}
          onInspect={onInspect}
          onBack={backToModel}
        />
      </div>
    </section>
  );
}

function ModelRecords(props: ComponentProps<typeof RecordedConnections>) {
  if (!props.name) return null;
  return <RecordedConnections {...props} />;
}

function ModelDraft({
  draft,
  ...props
}: Omit<ComponentProps<typeof ModelLinkComposer>, "draft"> & { draft: ModelLinkDraft | null }) {
  if (!draft) return null;
  return <ModelLinkComposer draft={draft} {...props} />;
}

function NewProjectNotice({ schema }: { schema: SchemaObject | null }) {
  if (schema) return null;
  return (
    <p>Start a new project with Empty or a starter in Configure model. No example data is added.</p>
  );
}

function useModelLinkDraft(schema: SchemaObject | null, busy: boolean) {
  const [draft, setDraft] = useState<ModelLinkDraft | null>(null);
  return {
    draft,
    blocked: busy || !!draft,
    open: (source: string, target: string) => {
      if (schema) setDraft({ source, target, schema: structuredClone(schema) });
    },
    close: () => {
      if (draft) focusAfterRender(`model-node-${draft.target}`, `model-index-${draft.target}`);
      setDraft(null);
    },
  };
}
function focusAfterRender(id: string, fallback = id) {
  requestAnimationFrame(() => {
    const element = document.getElementById(id);
    if (element?.getClientRects().length) element.focus();
    else document.getElementById(fallback)?.focus();
  });
}
function useModelReturnFocus(visible: boolean, id: string, configuring: boolean) {
  const configure = useRef<HTMLButtonElement>(null);
  const restore = useRef(false);
  useEffect(() => {
    if (visible && !configuring) document.getElementById(id)?.focus();
  }, [visible]);
  useEffect(() => {
    if (!configuring && restore.current) {
      restore.current = false;
      configure.current?.focus();
    }
  }, [configuring]);
  return {
    configure,
    beforeClose: () => {
      restore.current = true;
    },
  };
}
