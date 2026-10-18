import { useState } from "react";
import type { InitialView } from "../src/core/presentation.ts";
import type { Schema } from "../src/core/model.ts";
import { projectTemplates } from "../src/core/project-templates.ts";
import { emptySchema, nativeDraft } from "./schema-draft.ts";
export function SchemaStarter({
  changed,
  onChange,
}: {
  changed: boolean;
  onChange(schema: Schema, views: InitialView[]): void;
}) {
  const [starter, setStarter] = useState("empty");
  const selected = changed ? starter : "empty";
  return (
    <div>
      <label>
        Starter structure
        <select
          aria-label="Starter structure"
          value={selected}
          onChange={(event) => {
            if (changed && !window.confirm("Replace the entire model draft with this starter?"))
              return;
            setStarter(event.target.value);
            onChange(
              nativeDraft(
                event.target.value === "empty"
                  ? emptySchema
                  : projectTemplates[event.target.value].schema,
              ),
              structuredClone(projectTemplates[event.target.value]?.views ?? []),
            );
          }}
        >
          <option value="empty">Empty</option>
          {Object.entries(projectTemplates).map(([key, entry]) => (
            <option key={key} value={key}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      {selected === "engineering" && (
        <p>
          Includes measurable acceptance criteria, verification method and expected result, optional
          subsystem/build references, four editable structural coverage policies and three named
          Matrix views. Links identify planned work; results are recorded separately.
        </p>
      )}
    </div>
  );
}
