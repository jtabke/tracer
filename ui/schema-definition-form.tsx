import { useState } from "react";
import type { Field, RelationshipDefinition, TypeDefinition } from "../src/core/model.ts";
import { endpointMode } from "./schema-draft.ts";
import { SchemaFields } from "./schema-fields.tsx";
import { SchemaWorkflowForm } from "./schema-workflow-form.tsx";

function EndpointGroup({
  side,
  types,
  names,
  onChange,
}: {
  side: "source" | "target";
  types?: string[];
  names: string[];
  onChange(types: string[] | undefined): void;
}) {
  const [selectedMode, setSelectedMode] = useState(false);
  const mode = endpointMode(types, selectedMode);
  return (
    <fieldset>
      <legend>{{ source: "Sources", target: "Targets" }[side]}</legend>
      <div className="schema-endpoint-modes">
        {(["any", "selected", "none"] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name={`endpoint-${side}`}
              checked={mode === value}
              onChange={() => {
                setSelectedMode(value === "selected");
                const values = { any: undefined, none: [], selected: types ?? [] };
                onChange(values[value]);
              }}
            />
            {{ any: "Any type", none: "No types", selected: "Selected types" }[value]}
          </label>
        ))}
      </div>
      {mode === "selected" && (
        <>
          <p>Selected types are alternatives. Zero selected allows no {side} types.</p>
          <div className="schema-endpoint-types">
            {names.map((name) => (
              <label key={name}>
                <input
                  type="checkbox"
                  aria-label={name}
                  checked={types?.includes(name) ?? false}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...(types ?? []), name]
                        : (types?.filter((type) => type !== name) ?? []),
                    )
                  }
                />
                <span>{name.replaceAll("_", " ")}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </fieldset>
  );
}

export function SchemaDefinitionForm({
  name,
  definition,
  relationship,
  names,
  onChange,
  pathIndex,
}: {
  name: string;
  definition: TypeDefinition | RelationshipDefinition;
  relationship: boolean;
  names: string[];
  onChange(value: TypeDefinition | RelationshipDefinition): void;
  pathIndex?: number;
}) {
  const [fieldName, setFieldName] = useState("");
  const [error, setError] = useState("");
  const patchField = (field: string, patch: Partial<Field>) =>
    onChange({
      ...definition,
      fields: { ...definition.fields, [field]: { ...definition.fields[field], ...patch } },
    });
  const endpoint = (side: "source" | "target", types: string[] | undefined) => {
    const next: RelationshipDefinition = structuredClone(definition);
    if (types === undefined) delete next[side];
    else next[side] = types;
    onChange(next);
  };
  return (
    <section>
      <h3>{name}</h3>
      {relationship && (
        <SchemaWorkflowForm
          definition={definition as RelationshipDefinition}
          names={names}
          onChange={onChange}
          initialPath={pathIndex}
        />
      )}
      {relationship &&
        (["source", "target"] as const).map((side) => (
          <EndpointGroup
            key={side}
            side={side}
            types={(definition as RelationshipDefinition)[side]}
            names={names}
            onChange={(types) => endpoint(side, types)}
          />
        ))}
      <h4>Fields</h4>
      <SchemaFields definition={definition} onChange={patchField} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!fieldName.trim() || Object.hasOwn(definition.fields, fieldName)) {
            setError("Enter a nonempty, unique field name.");
            event.currentTarget.querySelector("input")?.focus();
            return;
          }
          onChange({
            ...definition,
            fields: { ...definition.fields, [fieldName]: { type: "string" } },
          });
          setFieldName("");
          setError("");
        }}
      >
        <label>
          New field name
          <input value={fieldName} onChange={(event) => setFieldName(event.target.value)} />
        </label>
        <button>Add field</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <p className="schema-definition-note">
        Names are fixed in guided editing. Recorded data is checked before saving changed fields or
        constraints.
      </p>
    </section>
  );
}
