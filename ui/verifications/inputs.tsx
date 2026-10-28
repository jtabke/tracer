import { useState } from "react";
import type { Entity } from "../../src/core/model.ts";
import type { InputDeclaration, RelationshipDeclaration } from "../../src/core/evidence.ts";
import type { Editing } from "../editing.ts";
import { RecordChoice } from "../application-choices.tsx";
import { RecordedMaterialChoice } from "../recorded-material.tsx";
import type { RecordedMaterial } from "../recorded-material.tsx";
import { label } from "../entity-label.ts";
export type VerificationSupportDraft = {
  inputs: InputDeclaration[];
  relationshipInputs: RelationshipDeclaration[];
};
export function VerificationInputs({
  entities,
  editing,
  value,
  onChange,
}: {
  entities: Entity[];
  editing: Editing;
  value: VerificationSupportDraft;
  onChange(value: VerificationSupportDraft): void;
}) {
  const [kind, setKind] = useState("native"),
    [entityId, setEntityId] = useState(""),
    [selected, setSelected] = useState<RecordedMaterial>(),
    [fields, setFields] = useState<string[]>([]),
    [role, setRole] = useState("");
  const entity = entities.find((x) => x.id === entityId),
    count = value.inputs.length + value.relationshipInputs.length;
  function add() {
    if (!role.trim() || count >= 20) return;
    if (kind === "native" && entity) {
      onChange({
        ...value,
        inputs: [
          ...value.inputs,
          {
            entityId: entity.id,
            facet: "native",
            revision: entity.version,
            ...(fields.length ? { fields } : {}),
            role,
          },
        ],
      });
    } else if (selected && "entityId" in selected)
      onChange({
        ...value,
        inputs: [
          ...value.inputs,
          { entityId: selected.entityId, facet: "content", observationId: selected.id, role },
        ],
      });
    else if (selected && "source" in selected)
      onChange({
        ...value,
        relationshipInputs: [
          ...value.relationshipInputs,
          { id: selected.id, revision: selected.version, role },
        ],
      });
    else return;
    setSelected(undefined);
    setEntityId("");
    setFields([]);
    setRole("");
  }
  return (
    <details>
      <summary>Supporting inputs · {count}</summary>
      <p>
        Native annotations, observed content and direct connections have distinct meanings. The
        exact selected state is captured; selecting an external record's annotations does not
        capture its file bytes. The model, governing requirement, method, method mapping and owned
        activity membership are captured automatically; add other supporting material here.
      </p>
      <ol>
        {value.inputs.map((x, i) => (
          <li key={`input-${i}`}>
            {entities.find((e) => e.id === x.entityId)
              ? label(entities.find((e) => e.id === x.entityId)!)
              : x.entityId.slice(0, 8)}{" "}
            · {x.facet} · {x.role}
            <button
              type="button"
              onClick={() => onChange({ ...value, inputs: value.inputs.filter((_, n) => i !== n) })}
            >
              Remove supporting input {i + 1}
            </button>
          </li>
        ))}
        {value.relationshipInputs.map((x, i) => (
          <li key={`link-${i}`}>
            Connection · v{x.revision} · {x.role}
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  relationshipInputs: value.relationshipInputs.filter((_, n) => i !== n),
                })
              }
            >
              Remove supporting connection {i + 1}
            </button>
          </li>
        ))}
      </ol>
      <label>
        Supporting input kind
        <select
          aria-label="Supporting input kind"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setSelected(undefined);
          }}
        >
          <option value="native">Native record annotations</option>
          <option value="observation">Observed content</option>
          <option value="relationship">Direct connection</option>
        </select>
      </label>
      {kind === "native" ? (
        <>
          <RecordChoice
            name="Supporting record"
            entities={entities}
            value={entityId}
            onChange={(id) => {
              setEntityId(id);
              setFields([]);
            }}
          />
          {entity && (
            <fieldset>
              <legend>Native field scope</legend>
              <p>
                Choose fields to narrow the dependency. Leaving all unchecked captures the whole
                native record.
              </p>
              {Object.keys(entity.fields).map((name) => (
                <label key={name}>
                  <span>
                    <input
                      type="checkbox"
                      aria-label={`Supporting field ${name}`}
                      checked={fields.includes(name)}
                      onChange={(e) =>
                        setFields(
                          e.target.checked ? [...fields, name] : fields.filter((x) => x !== name),
                        )
                      }
                    />
                    {name}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </>
      ) : (
        <RecordedMaterialChoice
          key={kind}
          title="Verification support"
          kind={kind === "observation" ? "observation" : "relationship"}
          entities={entities}
          editing={editing}
          selected={selected}
          onChoose={setSelected}
        />
      )}
      <label>
        Supporting input purpose
        <input
          aria-label="Supporting input purpose"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={count >= 20 || !role.trim() || !(kind === "native" ? entity : selected)}
        onClick={add}
      >
        Add supporting input
      </button>
    </details>
  );
}
