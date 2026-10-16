import { useState } from "react";
import type { Schema } from "../src/core/model.ts";
import { projectTemplates } from "../src/core/project-templates.ts";
import { emptySchema, nativeDraft } from "./schema-draft.ts";
export function SchemaStarter({
  changed,
  onChange,
}: {
  changed: boolean;
  onChange(schema: Schema): void;
}) {
  const [starter, setStarter] = useState("empty");
  return (
    <label>
      Starter structure
      <select
        aria-label="Starter structure"
        value={starter}
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
  );
}
