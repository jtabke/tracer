import type { Field, Fields, Json, SchemaObject } from "../src/core/model.ts";
import { draftValue } from "./draft-values.ts";
export { label } from "./entity-label.ts";
const raw = (value: Json | undefined, field: Field) =>
  value === undefined ? "" : field.type === "string" ? String(value) : JSON.stringify(value);
function parse(value: string, field: Field): Json | undefined {
  if (field.type === "string") return value;
  if (!value.trim()) return undefined;
  if (field.type === "boolean") return value === "true";
  if (field.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error("Enter a finite number");
    return number;
  }
  return JSON.parse(value) as Json;
}
function setField(fields: Fields, name: string, value: Json | undefined) {
  const result = { ...fields };
  if (value === undefined) delete result[name];
  else
    Object.defineProperty(result, name, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  return result;
}
export function draftFields(fields: Fields, definitions: Record<string, Field>) {
  return Object.fromEntries(
    Object.entries(definitions).map(([name, field]) => [
      name,
      raw(Object.hasOwn(fields, name) ? fields[name] : undefined, field),
    ]),
  );
}
export function applyDraft(
  fields: Fields,
  definitions: Record<string, Field>,
  values: Record<string, string>,
  dirty: string[],
) {
  return dirty.reduce(
    (next, name) => setField(next, name, parse(draftValue(values, name), definitions[name])),
    { ...fields },
  );
}
export function FieldControl({
  field,
  value,
  onChange,
  name,
  disabled,
  multiline = false,
}: {
  field: Field;
  value: string;
  onChange(value: string): void;
  name: string;
  disabled?: boolean;
  multiline?: boolean;
}) {
  if ((field.type === "string" || field.type === "json") && multiline)
    return (
      <textarea
        aria-label={name}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    );
  return field.type === "boolean" ? (
    <select
      aria-label={name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      <option value="">Not set</option>
      <option value="true">True</option>
      <option value="false">False</option>
    </select>
  ) : (
    <input
      aria-label={name}
      type={field.type === "number" ? "number" : "text"}
      step={field.type === "number" ? "any" : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    />
  );
}

export function fieldsFrom(
  values: Record<string, string>,
  definitions: SchemaObject["entityTypes"][string]["fields"],
  options: { keepEmptyRequiredStrings?: boolean } = {},
) {
  let fields: Fields = {};
  for (const [name, field] of Object.entries(definitions)) {
    const value = draftValue(values, name);
    const requiredString = field.required && field.type === "string";
    if (value !== "" || (options.keepEmptyRequiredStrings && requiredString))
      fields = setField(fields, name, parse(value, field));
  }
  return fields;
}
