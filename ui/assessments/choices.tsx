import { useEffect, useEffectEvent, useState } from "react";
import type { Entity, Field, SchemaObject } from "../../src/core/model.ts";
import type { ApplicationModelPin } from "../../src/core/application-model.ts";
import type { ChangeAssessmentView } from "../../src/core/change-assessment.ts";
import { record } from "../../src/core/model.ts";
import { FieldControl } from "../fields.tsx";
import { label } from "../entity-label.ts";

/** Catalogue hints only. Server resolution validates all engineering meaning. */
export function modelChoices(entities: Entity[], schema: SchemaObject | null) {
  return entities.flatMap((entity) =>
    Object.entries(schema?.entityTypes[entity.type]?.fields ?? {})
      .filter(
        ([name, field]) =>
          field.type === "json" &&
          record(entity.fields[name]) &&
          entity.fields[name].contract === "change_assessment",
      )
      .map(([field]) => ({
        name: `${label(entity)} · v${entity.version} · ${field}`,
        pin: { entityId: entity.id, version: entity.version, field } satisfies ApplicationModelPin,
      })),
  );
}
export function assessmentChoices(entities: Entity[]) {
  return entities.filter((entity) =>
    Object.values(entity.fields).some(
      (value) => record(value) && value.contract === "change_assessment_scope",
    ),
  );
}
export function useAssessmentDirty(value: boolean, report: (value: boolean) => void) {
  const notify = useEffectEvent(report);
  useEffect(() => {
    notify(value);
    return () => notify(false);
  }, [value]);
}
export function assessmentCommand(view: ChangeAssessmentView, reason: string) {
  return {
    assessmentId: view.assessment.id,
    openingCommandId: view.opening.commandId,
    commandId: crypto.randomUUID(),
    reason,
    expectedSchemaVersion: view.model.context.schemaVersion,
    expectedProjectRevision: view.model.context.projectRevision,
    expectedEvidenceRevision: view.model.context.evidenceRevision,
    expectedAssessmentVersion: view.assessment.version,
  };
}
export function AdditionalFields({
  definitions,
  values,
  onChange,
}: {
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
            name={`Assessment ${name}`}
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
}: {
  entities: Entity[];
  name: string;
  value: string;
  onChange(id: string): void;
  required?: boolean;
}) {
  const [search, setSearch] = useState("");
  const matches = entities.filter((entity) =>
    `${label(entity)} ${entity.fields.title ?? ""}`
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
              {label(entity)} · {String(entity.fields.title ?? entity.type)} · v{entity.version}
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
