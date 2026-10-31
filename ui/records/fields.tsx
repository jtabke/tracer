import type { Field, TypeDefinition } from "../../src/core/model.ts";
import { draftValue } from "../draft-values.ts";
import { FieldControl } from "../fields.tsx";
import { readable } from "../presentation-text.ts";

/** Presentation only; the parent owns one captured draft and its guarded save. */
export function ObjectFields({
  definitions,
  values,
  prefix,
  multiline,
  local,
  active,
  onActive,
  onChange,
  dirty,
  fieldsInSurface = [],
  readOnly = false,
}: {
  definitions: TypeDefinition["fields"];
  values: Record<string, string>;
  prefix: string;
  multiline: boolean;
  local: boolean;
  active: string;
  dirty: boolean;
  fieldsInSurface?: string[];
  readOnly?: boolean;
  onActive(name: string): void;
  onChange(name: string, value: string): void;
}) {
  const fields = visibleFields(definitions, values, local, active, fieldsInSurface);
  const primary = new Set(["title", "statement"]);
  const hasPrimary = fields.some(([name]) => primary.has(name));
  const main =
    local && active !== "*" && hasPrimary ? fields.filter(([name]) => primary.has(name)) : fields;
  const metadata =
    local && active !== "*" && hasPrimary ? fields.filter(([name]) => !primary.has(name)) : [];
  const renderField = ([name, field]: [string, Field]) => {
    const editing = !local || active === name || active === "*";
    return (
      <div key={name} className="local-field">
        {editing ? (
          <label>
            {readable(name)}
            {field.required ? " *" : ""}
            <FieldControl
              field={field}
              value={draftValue(values, name)}
              name={`${prefix} ${name}`}
              multiline={multiline || (local && name !== "title")}
              onChange={(next) => onChange(name, next)}
            />
          </label>
        ) : (
          <FieldReading
            name={name}
            field={field}
            value={draftValue(values, name)}
            disabled={dirty}
            readOnly={readOnly}
            inSurface={!active && primary.has(name) && fieldsInSurface.includes(name)}
            onEdit={() => onActive(name)}
          />
        )}
      </div>
    );
  };
  return (
    <div className={local ? "local-fields" : undefined}>
      {main.map(renderField)}
      {local && !readOnly && (
        <button
          className="text-action"
          disabled={dirty}
          onClick={() => onActive(active === "*" ? "" : "*")}
        >
          {active === "*" ? "Back to reading" : "Edit item"}
        </button>
      )}
      {!!metadata.length && (
        <details className="item-metadata">
          <summary>Item properties · {metadata.length}</summary>
          {metadata.map(renderField)}
        </details>
      )}
    </div>
  );
}

function visibleFields(
  definitions: TypeDefinition["fields"],
  values: Record<string, string>,
  local: boolean,
  active: string,
  fieldsInSurface: string[],
) {
  return Object.entries(definitions).filter(
    ([name]) =>
      !local ||
      active === "*" ||
      active === name ||
      fieldsInSurface.length > 0 ||
      name !== "title" ||
      values.title !== values.statement,
  );
}

function FieldReading({
  inSurface,
  readOnly,
  ...preview
}: {
  name: string;
  field: Field;
  value?: string;
  disabled: boolean;
  inSurface: boolean;
  readOnly: boolean;
  onEdit(): void;
}) {
  if (readOnly) return inSurface ? null : <ReadOnlyField {...preview} />;
  if (!inSurface) return <FieldPreview {...preview} />;
  return (
    <button className="text-action" disabled={preview.disabled} onClick={preview.onEdit}>
      Edit {readable(preview.name)}
    </button>
  );
}

function ReadOnlyField({ name, field, value }: { name: string; field: Field; value?: string }) {
  return (
    <div className="field-preview">
      <small>{readable(name)}</small>
      <span className={field.type === "json" ? "field-json-preview" : undefined}>
        {value || "Not set"}
      </span>
    </div>
  );
}

function FieldPreview({
  name,
  field,
  value,
  disabled,
  onEdit,
}: {
  name: string;
  field: Field;
  value?: string;
  disabled: boolean;
  onEdit(): void;
}) {
  return (
    <button
      className="field-preview"
      aria-label={`Edit ${readable(name)}`}
      disabled={disabled}
      onClick={onEdit}
    >
      <small>{readable(name)}</small>
      <span className={field.type === "json" ? "field-json-preview" : undefined}>
        {value || "Not set"}
      </span>
      {field.type === "json" && <small>JSON · open to edit the full value</small>}
      <span className="field-edit-hint">Edit</span>
    </button>
  );
}
