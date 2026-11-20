import { createPortal } from "react-dom";
import { VerificationPage } from "./verifications/page.tsx";
import type {
  VerificationReturnContext,
  VerificationSubjectRequest,
} from "./verifications/subject.ts";
import type { InitialView } from "../src/core/presentation.ts";
import { lazy, Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import type { Entity, Schema, SchemaObject } from "../src/core/model.ts";
import { useConfigurationHandoff } from "./configurations/use-handoff.ts";
import type { Editing } from "./editing.ts";
import { FieldControl, fieldsFrom } from "./fields.tsx";
import "./style.css";
import "./model-page.css";
import { NativeTypeOptions } from "./type-options.tsx";
import { ProjectTaskNavigation } from "./project-task-navigation.tsx";

const VerificationWorkspace = lazy(() =>
  import("./verifications/workspace.tsx").then((m) => ({ default: m.VerificationWorkspace })),
);
const AssessmentWorkspace = lazy(() =>
  import("./assessments/workspace.tsx").then((m) => ({ default: m.AssessmentWorkspace })),
);
const ReferenceWorkspace = lazy(() =>
  import("./references/workspace.tsx").then((m) => ({ default: m.ReferenceWorkspace })),
);
const ConfigurationWorkspace = lazy(() =>
  import("./configurations/workspace.tsx").then((m) => ({ default: m.ConfigurationWorkspace })),
);
const CsvImport = lazy(() => import("./csv-import.tsx").then((m) => ({ default: m.CsvImport })));
const ProjectExport = lazy(() =>
  import("./project-export.tsx").then((m) => ({ default: m.ProjectExport })),
);
const NextWork = lazy(() => import("./next-work.tsx").then((m) => ({ default: m.NextWork })));
const DocumentationView = lazy(() =>
  import("./documentation.tsx").then((m) => ({ default: m.DocumentationView })),
);
const EvidenceView = lazy(() =>
  import("./evidence/workspace.tsx").then((m) => ({ default: m.EvidenceView })),
);
const SchemaEditor = lazy(() =>
  import("./schema-editor.tsx").then((m) => ({ default: m.SchemaEditor })),
);
const WorkItem = lazy(() => import("./records/details.tsx").then((m) => ({ default: m.WorkItem })));

const loading = <p role="status">Loading task…</p>;

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
  verificationTarget,
  verificationSubject,
  verificationOrigin,
}: {
  verificationTarget?: HTMLElement;
  verificationSubject?: VerificationSubjectRequest;
  verificationOrigin?: VerificationReturnContext;
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
  const { dialog, visited, focused, setFocused, setDirty, setReferenceDirty, handoffs } =
    useNativeTaskState(task, entity, onTaskDirty, onTask, Boolean(verificationTarget));
  const panels = {
    verification: () => (
      <VerificationWorkspace
        intent={handoffs.verification}
        subjectRequest={verificationSubject}
        returnToAssessments={
          onTask && handoffs.verification ? () => onTask("assessments") : undefined
        }
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
        intent={handoffs.assessment}
        onVerify={onTask ? handoffs.verify : undefined}
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
          returnLabel="Close record details"
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
        blocked={editing.busy}
        onOpenConfiguration={onTask ? handoffs.openConfiguration : undefined}
        epoch={editing.epoch}
        changed={changed}
        report={editing.report}
        mutate={editing.mutate}
      />
    ),
    configurations: () => (
      <ConfigurationWorkspace
        intent={handoffs.configuration}
        returnLabel="Return to recorded result"
        onReturn={onTask && handoffs.configuration ? () => onTask("evaluations") : undefined}
        active={task === "configurations"}
        onAssess={onTask ? handoffs.assess : undefined}
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
      {verificationTarget && (
        <VerificationPage
          active={task === "verification"}
          visited={visited.includes("verification")}
          target={verificationTarget}
          origin={verificationOrigin}
          error={editing.error}
          onClose={onClose}
          render={() => <Suspense fallback={loading}>{panels.verification()}</Suspense>}
        />
      )}
      {verificationTarget && (
        <VerificationPage
          kind="assessments"
          active={task === "assessments"}
          visited={visited.includes("assessments")}
          target={verificationTarget}
          origin={verificationOrigin}
          error={editing.error}
          onClose={onClose}
          render={() => <Suspense fallback={loading}>{panels.assessments()}</Suspense>}
        />
      )}
      <ModelPage
        target={verificationTarget}
        active={task === "schema"}
        visited={visited.includes("schema")}
        error={editing.error}
        render={() => <Suspense fallback={loading}>{panels.schema()}</Suspense>}
        onClose={onClose}
        navigation={
          onTask && <ProjectTaskNavigation task="schema" hasEntity={!!entity} onTask={onTask} />
        }
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
          {task && onTask && (
            <ProjectTaskNavigation task={task} hasEntity={!!entity} onTask={onTask} />
          )}
          <button
            className="native-task-close"
            aria-label="Return to workspace"
            title="Close dialog and return to workspace"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="native-task-body">
          {editing.error && <p role="alert">{editing.error}</p>}
          <p className="task-draft-note">
            Switching tasks or returning to the workspace retains in-session drafts until reload.
          </p>
          {visited
            .filter(
              (name) =>
                name !== "schema" &&
                !((name === "verification" || name === "assessments") && verificationTarget),
            )
            .map((name) => (
              <div key={name} hidden={task !== name}>
                <Suspense fallback={loading}>{panels[name]()}</Suspense>
              </div>
            ))}
        </div>
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
  navigation,
  target,
}: {
  target?: HTMLElement;
  active: boolean;
  visited: boolean;
  error?: string;
  render(): React.ReactNode;
  onClose(): void;
  navigation?: React.ReactNode;
}) {
  const page = (
    <section
      className={`native-task model-page ${target ? "" : "model-page-standalone"}`}
      hidden={!active}
      aria-label="Project model page"
    >
      <header className="model-page-header">
        <div>
          <strong>Model</strong>
          <span>Project types and relationships</span>
        </div>
        {!target && navigation}
        <button onClick={onClose}>Return to workspace</button>
      </header>
      {error && <p role="alert">{error}</p>}
      {visited && render()}
    </section>
  );
  return target ? createPortal(page, target) : page;
}

function syncTaskSurface(
  dialog: HTMLDialogElement | null,
  task: NativeTask | null,
  verificationPage: boolean,
) {
  syncTaskDialog(
    dialog,
    task === "schema" || ((task === "verification" || task === "assessments") && verificationPage)
      ? null
      : task,
  );
  if ((task === "verification" || task === "assessments") && verificationPage) {
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(".verification-page:not([hidden])")?.focus(),
    );
  }
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
  dialog.setAttribute("closedby", "any");
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
    !dirty ||
    window.confirm("Discard the focused record's unsaved draft to inspect another record?")
  );
}
const taskTitles = {
  references: "References and evaluations",
  item: "Record details and editing",
  create: "Create record",
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
      aria-label="Create project record"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h2>Create record</h2>
      <label>
        Record type
        <select
          aria-label="New record type"
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
          aria-label="New record key"
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
        Create record
      </button>
      <button
        type="button"
        disabled={editing.busy}
        onClick={() => {
          if (!window.confirm("Discard this unsaved creation draft and start a new record?"))
            return;
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
        setNotice("Record saved. Return to the workspace to inspect it.");
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
            name={`New record ${name}`}
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

function useNativeTaskState(
  task: NativeTask | null,
  entity: Entity | undefined,
  onTaskDirty: ((task: NativeTask, value: boolean) => void) | undefined,
  onTask: ((task: NativeTask) => void) | undefined,
  verificationPage: boolean,
) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [visited, setVisited] = useState<NativeTask[]>([]);
  const [focused, setFocused] = useState(entity);
  const [dirty, setDirty] = useState(false);
  const [referenceDirty, setReferenceDirty] = useReferenceTaskDirty(onTaskDirty);
  const handoffs = useConfigurationHandoff(onTask);
  useEffect(() => {
    if (task) setVisited((current) => (current.includes(task) ? current : [...current, task]));
    syncTaskSurface(dialog.current, task, verificationPage);
  }, [task, verificationPage]);
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
  return {
    dialog,
    visited,
    focused,
    setFocused,
    dirty,
    setDirty,
    referenceDirty,
    setReferenceDirty,
    handoffs,
  };
}
