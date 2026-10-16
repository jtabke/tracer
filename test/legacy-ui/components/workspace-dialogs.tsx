import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { Entity, Fields, Revision, SchemaObject } from "../../../src/core/model.ts";
import { draftValue } from "../../../ui/draft-values.ts";
import type { Editing } from "../../../ui/editing.ts";
import { FieldControl, fieldsFrom, label } from "../../../ui/fields.tsx";
import { statementText } from "../../../ui/statement-text.ts";
import { useProjection } from "../../../ui/use-projection.ts";
import { MappingOptions } from "./mapping-options.tsx";
import type { RelationshipSlot } from "./relationship-slots.ts";
import { useMappingDraft } from "./use-mapping-draft.ts";
import { CandidateContext } from "./workspace-candidate-context.tsx";

export function Statements({ entity, compact = false }: { entity: Entity; compact?: boolean }) {
  return (
    <div className="workspace-statements">
      {Object.entries(entity.fields)
        .filter(
          ([name]) =>
            !compact ||
            (name !== "statement" &&
              (name !== "title" || entity.fields.title !== entity.fields.statement)),
        )
        .map(([name, value]) => (
          <div key={name}>
            <small>{name.replaceAll("_", " ")}</small>
            <p>{typeof value === "string" ? value : JSON.stringify(value)}</p>
          </div>
        ))}
    </div>
  );
}
function CapturedItem({ entity }: { entity: Entity }) {
  return (
    <section className="workspace-captured-item">
      <h3>
        {label(entity)} · captured v{entity.version}
      </h3>
      <p className="workspace-captured-statement">{statementText(entity)}</p>
      <details>
        <summary>Other captured fields</summary>
        <Statements entity={entity} compact />
      </details>
    </section>
  );
}
function keepDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const controls = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
    ),
  ].filter((element) => element.getClientRects().length > 0);
  const first = controls[0],
    last = controls.at(-1);
  const edge = event.shiftKey ? first : last;
  if (
    document.activeElement === edge ||
    !controls.includes(document.activeElement as HTMLElement)
  ) {
    event.preventDefault();
    ((event.shiftKey ? last : first) ?? event.currentTarget).focus();
  }
}
function Dialog({
  title,
  busy,
  onClose,
  children,
  side = false,
  stage = false,
}: {
  side?: boolean;
  stage?: boolean;
  title: string;
  busy: boolean;
  onClose(): void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!stage) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [stage]);
  useEffect(() => {
    if (stage) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      element?.close();
      restoreDialogFocus(previous);
    };
  }, []);
  if (stage)
    return (
      <section className="workspace-task-stage" aria-label={title}>
        <div className="toolbar">
          <h2>{title}</h2>
          <button disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
        {children}
      </section>
    );
  return (
    <dialog
      ref={dialog}
      className={`workspace-dialog${side ? " workspace-picker" : ""}`}
      aria-label={title}
      onKeyDown={keepDialogFocus}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="toolbar">
        <h2>{title}</h2>
        <button disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </div>
      <p role="status" aria-live="polite">
        {busy ? "Saving is paused or pending…" : ""}
      </p>
      {children}
    </dialog>
  );
}

