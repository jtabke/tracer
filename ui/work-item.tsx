import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Entity, SchemaObject } from "../src/core/model.ts";
import { draftValue } from "./draft-values.ts";
import type { Editing } from "./editing.ts";
import { FieldControl, fieldsFrom, label } from "./fields.tsx";
import { ObjectEditor } from "./object-editor.tsx";
import { useDebounced } from "./use-debounced.ts";
import { useProjection } from "./use-projection.ts";

export function WorkItem({
  entity,
  schema,
  editing,
  onDirty,
  onChoose,
  onTable,
  returnLabel = "Open in Table",
}: {
  entity: Entity;
  schema: SchemaObject;
  editing: Editing;
  onDirty: (value: boolean) => void;
  onChoose: (value: Entity) => void;
  onTable: () => void;
  returnLabel?: string;
}) {
  const { panel, heading, contextHeading } = useWorkFocus(entity.id);
  const { connectionType, setConnectionType, after, setAfter, connections } = useConnections(
    entity,
    editing,
  );
  const [fieldDirty, setFieldDirty] = useState(false);
  const current = connections.data?.entity ?? entity;
  const draft = useConnectionDraft(schema, entity, editing);
  const {
    base,
    setBase,
    relationships,
    relationshipType,
    setRelationshipType,
    definition,
    targetTypes,
    targetType,
    setTargetType,
    search,
    setSearch,
    target,
    setTarget,
    setTargetAfter,
    values,
    setValues,
    term,
    targets,
    existing,
    linkDirty,
  } = draft;
  const notifyDirty = useEffectEvent(onDirty);
  useEffect(() => {
    notifyDirty(fieldDirty || linkDirty);
    return () => notifyDirty(false);
  }, [fieldDirty, linkDirty]);
  const paused = editing.busy || connections.loading || !connections.data;
  const noMatchingTargets =
    term.length >= 2 && !targets.loading && targets.data && !targets.data.items.length;
  const reset = () => {
    const permitted = Object.keys(schema.relationshipTypes).filter(
      (name) =>
        !schema.relationshipTypes[name].source ||
        schema.relationshipTypes[name].source!.includes(entity.type),
    );
    const meaning = permitted.includes(relationshipType) ? relationshipType : (permitted[0] ?? "");
    const types = schema.relationshipTypes[meaning]?.target ?? Object.keys(schema.entityTypes);
    setBase(schema);
    setRelationshipType(meaning);
    setTargetType(types.includes(targetType) ? targetType : (types[0] ?? ""));
    setSearch("");
    setTargetAfter(undefined);
    setTarget(undefined);
    setValues({});
  };
  const connect = async () => {
    if (
      !definition ||
      !target ||
      paused ||
      existing.loading ||
      !existing.data ||
      existing.data.items.length
    )
      return;
    try {
      const fields = connectionFields(definition, values);
      if (
        await editing.commit(
          [
            {
              op: "relationship.create",
              input: { type: relationshipType, source: entity.id, target: target.id, fields },
            },
          ],
          base.version,
        )
      ) {
        setTarget(undefined);
        setValues({});
      }
    } catch (error) {
      editing.report(error, values);
    }
  };
  function renderItemEditor() {
    return (
      <>
        <ObjectEditor
          value={current}
          definition={(connections.data?.schema ?? schema).entityTypes[current.type]}
          schemaVersion={(connections.data?.schema ?? schema).version}
          editing={editing}
          onDirty={setFieldDirty}
          disabled={paused}
          prefix="Item"
          itemName="item"
          local
        />
      </>
    );
  }
  function renderTargetSearch() {
    return (
      <>
        <label>
          Find target
          <input
            aria-label="Find target"
            maxLength={200}
            value={search}
            placeholder="Name, key or field content…"
            onChange={(event) => {
              setSearch(event.target.value);
              setTargetAfter(undefined);
            }}
          />
        </label>
        {!targetTypes.includes(targetType) && <p>Choose a permitted target type.</p>}
        {term.length < 2 && (
          <p className="muted">Enter at least two characters to find a target.</p>
        )}
        {targets.loading && <p role="status">Finding targets…</p>}
        <div className="work-targets">
          {targets.data?.items.map((value) => (
            <button
              className={target?.id === value.id ? "entity-focused" : ""}
              key={value.id}
              aria-label={`Choose target ${label(value)}`}
              aria-pressed={target?.id === value.id}
              onClick={() => setTarget(value)}
            >
              {label(value)}
              <small>
                {String(value.fields.title ?? "")} · {String(value.fields.subsystem ?? value.type)}
              </small>
            </button>
          ))}
        </div>
        {noMatchingTargets && <p>No matching targets.</p>}
        {targets.data?.nextAfter && (
          <button onClick={() => setTargetAfter(targets.data?.nextAfter)}>
            More matching targets
          </button>
        )}
      </>
    );
  }
  function renderConnectionFields() {
    return (
      <>
        {definition &&
          Object.entries(definition.fields).map(([name, field]) => (
            <label key={name}>
              {name.replaceAll("_", " ")}
              <FieldControl
                name={`Connection ${name}`}
                field={field}
                value={draftValue(values, name)}
                onChange={(value) => setValues((previous) => ({ ...previous, [name]: value }))}
              />
            </label>
          ))}
      </>
    );
  }
  function renderConnectionConfirmation() {
    return (
      <>
        {target && (
          <p>
            Selected target: <strong>{label(target)}</strong>
          </p>
        )}
        {existing.data?.items.length ? <p>This connection already exists.</p> : null}
        <button
          disabled={
            !definition ||
            !target ||
            existing.loading ||
            !existing.data ||
            Boolean(existing.data.items.length)
          }
          onClick={() => void connect()}
        >
          Connect selected target
        </button>
        <button onClick={reset}>Discard connection draft</button>
        {base.version !== schema.version && (
          <p className="gap">
            Connection draft uses schema v{base.version}; current is v{schema.version}. Discard to
            adopt it.
          </p>
        )}
      </>
    );
  }
  function renderConnectionDraft() {
    return (
      <>
        <h3>Connect an existing item</h3>
        <p className="muted">
          Search the entire selected target type, not just its first page. Ordinary connections do
          not imply evidence freshness.
        </p>
        <fieldset disabled={paused}>
          <label>
            Connection meaning
            <select
              aria-label="Connection meaning"
              value={relationshipType}
              onChange={(event) => {
                if (linkDirty && !window.confirm("Discard the connection draft to change meaning?"))
                  return;
                const name = event.target.value;
                setRelationshipType(name);
                setTargetType(
                  (base.relationshipTypes[name].target ?? Object.keys(base.entityTypes))[0] ?? "",
                );
                setTarget(undefined);
                setValues({});
                setSearch("");
                setTargetAfter(undefined);
              }}
            >
              {relationships.map((name) => (
                <option key={name} value={name}>
                  {name.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target type
            <input
              aria-label="Target type"
              list="work-target-types"
              value={targetType}
              onChange={(event) => {
                setTargetType(event.target.value);
                setSearch("");
                setTargetAfter(undefined);
                setTarget(undefined);
              }}
            />
          </label>
          <datalist id="work-target-types">
            {targetTypes.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
          {renderTargetSearch()}
          {renderConnectionFields()}
          {renderConnectionConfirmation()}
        </fieldset>
      </>
    );
  }
  function renderConnectionContext() {
    return (
      <>
        <h3 ref={contextHeading} tabIndex={-1}>
          Relevant connections
        </h3>
        <label>
          Filter connections
          <select
            aria-label="Filter connections"
            value={connectionType}
            onChange={(event) => {
              setConnectionType(event.target.value);
              setAfter(undefined);
            }}
          >
            <option value="">All ordinary connections</option>
            {Object.keys(schema.relationshipTypes).map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        {connections.loading && <p role="status">Loading connections…</p>}
        {connections.data && (
          <>
            <p className="muted">
              {connections.data.items.length} shown of {connections.data.total} matching
              connections. Page-local detail, not a whole-project graph.
            </p>
            <ul className="work-connections">
              {connections.data.items.map(({ relationship, source, target }) => {
                const outgoing = source.id === entity.id,
                  peer = outgoing ? target : source;
                return (
                  <li key={relationship.id}>
                    <span>
                      {outgoing ? "→" : "←"} {relationship.type.replaceAll("_", " ")}
                    </span>{" "}
                    <button
                      aria-label={`Inspect connection item ${label(peer)}`}
                      onClick={() => onChoose(peer)}
                    >
                      {label(peer)}
                    </button>
                    <small>{String(peer.fields.title ?? "")}</small>
                  </li>
                );
              })}
            </ul>
            <div className="toolbar">
              <button disabled={!after || connections.loading} onClick={() => setAfter(undefined)}>
                First connections
              </button>
              <button
                disabled={!connections.data.nextAfter || connections.loading}
                onClick={() => setAfter(connections.data?.nextAfter)}
              >
                More connections
              </button>
            </div>
          </>
        )}
      </>
    );
  }
  return (
    <aside ref={panel} className="work-detail" aria-label="Focused item">
      <span className="eyebrow">{entity.type.replaceAll("_", " ")}</span>
      <h2 ref={heading} tabIndex={-1}>
        {label(current)}
      </h2>
      <p>{String(current.fields.title ?? "")}</p>
      <button onClick={onTable}>{returnLabel}</button>
      <button
        onClick={() => {
          contextHeading.current?.focus();
          contextHeading.current?.scrollIntoView({ block: "start" });
        }}
      >
        Browse connections{connections.data ? ` (${connections.data.total} matching)` : ""}
      </button>
      {!connections.data && !connections.loading && (
        <p role="alert">
          Item details could not be read. Drafts are retained; editing is paused. Refresh to retry.
        </p>
      )}
      {renderItemEditor()}
      <details className="work-connect-options">
        <summary>Connect an existing item</summary>
        {renderConnectionDraft()}
      </details>
      {renderConnectionContext()}
    </aside>
  );
}

function useConnectionDraft(schema: SchemaObject, entity: Entity, editing: Editing) {
  const [base, setBase] = useState(schema);
  const relationships = Object.keys(base.relationshipTypes).filter(
    (name) =>
      !base.relationshipTypes[name].source ||
      base.relationshipTypes[name].source!.includes(entity.type),
  );
  const [relationshipType, setRelationshipType] = useState(relationships[0] ?? "");
  const definition = base.relationshipTypes[relationshipType];
  const targetTypes = definition?.target ?? Object.keys(base.entityTypes);
  const {
    targetType,
    setTargetType,
    search,
    setSearch,
    targetAfter,
    setTargetAfter,
    term,
    targets,
  } = useConnectionSearch(targetTypes, editing);
  const [target, setTarget] = useState<Entity>();
  const [values, setValues] = useState<Record<string, string>>({});
  const existing = useProjection(
    "/api/relationships",
    target ? { source: entity.id, target: target.id, type: relationshipType, limit: 1 } : undefined,
    editing.epoch,
    editing.report,
  );
  const linkDirty = Boolean(target) || Object.values(values).some((value) => value !== "");
  return {
    base,
    setBase,
    relationships,
    relationshipType,
    setRelationshipType,
    definition,
    targetTypes,
    targetType,
    setTargetType,
    search,
    setSearch,
    target,
    setTarget,
    targetAfter,
    setTargetAfter,
    values,
    setValues,
    term,
    targets,
    existing,
    linkDirty,
  };
}

export function connectionFields(
  definition: SchemaObject["relationshipTypes"][string],
  values: Record<string, string>,
) {
  return fieldsFrom(values, definition.fields, { keepEmptyRequiredStrings: true });
}

function useWorkFocus(id: string) {
  const panel = useRef<HTMLElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    contextHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!panel.current || panel.current.closest("[hidden]")) return;
    panel.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 1150px)").matches)
      heading.current?.scrollIntoView({ block: "start" });
  }, [id]);
  return { panel, heading, contextHeading };
}
function useConnections(entity: Entity, editing: Editing) {
  const [connectionType, setConnectionType] = useState(""),
    [after, setAfter] = useState<string>();
  const connections = useProjection(
    "/api/connections",
    { id: entity.id, type: connectionType || undefined, after, limit: 25 },
    editing.epoch,
    editing.report,
  );
  return { connectionType, setConnectionType, after, setAfter, connections };
}

function useConnectionSearch(targetTypes: string[], editing: Editing) {
  const [targetType, setTargetType] = useState(targetTypes[0] ?? ""),
    [search, setSearch] = useState("");
  const [targetAfter, setTargetAfter] = useState<string>();
  const term = useDebounced(search.trim());
  const targets = useProjection(
    "/api/entities",
    targetTypes.includes(targetType) && term.length >= 2
      ? { type: targetType, search: term, after: targetAfter, limit: 20 }
      : undefined,
    editing.epoch,
    editing.report,
  );
  return {
    targetType,
    setTargetType,
    search,
    setSearch,
    targetAfter,
    setTargetAfter,
    term,
    targets,
  };
}
