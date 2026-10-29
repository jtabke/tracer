import { useState } from "react";
import type { Entity } from "../../src/core/model.ts";
import type { SupportReference } from "../../src/core/change-assessment.ts";
import type { Editing } from "../editing.ts";
import { label } from "../entity-label.ts";
import { RecordChoice } from "./choices.tsx";
import { ConfigurationConclusionSupport } from "./conclusion-support.tsx";
import { SupportMaterialChoice } from "./support-material.tsx";

export function AssessmentSupport({
  title,
  value,
  entities,
  editing,
  onChange,
  configurationId,
}: {
  configurationId?: string;
  title: string;
  value: SupportReference[];
  entities: Entity[];
  editing: Editing;
  onChange(value: SupportReference[]): void;
}) {
  const [kind, setKind] = useState<SupportReference["kind"]>("entity");
  const [mode, setMode] = useState<"historical" | "current">("historical");
  const [selected, setSelected] = useState<SupportReference>();
  const add = () => {
    if (!selected || selected.mode === "configuration" || value.length >= 10) return;
    onChange([...value, { ...selected, mode }]);
    setSelected(undefined);
  };
  return (
    <details className="assessment-support">
      <summary>
        {title} · {value.length} selections
      </summary>
      <ol>
        {value.map((reference, index) => (
          <li key={`${reference.kind}:${reference.id}:${index}`}>
            <span>
              {supportName(reference, entities)} · {reference.mode}
              {"version" in reference && ` · v${reference.version}`}
              {reference.mode === "configuration" && ` · target ${reference.configurationId}`}
            </span>
            <button
              type="button"
              aria-label={`Remove ${title.toLowerCase()} ${index + 1}`}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <label>
        Supporting material
        <select
          aria-label={`${title} kind`}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setSelected(undefined);
          }}
        >
          <option value="entity">Native record annotations</option>
          <option value="relationship">Native connection</option>
          <option value="receipt">Recorded evaluation</option>
          <option value="observation">Observed external content</option>
        </select>
      </label>
      {kind === "entity" ? (
        <RecordChoice
          name={`${title} record`}
          entities={entities}
          value={selected?.id ?? ""}
          onChange={(id) => {
            const entity = entities.find((item) => item.id === id);
            setSelected(
              entity
                ? { kind: "entity", id: entity.id, version: entity.version, mode: "historical" }
                : undefined,
            );
          }}
        />
      ) : (
        <SupportMaterialChoice
          key={kind}
          title={title}
          kind={kind}
          entities={entities}
          editing={editing}
          selected={selected}
          onChoose={setSelected}
        />
      )}
      <label>
        Use
        <select
          aria-label={`${title} use`}
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="historical">Historical context</option>
          <option value="current">Must remain current</option>
        </select>
      </label>
      <p>
        {kind === "entity"
          ? "A native record selection captures its annotations, not the bytes of an external resource. Choose observed content for that material."
          : "The exact selected state is captured when the judgment is recorded."}
      </p>
      <button type="button" disabled={!selected || value.length >= 10} onClick={add}>
        Add {title.toLowerCase()}
      </button>
      {configurationId && (
        <ConfigurationConclusionSupport
          title={title}
          configurationId={configurationId}
          entities={entities}
          editing={editing}
          full={value.length >= 10}
          add={(reference) => onChange([...value, reference])}
        />
      )}
    </details>
  );
}
function supportName(reference: SupportReference, entities: Entity[]) {
  const entity = entities.find((item) => item.id === reference.id);
  return entity ? label(entity) : `${reference.kind} ${reference.id.slice(0, 8)}`;
}
