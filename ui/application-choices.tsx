import { useEffect, useEffectEvent, useState } from "react";
import type { Entity, Field, SchemaObject } from "../src/core/model.ts";
import type { ApplicationModelPin } from "../src/core/application-model.ts";
import { record } from "../src/core/model.ts";
import { FieldControl } from "./fields.tsx";
import { label } from "./entity-label.ts";
/** Catalogue hints only. Server resolution validates all engineering meaning. */
export function applicationModelChoices(
  entities: Entity[],
  schema: SchemaObject | null,
  contract: string,
) {
  return entities.flatMap((entity) =>
    Object.entries(schema?.entityTypes[entity.type]?.fields ?? {})
      .filter(
        ([name, field]) =>
          field.type === "json" &&
          record(entity.fields[name]) &&
          entity.fields[name].contract === contract,
      )
      .map(([field]) => ({
        name: `${label(entity)} · v${entity.version} · ${field}`,
        pin: { entityId: entity.id, version: entity.version, field } satisfies ApplicationModelPin,
      })),
  );
}
export function useApplicationDirty(value: boolean, report: (value: boolean) => void) {
  const notify = useEffectEvent(report);
  useEffect(() => {
    notify(value);
    return () => notify(false);
  }, [value]);
}
export function AdditionalFields({
  title = "Assessment",
  definitions,
  values,
  onChange,
}: {
  title?: string;
  definitions: Record<string, Field> | null;
  values: Record<string, string>;
  onChange(values: Record<string, string>): void;
}) {
  return (
    <>
      {Object.entries(definitions ?? {}).map(([name, field]) => (
        <label key={name}>
          {name} *
          <FieldControl
            name={`${title} ${name}`}
            field={field}
            value={values[name] ?? ""}
            onChange={(value) => onChange({ ...values, [name]: value })}
          />
        </label>
      ))}
    </>
  );
}
export function RecordChoice({
  entities,
  name,
  value,
  onChange,
  required = false,
  titleField = "title",
}: {
  entities: Entity[];
  name: string;
  value: string;
  onChange(id: string): void;
  required?: boolean;
  titleField?: string;
}) {
  const [search, setSearch] = useState("");
  const matches = entities.filter((entity) =>
    `${label(entity)} ${entity.fields[titleField] ?? entity.fields.name ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const shown = matches.slice(0, 50),
    selected = entities.find((entity) => entity.id === value);
  return (
    <div className="assessment-choice">
      <label>
        Find {name.toLowerCase()}
        <input
          aria-label={`Find ${name.toLowerCase()}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <label>
        {name}
        <select
          required={required}
          aria-label={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose {name.toLowerCase()}</option>
          {selected && !shown.some((entity) => entity.id === selected.id) && (
            <option value={value}>{label(selected)} · retained selection</option>
          )}
          {shown.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {choiceLabel(entity, titleField)} · v{entity.version}
            </option>
          ))}
        </select>
      </label>
      <small>
        {shown.length} shown · {matches.length} matching project records. Search to narrow the
        choices.
      </small>
    </div>
  );
}

function choiceLabel(entity: Entity, titleField: string) {
  const identity = label(entity),
    title = entity.fields[titleField] ?? entity.fields.name;
  return typeof title === "string" && title !== identity ? `${identity} · ${title}` : identity;
}
