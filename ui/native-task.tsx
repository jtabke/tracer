import { VerificationWorkspace } from "./verifications/workspace.tsx";
import { AssessmentWorkspace } from "./assessments/workspace.tsx";
import { ReferenceWorkspace } from "./reference-workspace.tsx";
import type { InitialView } from "../src/core/presentation.ts";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Entity, Schema, SchemaObject } from "../src/core/model.ts";
import { ConfigurationWorkspace } from "./configuration-workspace.tsx";
import { CsvImport } from "./csv-import.tsx";
import { ProjectExport } from "./project-export.tsx";
import { NextWork } from "./next-work.tsx";
import { DocumentationView } from "./documentation.tsx";
import type { Editing } from "./editing.ts";
import { EvidenceView } from "./evidence.tsx";
import { FieldControl, fieldsFrom } from "./fields.tsx";
import { SchemaEditor } from "./schema-editor.tsx";
import "./style.css";
import "./model-page.css";
import { NativeTypeOptions } from "./type-options.tsx";
import { WorkItem } from "./work-item.tsx";

export type NativeTask =
  | "references"
  | "item"
  | "create"
  | "schema"
  | "evaluations"
  | "configurations"
  | "docs"
  | "import"
  | "export"
  | "next-work"
  | "assessments"
  | "verification";
export function NativeTasks({
  task,
  entity,
  entities,
  schema,
  editing,
  onClose,
  changed,
  onSchema,
  onTaskDirty,
  onTask,
}: {
  task: NativeTask | null;
  entity?: Entity;
  entities: Entity[];
  schema: SchemaObject | null;
  editing: Editing;
  onTaskDirty?(task: NativeTask, value: boolean): void;
  onTask?(task: NativeTask): void;
  onClose(): void;
  changed(): void;
  onSchema(
    draft: Schema,
    version: number,
    initialViews?: InitialView[],
  ): Promise<SchemaObject | false>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [visited, setVisited] = useState<NativeTask[]>([]);
  const [focused, setFocused] = useState(entity);
  const [dirty, setDirty] = useState(false);
  const [referenceDirty, setReferenceDirty] = useReferenceTaskDirty(onTaskDirty);
  useEffect(() => {
    if (task) setVisited((current) => (current.includes(task) ? current : [...current, task]));
    syncTaskSurface(dialog.current, task);
  }, [task]);
  const adoptEntity = useEffectEvent(() => {
    const next = chooseFocusedEntity(entity, focused?.id, dirty || referenceDirty);
    if (next) {
      setFocused(next);
      setDirty(false);
    }
  });
  useEffect(() => {
    adoptEntity();
  }, [entity?.id]);
  const panels = {
    verification: () => (
      <VerificationWorkspace
        entities={entities}
        schema={schema}
        editing={editing}
        active={task === "verification"}
        changed={changed}
        onDirty={taskDirty(onTaskDirty, "verification")}
      />
    ),
    assessments: () => (
      <AssessmentWorkspace
        entities={entities}
        schema={schema}
        editing={editing}
        active={task === "assessments"}
        changed={changed}
        onDirty={taskDirty(onTaskDirty, "assessments")}
      />
    ),
    references: () =>
      schema ? (
        <ReferenceWorkspace
          key={focused?.id}
          entity={focused}
          schema={schema}
          editing={editing}
          onChanged={changed}
          onDirty={setReferenceDirty}
        />
      ) : null,
    item: () =>
      schema && focused ? (
        <WorkItem
          key={focused.id}
          entity={focused}
          schema={schema}
          editing={editing}
          onDirty={(value) => {
            setDirty(value);
            onTaskDirty?.("item", value);
          }}
          onChoose={setFocused}
          onTable={onClose}
          returnLabel="Return to development map"
        />
      ) : null,
    create: () =>
      schema ? (
        <CreateItem schema={schema} editing={editing} onDirty={taskDirty(onTaskDirty, "create")} />
      ) : null,
    schema: () => (
      <SchemaEditor
        flowOverview
        schema={schema}
        busy={editing.busy}
        onSave={onSchema}
        onCancel={onClose}
        onDirty={taskDirty(onTaskDirty, "schema")}
      />
    ),
    evaluations: () => (
      <EvidenceView
        epoch={editing.epoch}
        changed={changed}
        report={editing.report}
        mutate={editing.mutate}
      />
    ),
    configurations: () => (
      <ConfigurationWorkspace
        editing={editing}
        entities={entities}
        onDirty={taskDirty(onTaskDirty, "configurations")}
        changed={changed}
      />
    ),
    import: () => (
      <CsvImport
        schema={schema}
        editing={editing}
        changed={changed}
        onDirty={taskDirty(onTaskDirty, "import")}
      />
    ),
    docs: () => <DocumentationView active={task === "docs"} />,
    export: () => <ProjectExport />,
    "next-work": () => (
      <NextWork
        schema={schema}
        editing={editing}
        active={task === "next-work"}
        changed={changed}
        onDirty={(value) => onTaskDirty?.("next-work", value)}
        onConfigure={onTask ? () => onTask("schema") : undefined}
      />
    ),
  };
  return (
    <>
      <ModelPage
        active={task === "schema"}
        visited={visited.includes("schema")}
        error={editing.error}
        render={panels.schema}
        onClose={onClose}
      />
      <dialog
        ref={dialog}
        className="native-task"
        aria-label="Project task"
        onKeyDown={(event) => {
          if (event.key === "Escape") event.stopPropagation();
        }}
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <header className="native-task-header">
          <strong>{taskHeading(task)}</strong>
          <button onClick={onClose}>Return to map</button>
        </header>
        {editing.error && <p role="alert">{editing.error}</p>}
        <p className="task-draft-note">
          Returning to the map retains this task and its in-session drafts.
        </p>
        {visited
          .filter((name) => name !== "schema")
          .map((name) => (
            <div key={name} hidden={task !== name}>
              {panels[name]()}
            </div>
          ))}
      </dialog>
    </>
  );
}
function ModelPage({
  active,
  visited,
  error,
  render,
  onClose,
}: {
  active: boolean;
  visited: boolean;
  error?: string;
  render(): React.ReactNode;
  onClose(): void;
}) {
  return (
    <section className="native-task model-page" hidden={!active} aria-label="Project model page">
      <header className="model-page-header">
        <div>
          <strong>Model</strong>
          <span>Project types and relationships</span>
        </div>
        <button onClick={onClose}>Return to workspace</button>
      </header>
      {error && <p role="alert">{error}</p>}
      {visited && render()}
    </section>
  );
}

function syncTaskSurface(dialog: HTMLDialogElement | null, task: NativeTask | null) {
  syncTaskDialog(dialog, task === "schema" ? null : task);
  if (task === "schema") {
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(".model-page:not([hidden]) h2")?.focus(),
    );
  }
}

