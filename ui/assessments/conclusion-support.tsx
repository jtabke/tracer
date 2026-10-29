import { useState } from "react";
import type { SupportReference } from "../../src/core/change-assessment.ts";
import type { Entity } from "../../src/core/model.ts";
import type { Editing } from "../editing.ts";
import { SupportMaterialChoice } from "./support-material.tsx";

export function ConfigurationConclusionSupport({
  title,
  configurationId,
  entities,
  editing,
  full,
  add,
}: {
  title: string;
  configurationId: string;
  entities: Entity[];
  editing: Editing;
  full: boolean;
  add(value: SupportReference): void;
}) {
  const [selected, setSelected] = useState<SupportReference>();
  return (
    <section aria-label={`${title} target verification`}>
      <h5>After-target verification conclusion</h5>
      <p>
        Select a genuine controlled conclusion for {configurationId}. A report outcome or a generic
        Review cannot establish verification.
      </p>
      <SupportMaterialChoice
        title={`${title} target conclusion`}
        kind="receipt"
        entities={entities}
        editing={editing}
        selected={selected}
        onChoose={setSelected}
      />
      <button
        type="button"
        disabled={full || selected?.kind !== "receipt"}
        onClick={() => {
          if (selected?.kind === "receipt") {
            add({ kind: "receipt", id: selected.id, mode: "configuration", configurationId });
            setSelected(undefined);
          }
        }}
      >
        Add {title.toLowerCase()} target conclusion
      </button>
    </section>
  );
}
