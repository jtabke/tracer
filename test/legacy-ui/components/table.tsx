import { useEffect, useState } from "react";
import type { Operation } from "../../../src/application/commands.ts";
import type { Entity, Field, SchemaObject } from "../../../src/core/model.ts";
import {
  applyDraft,
  draftFields,
  FieldControl,
  fieldsFrom,
  label,
  parse,
  setField,
} from "../../../ui/fields.tsx";
import { useProjection } from "../../../ui/use-projection.ts";

import { draftValue } from "../../../ui/draft-values.ts";
import type { Editing, Focus } from "../../../ui/editing.ts";
function Row({
  entity,
  fields,
  selected,
  onSelect,
  onDirty,
  hidden,
  editing,
  version,
  focused,
  onFocus,
}: {
  entity: Entity;
  fields: Record<string, Field>;
  selected: boolean;
  onSelect(): void;
  onDirty(dirty: boolean): void;
  hidden: boolean;
  editing: Editing;
  version: number;
  focused?: boolean;
  onFocus?: () => void;
}) {
  const {
    base,
    values,
    key,
    dirty,
    keyDirty,
    reset,
    save,
    setKey,
    setKeyDirty,
    setValues,
    setDirty,
  } = useRowDraft(entity, fields, version, onDirty, editing);
  function renderRevisionActions() {
    return (
      <>
        <td className="row-actions">
          {base.version !== version && (
            <small>
              Draft schema v{base.version}; current v{version}. Escape adopts current schema.
            </small>
          )}
          <span className="muted">
            v{base.entity.version}
            {base.entity.version !== entity.version ? " (current changed)" : ""}
          </span>
          {base.entity.version !== entity.version && (
            <details>
              <summary>Current v{entity.version}</summary>
              <pre>{JSON.stringify(entity.fields, null, 2)}</pre>
              <small>Escape discards the draft and adopts current values.</small>
            </details>
          )}
          <button
            onClick={() => void save()}
            disabled={(!dirty.length && !keyDirty) || editing.busy}
            aria-label={`Save ${label(entity)}`}
          >
            Save
          </button>
        </td>
      </>
    );
  }
  return (
    <tr
      className={focused ? "entity-focused" : ""}
      hidden={hidden}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          reset();
        }
        if (event.key === "Enter" && (dirty.length || keyDirty) && !editing.busy) {
          event.preventDefault();
          void save();
        }
      }}
    >
      <td>
        <input
          type="checkbox"
          aria-label={`Select ${label(entity)}`}
          checked={selected}
          onChange={onSelect}
          disabled={editing.busy}
        />
      </td>
      <td>
        {onFocus && (
          <button aria-label={`Focus ${label(entity)}`} aria-pressed={focused} onClick={onFocus}>
            Focus
          </button>
        )}
        <input
          aria-label={`Key for ${entity.id}`}
          value={key}
          onChange={(event) => {
            setKey(event.target.value);
            setKeyDirty(true);
          }}
          disabled={editing.busy}
        />
      </td>
      {Object.entries(base.fields).map(([name, field]) => (
        <td key={name}>
          <FieldControl
            name={`${name} for ${entity.key ?? entity.id}`}
            field={field}
            value={draftValue(values, name)}
            disabled={editing.busy}
            onChange={(value) => {
              setValues({ ...values, [name]: value });
              setDirty([...new Set([...dirty, name])]);
            }}
          />
        </td>
      ))}
      {renderRevisionActions()}
    </tr>
  );
}
export function TableView({
  schema,
  editing,
  sharedFocus,
  onFocus,
}: {
  schema: SchemaObject;
  editing: Editing;
  sharedFocus?: Focus;
  onFocus?: (entity: Focus) => void;
}) {
  const { type, setType, after, setAfter, focusId, setFocusId, search, setSearch } =
    useTableNavigation(schema);
  const { data: table, loading } = useProjection(
    "/api/table",
    type ? { type, after, focusId, limit: 50 } : undefined,
    editing.epoch,
    editing.report,
  );
  const { dirtyRows, setDirtyRows, selected, setSelected } = useTableSelection();
  const { bulkField, setBulkField, bulkValue, setBulkValue } = useBulkDraft();
  function fieldsForCreation() {
    return table?.schema.entityTypes[type]?.fields ?? schema.entityTypes[type]?.fields ?? {};
  }
  const fields = fieldsForCreation();
  const { newKey, setNewKey, newValues, setNewValues, create, resetCreation } = useTableCreation(
    type,
    fields,
    editing,
    table?.schema.version,
  );
  const draftPending =
    dirtyRows.length > 0 || Boolean(newKey) || Object.values(newValues).some(Boolean);
  useEffect(() => {
    if (!sharedFocus || draftPending) return;
    setType(sharedFocus.type);
    setAfter(undefined);
    setFocusId(sharedFocus.id);
    setSearch("");
    setSelected([]);
  }, [sharedFocus?.id, draftPending]);
  const fieldNames = Object.keys(fields),
    chosen = Object.hasOwn(fields, bulkField) ? bulkField : fieldNames[0];
  const effectiveEditing = { ...editing, busy: editing.busy || loading };
  const bulk = async () => {
    try {
      const value = parse(bulkValue, fields[chosen]);
      const operations: Operation[] = table!.entities.items
        .filter((entity) => selected.includes(entity.id))
        .map((entity) => ({
          op: "entity.update",
          id: entity.id,
          expectedVersion: entity.version,
          input: { fields: setField(entity.fields, chosen, value) },
        }));
      if (await editing.commit(operations, table!.schema.version)) setSelected([]);
    } catch (error) {
      editing.report(error, { field: chosen, value: bulkValue });
    }
  };
  const visible =
    table?.entities.items.filter((entity) =>
      (entity.key + " " + JSON.stringify(entity.fields))
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  function renderCreate() {
    return (
      <>
        <fieldset disabled={effectiveEditing.busy}>
          <legend>Create {type}</legend>

          <div className="toolbar">
            <label>
              Human key{" "}
              <input
                aria-label="New human key"
                value={newKey}
                onChange={(event) => setNewKey(event.target.value)}
              />
            </label>
            {Object.entries(fields).map(([name, field]) => (
              <label key={name}>
                {name}
                {field.required ? " *" : ""}
                <FieldControl
                  name={`New ${name}`}
                  field={field}
                  value={draftValue(newValues, name)}
                  onChange={(value) => setNewValues({ ...newValues, [name]: value })}
                />
              </label>
            ))}
            <button onClick={() => void create()}>Add entity</button>
            <button onClick={resetCreation}>Discard new item draft</button>
          </div>
        </fieldset>
      </>
    );
  }
  function renderBulk() {
    return (
      <>
        <div className="toolbar">
          <span>{selected.length} selected</span>
          {chosen && (
            <>
              <select
                aria-label="Bulk field"
                value={chosen}
                disabled={effectiveEditing.busy}
                onChange={(event) => {
                  setBulkField(event.target.value);
                  setBulkValue("");
                }}
              >
                {fieldNames.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <FieldControl
                name="Bulk value"
                field={fields[chosen]}
                value={bulkValue}
                onChange={setBulkValue}
                disabled={effectiveEditing.busy}
              />
              <button
                onClick={() => void bulk()}
                disabled={effectiveEditing.busy || !selected.length || dirtyRows.length > 0}
              >
                Apply to selected
              </button>
            </>
          )}
          {dirtyRows.length > 0 && (
            <span className="muted">
              Save or Escape row drafts before bulk editing or changing pages.
            </span>
          )}
        </div>
      </>
    );
  }
  function renderFilters() {
    return (
      <>
        <div className="toolbar">
          <label>
            Entity type{" "}
            <select
              aria-label="Entity type"
              value={type}
              disabled={effectiveEditing.busy || dirtyRows.length > 0}
              onChange={(event) => {
                setType(event.target.value);
                setAfter(undefined);
                setFocusId(undefined);
                setSelected([]);
                setNewValues({});
                setBulkField("");
              }}
            >
              {Object.keys(schema.entityTypes).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Filter this page{" "}
            <input
              aria-label="Filter this page"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <span className="muted">Enter saves a row · Escape discards its draft</span>
        </div>
      </>
    );
  }
  function renderRows() {
    if (!table) return null;
    return (
      <>
        <div className="scroll">
          <table>
            <caption>
              {type} entities — current page ({table.entities.items.length})
            </caption>
            <thead>
              <tr>
                <th scope="col">Select</th>
                <th scope="col">Human key</th>
                {fieldNames.map((name) => (
                  <th scope="col" key={name}>
                    {name}
                  </th>
                ))}
                <th scope="col">Revision / edit</th>
              </tr>
            </thead>
            <tbody>
              {table.entities.items.map((entity) => (
                <Row
                  key={entity.id}
                  entity={entity}
                  focused={sharedFocus?.id === entity.id}
                  onFocus={
                    onFocus ? () => onFocus({ id: entity.id, type: entity.type }) : undefined
                  }
                  fields={fields}
                  hidden={!visible.some((item) => item.id === entity.id)}
                  selected={selected.includes(entity.id)}
                  onSelect={() =>
                    setSelected(
                      selected.includes(entity.id)
                        ? selected.filter((id) => id !== entity.id)
                        : [...selected, entity.id],
                    )
                  }
                  onDirty={(dirty) =>
                    setDirtyRows((rows) =>
                      dirty
                        ? [...new Set([...rows, entity.id])]
                        : rows.filter((id) => id !== entity.id),
                    )
                  }
                  editing={effectiveEditing}
                  version={table.schema.version}
                />
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  function renderPagination() {
    if (!table) return null;
    return (
      <>
        <div className="toolbar">
          <button
            disabled={(!after && !focusId) || effectiveEditing.busy || dirtyRows.length > 0}
            onClick={() => {
              setAfter(undefined);
              setFocusId(undefined);
              setSelected([]);
            }}
          >
            First page
          </button>
          <button
            disabled={!table.entities.nextAfter || effectiveEditing.busy || dirtyRows.length > 0}
            onClick={() => {
              setFocusId(undefined);
              setAfter(table.entities.nextAfter);
              setSelected([]);
            }}
          >
            Next entities
          </button>
          <span className="muted">50 entities per page. Filtering is page-local.</span>
        </div>
      </>
    );
  }
  if (!Object.keys(schema.entityTypes).length)
    return <p>Define an entity type in the schema to begin.</p>;
  return (
    <section aria-label="Entity table">
      {draftPending && sharedFocus && sharedFocus.id !== focusId && (
        <p>Shared selection pending. Save or discard table drafts to reveal it.</p>
      )}
      {renderFilters()}
      {!table ? (
        <p role="status">Loading table…</p>
      ) : (
        <>
          {renderCreate()}
          {renderBulk()}
          {renderRows()}
          {!visible.length && <p>No entities on this page. Add one above.</p>}
          {renderPagination()}
        </>
      )}
    </section>
  );
}

function useRowDraft(
  entity: Entity,
  fields: Record<string, Field>,
  version: number,
  onDirty: (dirty: boolean) => void,
  editing: Editing,
) {
  const [base, setBase] = useState({ entity, fields, version });
  const [values, setValues] = useState(() => draftFields(entity.fields, fields)),
    [key, setKey] = useState(entity.key ?? ""),
    [dirty, setDirty] = useState<string[]>([]),
    [keyDirty, setKeyDirty] = useState(false);
  const reset = () => {
    setBase({ entity, fields, version });
    setValues(draftFields(entity.fields, fields));
    setKey(entity.key ?? "");
    setDirty([]);
    setKeyDirty(false);
  };
  const fieldSignature = JSON.stringify(fields);
  useEffect(() => {
    if (!dirty.length && !keyDirty) reset();
  }, [entity.version, fieldSignature, version]);
  useEffect(() => {
    onDirty(Boolean(dirty.length || keyDirty));
  }, [dirty.length, keyDirty]);
  const save = async () => {
    try {
      const next = applyDraft(base.entity.fields, base.fields, values, dirty);
      const operation: Operation = {
        op: "entity.update",
        id: entity.id,
        expectedVersion: base.entity.version,
        input: { fields: next, ...(keyDirty ? { key } : {}) },
      };
      if (await editing.commit([operation], base.version)) {
        setDirty([]);
        setKeyDirty(false);
      }
    } catch (error) {
      editing.report(error, values);
    }
  };
  return {
    base,
    values,
    key,
    dirty,
    keyDirty,
    reset,
    save,
    setKey,
    setKeyDirty,
    setValues,
    setDirty,
  };
}

function useTableCreation(
  type: string,
  fields: Record<string, Field>,
  editing: Editing,
  schemaVersion: number | undefined,
) {
  const [newId, setNewId] = useState(() => crypto.randomUUID());
  const [newKey, setNewKey] = useState(""),
    [newValues, setNewValues] = useState<Record<string, string>>({});
  const resetCreation = () => {
    setNewId(crypto.randomUUID());
    setNewValues({});
    setNewKey("");
  };
  const create = async () => {
    if (editing.busy || schemaVersion === undefined) return;
    try {
      const values = fieldsFrom(newValues, fields, { keepEmptyRequiredStrings: true });
      if (
        await editing.commit(
          [
            {
              op: "entity.create",
              id: newId,
              input: { type, ...(newKey ? { key: newKey } : {}), fields: values },
            },
          ],
          schemaVersion,
        )
      ) {
        resetCreation();
      }
    } catch (error) {
      editing.report(error, newValues);
    }
  };
  return { newKey, setNewKey, newValues, setNewValues, create, resetCreation };
}

function useTableSelection() {
  const [dirtyRows, setDirtyRows] = useState<string[]>([]),
    [selected, setSelected] = useState<string[]>([]);
  return { dirtyRows, setDirtyRows, selected, setSelected };
}
function useBulkDraft() {
  const [bulkField, setBulkField] = useState(""),
    [bulkValue, setBulkValue] = useState("");
  return { bulkField, setBulkField, bulkValue, setBulkValue };
}

function useTableNavigation(schema: SchemaObject) {
  const [type, setType] = useState(Object.keys(schema.entityTypes)[0] ?? ""),
    [after, setAfter] = useState<string>(),
    [focusId, setFocusId] = useState<string>();
  const [search, setSearch] = useState("");
  return { type, setType, after, setAfter, focusId, setFocusId, search, setSearch };
}
