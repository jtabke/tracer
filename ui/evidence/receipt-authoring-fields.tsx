import { useState } from "react";
import type { Entity } from "../../src/core/model.ts";
import { label } from "../entity-label.ts";
import type { ChosenEntity, InputDraft } from "./receipt-authoring-state.ts";
import { statementText } from "../statement-text.ts";

export function ReceiptEntityChoice({
  name,
  entities,
  chosen,
  onChoose,
}: {
  name: string;
  entities: Entity[];
  chosen?: Entity;
  onChoose(entity?: Entity): void;
}) {
  const [search, setSearch] = useState("");
  const matching = entities.filter((entity) =>
    `${label(entity)} ${entity.fields.title ?? ""} ${statementText(entity)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="receipt-entity-choice">
      <label>
        Find {name.toLowerCase()}
        <input
          aria-label={`Find ${name.toLowerCase()}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Key, title or statement"
        />
      </label>
      <label>
        {name}
        <select
          aria-label={name}
          value={chosen?.id ?? ""}
          onChange={(event) =>
            onChoose(entities.find((entity) => entity.id === event.target.value))
          }
        >
          <option value="">Choose {name.toLowerCase()}</option>
          {chosen && !matching.some((entity) => entity.id === chosen.id) && (
            <option value={chosen.id}>{choiceName(chosen)} · retained selection</option>
          )}
          {matching.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {choiceName(entity)}
            </option>
          ))}
        </select>
      </label>
      <small>{matching.length} matching loaded choices</small>
    </div>
  );
}
function choiceName(entity: Entity) {
  const title =
    typeof entity.fields.title === "string" && entity.fields.title !== label(entity)
      ? ` · ${entity.fields.title}`
      : "";
  return `${label(entity)}${title} · v${entity.version}`;
}
export function ReceiptStatement({
  chosen,
  kind,
  compact = false,
}: {
  chosen: ChosenEntity;
  kind: string;
  compact?: boolean;
}) {
  const text = statementText(chosen.entity);
  const title = chosen.entity.fields.title;
  return (
    <div className="receipt-chosen-statement" aria-label={`${kind} captured context`}>
      <small>
        {label(chosen.entity)} · captured v{chosen.entity.version} · schema v{chosen.schema.version}
      </small>
      {!compact &&
        typeof title === "string" &&
        title !== text &&
        title !== label(chosen.entity) && <h4>{title}</h4>}
      {!compact && <p>{text || "No primary statement is set."}</p>}
    </div>
  );
}
export function ReceiptFieldScope({
  input,
  chosen,
  onChange,
}: {
  input: InputDraft;
  chosen: ChosenEntity;
  onChange(patch: Partial<InputDraft>): void;
}) {
  const fields = Object.entries(chosen.schema.entityTypes[chosen.entity.type]?.fields ?? {});
  return (
    <section className="receipt-field-scope" aria-label="Native field scope">
      <div className="receipt-mode-controls" role="group" aria-label="Native field scope mode">
        <label>
          <input
            type="radio"
            name={`scope-${input.id}`}
            checked={input.fieldsMode === "whole"}
            onChange={() => onChange({ fieldsMode: "whole", fields: [] })}
          />
          Whole item
        </label>
        <label>
          <input
            type="radio"
            name={`scope-${input.id}`}
            checked={input.fieldsMode === "selected"}
            onChange={() => onChange({ fieldsMode: "selected", fields: [] })}
          />
          Selected fields
        </label>
      </div>
      {input.fieldsMode === "selected" && (
        <>
          <p>Select at least one field from this chosen revision’s schema.</p>
          <div className="receipt-field-choices">
            {fields.map(([name, field]) => (
              <label key={name}>
                <input
                  type="checkbox"
                  aria-label={`Include field ${name}`}
                  checked={input.fields.includes(name)}
                  onChange={(event) =>
                    onChange({
                      fields: event.target.checked
                        ? [...input.fields, name]
                        : input.fields.filter((value) => value !== name),
                    })
                  }
                />
                <span>
                  <strong>{name.replaceAll("_", " ")}</strong>
                  <small>{field.type}</small>
                  <span>{valueText(chosen.entity.fields[name])}</span>
                </span>
              </label>
            ))}
          </div>
          {!input.fields.length && (
            <p role="status">Recording is paused until at least one field is selected.</p>
          )}
        </>
      )}
    </section>
  );
}
function valueText(value: unknown) {
  return value === undefined
    ? "Not set"
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
}