function syncTaskDialog(dialog: HTMLDialogElement | null, task: NativeTask | null) {
  if (!dialog) return;
  if (!task) {
    dialog.close();
    return;
  }
  if (!dialog.open) dialog.showModal();
}
function chooseFocusedEntity(
  entity: Entity | undefined,
  focusedId: string | undefined,
  dirty: boolean,
) {
  if (!entity) return;
  if (entity.id === focusedId) return;
  if (discardAllowed(dirty)) return entity;
}
function discardAllowed(dirty: boolean) {
  return (
    !dirty || window.confirm("Discard the focused item's unsaved draft to inspect another item?")
  );
}
const taskTitles = {
  references: "References and evaluations",
  item: "Item details and editing",
  create: "New item",
  schema: "Project model",
  evaluations: "Evaluations",
  configurations: "Configurations",
  docs: "Documentation",
  import: "Import CSV",
  export: "Export project",
  "next-work": "Next work",
  assessments: "Change assessments",
  verification: "Verification",
};

function CreateItem({
  schema,
  editing,
  onDirty,
}: {
  schema: SchemaObject;
  editing: Editing;
  onDirty(value: boolean): void;
}) {
  const [captured, setCaptured] = useState(schema);
  const [type, setType] = useState(Object.keys(schema.entityTypes)[0] ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [key, setKey] = useState("");
  const [id, setId] = useState(() => crypto.randomUUID());
  const [notice, setNotice] = useState("");
  const dirty = Boolean(key || Object.values(values).some((value) => value.length > 0));
  const notifyDirty = useEffectEvent(onDirty);
  useEffect(() => {
    notifyDirty(dirty);
    return () => notifyDirty(false);
  }, [dirty]);
  const stale = captured.version !== schema.version;
  const definitions = creationFields(captured, type);
  return (
    <form
      aria-label="Create project item"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h2>New item</h2>
      <label>
        Item type
        <select
          aria-label="New item type"
          value={type}
          disabled={editing.busy || Object.keys(values).length > 0}
          onChange={(event) => setType(event.target.value)}
        >
          <NativeTypeOptions names={Object.keys(captured.entityTypes)} />
        </select>
      </label>
      <label>
        Key (optional)
        <input
          aria-label="New item key"
          disabled={editing.busy}
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
      </label>
      <NewItemFields
        definitions={definitions}
        values={values}
        editing={editing}
        setValues={setValues}
      />
      <NewItemModelNotice
        stale={stale}
        adopt={() => {
          setCaptured(schema);
          setType((current) => currentType(schema, current));
        }}
      />
      <button type="submit" disabled={!canCreate(editing.busy, stale, type)}>
        Create item
      </button>
      <button
        type="button"
        disabled={editing.busy}
        onClick={() => {
          if (!window.confirm("Discard this unsaved creation draft and start a new item?")) return;
          setValues({});
          setKey("");
          setId(crypto.randomUUID());
          setCaptured(schema);
          setType(currentType(schema, type));
          setNotice("Creation draft discarded.");
        }}
      >
        Discard creation draft
      </button>
      <p role="status">{notice}</p>
    </form>
  );
  async function save() {
    try {
      const fields = fieldsFrom(values, definitions, { keepEmptyRequiredStrings: true });
      if (
        await editing.commit(
          [{ op: "entity.create", id, input: { type, ...(key ? { key } : {}), fields } }],
          captured.version,
        )
      ) {
        setNotice("Item saved. Return to the map to inspect it.");
        setValues({});
        setKey("");
        setId(crypto.randomUUID());
      }
    } catch (error) {
      editing.report(error);
    }
  }
}

function creationFields(schema: SchemaObject, type: string) {
  return schema.entityTypes[type]?.fields ?? {};
}
function canCreate(busy: boolean, stale: boolean, type: string) {
  return [!busy, !stale, !!type].every(Boolean);
}
function currentType(schema: SchemaObject, type: string) {
  return schema.entityTypes[type] ? type : (Object.keys(schema.entityTypes)[0] ?? "");
}
function NewItemModelNotice({ stale, adopt }: { stale: boolean; adopt(): void }) {
  if (!stale) return null;
  return (
    <p role="alert">
      The model changed. Your proposal is retained.{" "}
      <button type="button" onClick={adopt}>
        Use current model
      </button>
    </p>
  );
}
function NewItemFields({
  definitions,
  values,
  editing,
  setValues,
}: {
  definitions: SchemaObject["entityTypes"][string]["fields"];
  values: Record<string, string>;
  editing: Editing;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <>
      {Object.entries(definitions).map(([name, field]) => (
        <label key={name}>
          {name.replaceAll("_", " ")}
          {field.required ? " *" : ""}
          <FieldControl
            field={field}
            value={values[name] ?? ""}
            name={`New item ${name}`}
            multiline={name === "statement" || field.type === "json"}
            disabled={editing.busy}
            onChange={(value) => setValues((current) => ({ ...current, [name]: value }))}
          />
        </label>
      ))}
    </>
  );
}

function useReferenceTaskDirty(report: ((task: NativeTask, value: boolean) => void) | undefined) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    report?.("references", dirty);
  }, [dirty, report]);
  return [dirty, setDirty] as const;
}

function taskDirty(
  report: ((task: NativeTask, value: boolean) => void) | undefined,
  task: NativeTask,
) {
  return (value: boolean) => report?.(task, value);
}

function taskHeading(task: NativeTask | null) {
  return task ? taskTitles[task] : "Project task";
}
