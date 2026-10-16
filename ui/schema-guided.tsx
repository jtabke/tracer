import { useState } from "react";
import type { Schema } from "../src/core/model.ts";
import { SchemaDefinitionForm } from "./schema-definition-form.tsx";

export type DefinitionSelection = {
  group: "entityTypes" | "relationshipTypes";
  name: string;
  pathIndex?: number;
};

export function GuidedDefinitions({
  draft,
  onChange,
  selection,
  onSelect,
  compact = false,
  focused = false,
}: {
  draft: Schema;
  onChange(value: Schema): void;
  selection?: DefinitionSelection;
  onSelect?(selection: DefinitionSelection): void;
  compact?: boolean;
  focused?: boolean;
}) {
  const [local, setLocal] = useState<DefinitionSelection>({ group: "entityTypes", name: "" });
  const current = selection ?? local;
  const group = current.group;
  const selected = current.name;
  const choose = onSelect ?? setLocal;
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const definition = Object.hasOwn(draft[group], selected) ? draft[group][selected] : undefined;
  return (
    <div className={`schema-guided ${compact ? "is-compact" : ""}`}>
      <div hidden={focused && !!definition}>
        <label>
          Definition kind
          <select
            aria-label="Definition kind"
            value={group}
            onChange={(event) => {
              choose({ group: event.target.value as typeof group, name: "" });
            }}
          >
            <option value="entityTypes">Entity types</option>
            <option value="relationshipTypes">Relationships</option>
          </select>
        </label>
        {compact && (
          <label>
            Select definition
            <select
              aria-label="Select definition"
              value={selected}
              onChange={(event) => choose({ group, name: event.target.value })}
            >
              <option value="">New definition</option>
              {Object.keys(draft[group]).map((name) => (
                <option key={name} value={name}>
                  {name.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        )}
        <ul hidden={compact}>
          {Object.keys(draft[group]).map((key) => (
            <li key={key}>
              <button
                type="button"
                aria-pressed={selected === key}
                onClick={() => choose({ group, name: key })}
              >
                {key}
              </button>
            </li>
          ))}
        </ul>
        <form
          hidden={compact && !!definition}
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || Object.hasOwn(draft[group], name)) {
              setNameError("Enter a nonempty, unique definition name.");
              event.currentTarget.querySelector("input")?.focus();
              return;
            }
            onChange({ ...draft, [group]: { ...draft[group], [name]: { fields: {} } } });
            choose({ group, name });
            setName("");
            setNameError("");
          }}
        >
          <label>
            New definition name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <button>Add definition</button>
        </form>
        {nameError && <p role="alert">{nameError}</p>}
      </div>
      {definition ? (
        <SchemaDefinitionForm
          key={`${group}:${selected}`}
          name={selected}
          definition={definition}
          relationship={group === "relationshipTypes"}
          pathIndex={current.pathIndex}
          names={Object.keys(draft.entityTypes)}
          onChange={(value) =>
            onChange({ ...draft, [group]: { ...draft[group], [selected]: value } })
          }
        />
      ) : (
        <p>Select a definition or add one.</p>
      )}
    </div>
  );
}
