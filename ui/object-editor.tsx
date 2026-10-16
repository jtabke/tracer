import { useEffect, useEffectEvent, useState } from "react";
import type { Entity, Relationship, TypeDefinition } from "../src/core/model.ts";
import type { Editing } from "./editing.ts";
import { applyDraft, draftFields } from "./fields.tsx";
import { ObjectFields } from "./object-fields.tsx";
export function ObjectEditor({
  value,
  definition,
  schemaVersion,
  relationship,
  editing,
  onDirty,
  disabled,
  prefix = "Graph",
  itemName,
  multiline = false,
  local = false,
  fieldsInSurface = [],
  formVisible = true,
  onEditing = () => {},
}: {
  value: Entity | Relationship;
  definition: TypeDefinition;
  schemaVersion: number;
  relationship?: boolean;
  editing: Editing;
  onDirty: (dirty: boolean) => void;
  disabled: boolean;
  prefix?: string;
  itemName?: string;
  multiline?: boolean;
  local?: boolean;
  fieldsInSurface?: string[];
  formVisible?: boolean;
  onEditing?(active: boolean): void;
}) {
  const [activeField, setActiveField] = useState("");
  const activate = (name: string) => {
    setActiveField(name);
    onEditing(!!name);
  };
  const { base, values, dirty, setValues, setDirty, reset } = useObjectDraft(
    value,
    definition,
    schemaVersion,
    onDirty,
  );
  const save = async () => {
    clearSavedDraft(await saveObjectDraft(base, values, dirty, relationship, editing), setDirty);
  };
  const changeField = (name: string, next: string) => {
    setValues((previous) => ({ ...previous, [name]: next }));
    setDirty((previous) => (previous.includes(name) ? previous : [...previous, name]));
  };
  const discard = () => {
    reset();
    activate("");
  };
  const saveLabel = itemName ?? (relationship ? "connection" : "node");
  const blocked = disabled || editing.busy;
  const presentation = objectPresentation(local, activeField, formVisible, blocked);
  const surfaceFields = surfaceFieldsForDraft(base, value, schemaVersion, fieldsInSurface);
  return (
    <div className="graph-editor">
      <ObjectDraftHeading
        itemName={itemName}
        relationship={relationship}
        local={local}
        capturedVersion={base.value.version}
        version={value.version}
        capturedSchema={base.schemaVersion}
        schemaVersion={schemaVersion}
      />
      <ObjectCurrentReading
        visible={presentation.paused}
        value={value}
        definition={definition}
        schemaVersion={schemaVersion}
        prefix={prefix}
        fieldsInSurface={fieldsInSurface}
        onResume={() => onEditing(true)}
      />
      <fieldset hidden={presentation.paused} disabled={presentation.disabled}>
        <ObjectFields
          definitions={base.definition.fields}
          values={values}
          prefix={prefix}
          multiline={multiline}
          local={local}
          fieldsInSurface={surfaceFields}
          active={activeField}
          dirty={dirty.length > 0}
          onActive={activate}
          onChange={changeField}
        />
        <ReadFullItemAction
          local={local}
          active={activeField}
          fieldsInSurface={surfaceFields}
          onRead={() => onEditing(true)}
        />
        <ObjectDraftControls
          visible={presentation.controls}
          local={local}
          dirty={dirty.length > 0}
          name={saveLabel}
          onSave={() => void save()}
          onDiscard={discard}
        />
        <ObjectDraftNotices fields={base.definition.fields} dirty={dirty.length > 0} />
      </fieldset>
      <details>
        <summary>Current fields and technical identity</summary>
        <p>
          {value.id} · v{value.version}
        </p>
        <pre>{JSON.stringify(value.fields, null, 2)}</pre>
      </details>
    </div>
  );
}
function objectPresentation(
  local: boolean,
  active: string,
  formVisible: boolean,
  disabled: boolean,
) {
  const paused = local && !!active && !formVisible;
  return { paused, disabled: disabled || paused, controls: !local || !!active };
}
function ReadFullItemAction({
  local,
  active,
  fieldsInSurface,
  onRead,
}: {
  local: boolean;
  active: string;
  fieldsInSurface: string[];
  onRead(): void;
}) {
  if (!local || active || !fieldsInSurface.some((name) => name === "title" || name === "statement"))
    return null;
  return (
    <button className="text-action" onClick={onRead}>
      Read full item
    </button>
  );
}
function ObjectCurrentReading({
  visible,
  value,
  definition,
  schemaVersion,
  prefix,
  fieldsInSurface,
  onResume,
}: {
  visible: boolean;
  value: Entity | Relationship;
  definition: TypeDefinition;
  schemaVersion: number;
  prefix: string;
  fieldsInSurface: string[];
  onResume(): void;
}) {
  if (!visible) return null;
  return (
    <section aria-label="Current item reading">
      <small>
        Loaded values · v{value.version} / schema v{schemaVersion}
      </small>
      <ObjectFields
        definitions={definition.fields}
        values={draftFields(value.fields, definition.fields)}
        prefix={prefix}
        multiline={false}
        local
        active=""
        dirty={false}
        readOnly
        fieldsInSurface={fieldsInSurface}
        onActive={onResume}
        onChange={() => {}}
      />
      <button className="text-action" onClick={onResume}>
        Resume editing
      </button>
    </section>
  );
}
function surfaceFieldsForDraft(
  base: { value: Entity | Relationship; schemaVersion: number },
  value: Entity | Relationship,
  schemaVersion: number,
  fieldsInSurface: string[],
) {
  return base.value.version === value.version && base.schemaVersion === schemaVersion
    ? fieldsInSurface
    : [];
}
function clearSavedDraft(saved: boolean, setDirty: (fields: string[]) => void) {
  if (saved) setDirty([]);
}
function ObjectDraftNotices({
  fields,
  dirty,
}: {
  fields: TypeDefinition["fields"];
  dirty: boolean;
}) {
  return (
    <>
      {!Object.keys(fields).length && <p>No configurable attributes for this connection.</p>}
      {dirty && <small>Unsaved draft. Saving checks the versions you started editing.</small>}
    </>
  );
}
function useObjectDraft(
  value: Entity | Relationship,
  definition: TypeDefinition,
  schemaVersion: number,
  onDirty: (dirty: boolean) => void,
) {
  const initial = () => draftFields(value.fields, definition.fields);
  const [base, setBase] = useState({ value, definition, schemaVersion }),
    [values, setValues] = useState(initial),
    [dirty, setDirty] = useState<string[]>([]);
  const reset = () => {
    setBase({ value, definition, schemaVersion });
    setValues(initial());
    setDirty([]);
  };
  const syncCleanDraft = useEffectEvent(() => {
    if (!dirty.length) reset();
  });
  const notifyDirty = useEffectEvent(onDirty);
  useEffect(() => {
    syncCleanDraft();
  }, [value.version, schemaVersion]);
  useEffect(() => {
    notifyDirty(dirty.length > 0);
    return () => notifyDirty(false);
  }, [dirty.length]);
  return { base, values, dirty, setValues, setDirty, reset };
}
function ObjectDraftHeading({
  itemName,
  relationship,
  local,
  capturedVersion,
  version,
  capturedSchema,
  schemaVersion,
}: {
  itemName?: string;
  relationship?: boolean;
  local: boolean;
  capturedVersion: number;
  version: number;
  capturedSchema: number;
  schemaVersion: number;
}) {
  return (
    <>
      {itemName !== "item" && !local && (
        <h3>Edit {relationship ? "connection attributes" : "fields"}</h3>
      )}
      {(capturedVersion !== version || capturedSchema !== schemaVersion) && (
        <p className="gap">
          Draft based on v{capturedVersion} / schema v{capturedSchema}; current v{version} / schema
          v{schemaVersion}. Discard to adopt current values.
        </p>
      )}
    </>
  );
}
async function saveObjectDraft(
  base: { value: Entity | Relationship; definition: TypeDefinition; schemaVersion: number },
  values: Record<string, string>,
  dirty: string[],
  relationship: boolean | undefined,
  editing: Editing,
) {
  try {
    const fields = applyDraft(base.value.fields, base.definition.fields, values, dirty);
    const operation = relationship
      ? {
          op: "relationship.update" as const,
          id: base.value.id,
          expectedVersion: base.value.version,
          input: { ...(base.value as Relationship), fields },
        }
      : {
          op: "entity.update" as const,
          id: base.value.id,
          expectedVersion: base.value.version,
          input: { fields },
        };
    return await editing.commit([operation], base.schemaVersion);
  } catch (error) {
    editing.report(error, values);
    return false;
  }
}
function ObjectDraftControls({
  visible,
  local,
  dirty,
  name,
  onSave,
  onDiscard,
}: {
  visible: boolean;
  local: boolean;
  dirty: boolean;
  name: string;
  onSave(): void;
  onDiscard(): void;
}) {
  return (
    <div className="toolbar" hidden={!visible}>
      <button disabled={!dirty} onClick={onSave}>
        Save {name}
      </button>
      <button aria-label="Discard draft" disabled={!dirty && !local} onClick={onDiscard}>
        {local ? "Cancel" : "Discard draft"}
      </button>
    </div>
  );
}
