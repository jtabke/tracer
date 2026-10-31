import { FieldControl, draftFields, fieldsFrom } from "../fields.tsx";
import type { Field } from "../../src/core/model.ts";
import {
  initialReferenceDraft,
  referenceFamilies,
  referenceOperation,
  canPinReference,
} from "./draft.ts";
import type { ReferenceContext } from "./draft.ts";
import { useEffect, useState } from "react";
import type { Editing } from "../editing.ts";
export function ReferenceEditor({
  context,
  editing,
  onSaved,
  onDirty,
}: {
  context: ReferenceContext;
  editing: Editing;
  onSaved(): void;
  onDirty(value: boolean): void;
}) {
  const [base] = useState(context);
  const { link, resources } = base;
  const families = referenceFamilies(base);
  const [draft, setDraft] = useState(() =>
    initialReferenceDraft(base, `local:${crypto.randomUUID()}`),
  );
  const { resourceId, sourceId, label, role, scope, explanation, mode, type } = draft;
  const change = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((before) => ({ ...before, [key]: value }));
  const definitions = base.schema.relationshipTypes[type]?.fields ?? {};
  const [values, setValues] = useState(() => draftFields(link?.fields ?? {}, definitions));
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  async function save() {
    try {
      const success = await editing.mutate("/api/changesets", {
        commandId: `reference:${sourceId}`,
        operations: [referenceOperation(base, draft, fieldsFrom(values, definitions))],
        expectedSchemaVersion: base.schema.version,
      });
      if (success) {
        setDirty(false);
        onSaved();
      }
    } catch (error) {
      editing.report(error);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      onChange={() => setDirty(true)}
    >
      <h3>{link ? "Edit reference" : "Add reference"}</h3>
      {!families.length && (
        <p>Configure an explicitly reference-capable relationship in Model → Text / JSON first.</p>
      )}
      <fieldset disabled={editing.busy}>
        {!link && (
          <>
            <label>
              Reference relationship
              <select
                aria-label="Reference relationship"
                value={type}
                onChange={(e) => {
                  change("type", e.target.value);
                  setValues({});
                }}
              >
                {families.map(([name]) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label>
              Resource
              <select
                aria-label="Resource"
                value={resourceId}
                onChange={(e) => change("resourceId", e.target.value)}
              >
                <option value="">New local resource</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.resource?.label ?? r.key ?? r.id}
                  </option>
                ))}
              </select>
            </label>
            {!resourceId && (
              <label>
                Resource title
                <input required value={label} onChange={(e) => change("label", e.target.value)} />
              </label>
            )}
          </>
        )}
        <ReferenceFields
          definitions={definitions}
          values={values}
          onChange={(name, value) => setValues((before) => ({ ...before, [name]: value }))}
        />
        <label>
          Reference role
          <input required value={role} onChange={(e) => change("role", e.target.value)} />
        </label>
        <label>
          Section or passage label
          <input value={scope} onChange={(e) => change("scope", e.target.value)} />
        </label>
        <label>
          Why this material matters
          <textarea value={explanation} onChange={(e) => change("explanation", e.target.value)} />
        </label>
        <label>
          Source state
          <select
            aria-label="Source state"
            value={mode}
            onChange={(e) => change("mode", e.target.value as "current" | "pinned")}
          >
            <option value="current">Latest observed state</option>
            <option value="pinned" disabled={!canPinReference(base, draft)}>
              Pin observed state
            </option>
          </select>
        </label>
        {base.observation?.availability === "available" &&
          link?.reference?.state.mode === "pinned" && (
            <button
              type="button"
              onClick={() => {
                change("pinLatest", true);
                change("mode", "pinned");
                setDirty(true);
              }}
            >
              Use latest observed state
            </button>
          )}
        {base.observation && (
          <p>
            Pin candidate: {base.observation.hash ?? "unavailable"} · observed {base.observation.at}
            . Cancel and reopen to adopt a newer observation.
          </p>
        )}
        <p>
          Passage labels are retained for interpretation; automatic passage comparison is
          unavailable. Observe the local file before pinning or capturing external content.
        </p>
        <button
          disabled={
            !type ||
            (!link && !resourceId && !label.trim()) ||
            (mode === "pinned" && !canPinReference(base, draft))
          }
        >
          Save reference
        </button>
      </fieldset>
    </form>
  );
}

function ReferenceFields({
  definitions,
  values,
  onChange,
}: {
  definitions: Record<string, Field>;
  values: Record<string, string>;
  onChange(name: string, value: string): void;
}) {
  return (
    <>
      {Object.entries(definitions).map(([name, field]) => (
        <label key={name}>
          {name}
          {field.required ? " *" : ""}
          <FieldControl
            name={`Reference field ${name}`}
            field={field}
            value={values[name] ?? ""}
            onChange={(value) => onChange(name, value)}
          />
        </label>
      ))}
    </>
  );
}