function restoreDialogFocus(previous: HTMLElement | null) {
  if (!previous) return;
  const deadline = performance.now() + 2000;
  const restore = () => {
    if (!previous.isConnected) return;
    if (document.activeElement !== document.body && document.activeElement !== previous) return;
    if (previous.matches(":disabled") && performance.now() < deadline)
      requestAnimationFrame(restore);
    else previous.focus();
  };
  requestAnimationFrame(restore);
}
function FieldsForm({
  definitions,
  values,
  onChange,
  sourceLabel,
}: {
  sourceLabel?: string;
  definitions: SchemaObject["entityTypes"][string]["fields"];
  values: Record<string, string>;
  onChange(name: string, value: string): void;
}) {
  return (
    <>
      {Object.entries(definitions).map(([name, field]) => (
        <label
          key={name}
          className={name === "statement" || field.type === "json" ? "draft-field-wide" : undefined}
        >
          {sourceLabel && name === "source_version"
            ? `${sourceLabel} source version`
            : name.replaceAll("_", " ")}
          {field.required ? " *" : ""}
          <FieldControl
            name={`Draft ${name}`}
            field={field}
            value={draftValue(values, name)}
            multiline={name === "statement" || field.type === "json"}
            onChange={(value) => onChange(name, value)}
          />
        </label>
      ))}
    </>
  );
}
export function NewItemDialog({
  schema,
  editing,
  paused = false,
  initialType,
  onCreated,
  onClose,
  context,
}: {
  schema: SchemaObject;
  editing: Editing;
  paused?: boolean;
  initialType?: string;
  onCreated(id: string): void;
  onClose(): void;
  context?: { source: Entity; siblings: Entity[] };
}) {
  const [base] = useState(schema);
  const [id] = useState(() => crypto.randomUUID());
  const [type, setType] = useState(() =>
    initialType && Object.hasOwn(base.entityTypes, initialType)
      ? initialType
      : (Object.keys(base.entityTypes)[0] ?? ""),
  );
  const [key, setKey] = useState(""),
    [values, setValues] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const create = async () => {
    if (paused || editing.busy) return;
    try {
      const fields = fieldsFrom(values, base.entityTypes[type].fields);
      if (
        await editing.commit(
          [
            {
              op: "entity.create",
              id,
              input: { type, ...(key.trim() ? { key: key.trim() } : {}), fields },
            },
          ],
          base.version,
        )
      ) {
        onCreated(id);
        if (!context) onClose();
      } else setFailed(true);
    } catch (error) {
      setFailed(true);
      editing.report(error, { type, key, values });
    }
  };
  return (
    <Dialog title="Create item" busy={editing.busy} onClose={onClose} stage={!!context}>
      {context && (
        <div className="author-source">
          <h3>In context of {label(context.source)}</h3>
          <p>{statementText(context.source)}</p>
          <span className="muted">Saved separately; review its connection next.</span>
          {context.siblings.length > 0 && (
            <p className="muted">
              Alongside{" "}
              {context.siblings
                .filter((item) => item.id !== context.source.id)
                .map(label)
                .join(" · ")}
            </p>
          )}
        </div>
      )}
      <p>Nothing is saved until you create the item. Schema v{base.version}.</p>
      {failed && (
        <p role="alert">
          {editing.error ?? "Save was not confirmed."} Your draft is retained; no automatic retry.
        </p>
      )}
      <fieldset disabled={editing.busy || paused}>
        <label>
          Item type
          <select
            aria-label="New item type"
            value={type}
            onChange={(event) => {
              if (
                Object.values(values).some(Boolean) &&
                !window.confirm("Discard field values to change item type?")
              )
                return;
              setType(event.target.value);
              setValues({});
            }}
          >
            {Object.keys(base.entityTypes).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Key (optional)
          <input
            aria-label="New item key"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
        </label>
        <FieldsForm
          definitions={base.entityTypes[type].fields}
          values={values}
          onChange={(name, value) => setValues((previous) => ({ ...previous, [name]: value }))}
        />
        <button disabled={!type} onClick={() => void create()}>
          Create item
        </button>
      </fieldset>
    </Dialog>
  );
}
export function MappingDialog({
  source,
  schema,
  editing,
  paused,
  onClose,
  initialSlot,
  initialTarget,
  onRecorded,
  stage = false,
}: {
  initialSlot?: RelationshipSlot;
  initialTarget?: Entity;
  onRecorded?(): void;
  stage?: boolean;
  source: Entity;
  schema: SchemaObject;
  editing: Editing;
  paused: boolean;
  onClose(): void;
}) {
  const draft = useMappingDraft(
    source,
    schema,
    editing,
    paused,
    onClose,
    initialSlot,
    initialTarget,
    onRecorded,
  );
  const {
    base,
    meanings,
    direction,
    meaning,
    definition,
    target,
    values,
    setValues,
    failed,
    existing,
    endpoints,
    record,
    ready,
  } = draft;
  return (
    <Dialog title="Record connection" busy={editing.busy} onClose={onClose} side stage={stage}>
      <CapturedItem entity={base.source} />
      {failed && (
        <p role="alert">
          {editing.error ?? "Save was not confirmed."} Your captured context and draft are retained;
          no automatic retry.
        </p>
      )}
      {!meanings.length ? (
        <p>No permitted connections for this type. Configure the model to add a relationship.</p>
      ) : (
        <>
          <p className="muted">
            Record the relationship and its scope. Captured versions protect this proposal; a
            connection does not record a test outcome.
          </p>
          <fieldset disabled={editing.busy || paused}>
            <MappingOptions
              draft={draft}
              editing={editing}
              initialSlot={initialSlot}
              expanded={stage}
            />
            {target && (
              <div>
                <CapturedItem entity={target} />
                {existing.data?.items.length ? <p>This connection already exists.</p> : null}
              </div>
            )}
            {definition && (
              <FieldsForm
                definitions={definition.fields}
                sourceLabel={label(endpoints?.source ?? base.source)}
                values={values}
                onChange={(name, value) =>
                  setValues((previous) => ({ ...previous, [name]: value }))
                }
              />
            )}
            <MappingCandidateContext target={target} editing={editing} />
            <div className="workspace-record-controls">
              <p aria-label="Connection direction">
                {connectionLabel(base.source, target, meaning, direction)}
              </p>
              <button disabled={!ready} onClick={() => void record()}>
                Record connection
              </button>
            </div>
          </fieldset>
        </>
      )}
    </Dialog>
  );
}
function MappingCandidateContext({ target, editing }: { target?: Entity; editing: Editing }) {
  if (!target) return null;
  return <CandidateContext entity={target} editing={editing} />;
}
function revisionValue(value: Fields[string] | undefined) {
  return value === undefined
    ? "Not set"
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
}
function StoredRevision({
  revision,
  previous,
  currentVersion,
}: {
  revision: Revision;
  previous?: Revision;
  currentVersion: number;
}) {
  const snapshot = revision.snapshot as Entity | null;
  const prior = previous?.snapshot as Entity | null | undefined;
  const fields = snapshot?.fields ?? {};
  const names = [...new Set([...Object.keys(fields), ...Object.keys(prior?.fields ?? {})])];
  const changed = previous
    ? names.filter((name) => JSON.stringify(fields[name]) !== JSON.stringify(prior?.fields[name]))
    : [];
  const visible = previous
    ? changed
    : names.filter(
        (name) => name === "statement" || (name === "title" && fields.title !== fields.statement),
      );
  const other = names.filter((name) => !visible.includes(name));
  function renderRevisionState() {
    return (
      <>
        <h4>
          v{revision.version} · project revision {revision.projectRevision}
          {revision.version === currentVersion ? " · current" : ""}
        </h4>
        {!snapshot && <p>Item removed.</p>}
        {!previous && revision.version > 1 && (
          <p>Earlier revision is outside this page; no field comparison shown.</p>
        )}
        {previous && snapshot && changed.length === 0 && <p>No field values changed.</p>}
      </>
    );
  }
  function renderChangedFields() {
    return (
      <>
        <dl>
          {visible.map((name) => (
            <div key={name}>
              <dt>
                {name.replaceAll("_", " ")}
                {previous ? " · changed" : ""}
              </dt>
              {previous && (
                <dd>
                  <small>Before · v{previous.version}</small>
                  <p>{revisionValue(prior?.fields[name])}</p>
                </dd>
              )}
              <dd>
                {previous && <small>Stored · v{revision.version}</small>}
                <p>{revisionValue(fields[name])}</p>
              </dd>
            </div>
          ))}
        </dl>
      </>
    );
  }
  function renderOtherFields() {
    return (
      <>
        {other.length > 0 && (
          <details>
            <summary>{previous ? "Unchanged fields" : "Other stored fields"}</summary>
            <dl>
              {other.map((name) => (
                <div key={name}>
                  <dt>{name.replaceAll("_", " ")}</dt>
                  <dd>
                    <p>{revisionValue(fields[name])}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </>
    );
  }
  return (
    <section className="workspace-revision" aria-label={`Stored v${revision.version}`}>
      {renderRevisionState()}
      {renderChangedFields()}
      {renderOtherFields()}
      <details>
        <summary>Raw snapshot</summary>
        <pre>{JSON.stringify(revision.snapshot, null, 2)}</pre>
      </details>
    </section>
  );
}
export function RevisionHistory({ entity, editing }: { entity: Entity; editing: Editing }) {
  const [open, setOpen] = useState(false),
    [after, setAfter] = useState<string>();
  const history = useProjection(
    "/api/history",
    open ? { kind: "entity", id: entity.id, after, limit: 20 } : undefined,
    editing.epoch,
    editing.report,
  );
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Stored revision history · {label(entity)}</summary>
      {history.loading ? (
        <p>Reading revisions…</p>
      ) : !history.data ? (
        <p>Revision read unavailable. Refresh to retry.</p>
      ) : (
        <>
          {history.data.items.map((revision, index, revisions) => (
            <StoredRevision
              key={revision.revisionId}
              revision={revision}
              previous={revisions[index - 1]}
              currentVersion={entity.version}
            />
          ))}
          {history.data.nextAfter && (
            <button onClick={() => setAfter(history.data!.nextAfter)}>More revisions</button>
          )}
        </>
      )}
    </details>
  );
}

function connectionLabel(
  item: Entity,
  candidate: Entity | undefined,
  meaning: string,
  direction: string,
) {
  const named = (entity: Entity) => `${label(entity)} · captured v${entity.version}`;
  const source = direction === "incoming" ? candidate : item;
  const target = direction === "incoming" ? item : candidate;
  return `${source ? named(source) : "Choose a source"} → ${meaning.replaceAll("_", " ")} → ${target ? named(target) : "Choose a target"}`;
}
