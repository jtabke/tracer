import { useState } from "react";
import type { InitialView } from "../src/core/presentation.ts";
import type { Schema } from "../src/core/model.ts";
import { projectTemplates } from "../src/core/project-templates.ts";
import { emptySchema, nativeDraft } from "./schema-draft.ts";

const choices = [
  {
    key: "engineering",
    title: "Engineering",
    description: "Connect intents, requirements, designs and tests.",
    note: "Acceptance criteria, coverage policies and three Matrix views.",
  },
  {
    key: "software",
    title: "Software",
    description: "Trace requirements through code, designs and tests.",
    note: "A starting structure for software development.",
  },
  {
    key: "empty",
    title: "Custom",
    description: "Build a model around your own way of working.",
    note: "Start empty and define your record types and connections.",
  },
];

export function SchemaStarter({
  changed,
  onChange,
}: {
  changed: boolean;
  onChange(schema: Schema, views: InitialView[]): void;
}) {
  const [selected, setSelected] = useState<string>();
  return (
    <section className="schema-starter" aria-label="Choose a starter">
      <h3>Choose a starting point</h3>
      <p>
        Starters are editable proposals, not fixed workflows. Nothing is saved until you use the
        model.
      </p>
      <div className="schema-starter-choices">
        {choices.map(({ key, title, description, note }) => (
          <button
            type="button"
            key={key}
            aria-pressed={selected === key}
            onClick={() => {
              if (selected === key) return;
              if (changed && !window.confirm("Replace the entire model draft with this starter?"))
                return;
              setSelected(key);
              onChange(
                nativeDraft(key === "empty" ? emptySchema : projectTemplates[key].schema),
                structuredClone(projectTemplates[key]?.views ?? []),
              );
            }}
          >
            <strong>{title}</strong>
            <span>{description}</span>
            <small>{note}</small>
            <span className="schema-starter-choice-action">
              {selected === key ? "Selected" : "Choose starter"} <span aria-hidden="true">→</span>
            </span>
          </button>
        ))}
      </div>
      {selected === "engineering" && (
        <p className="schema-starter-detail">
          Includes measurable acceptance criteria, verification method and expected result, optional
          subsystem/build references and four editable structural coverage policies. Links identify
          planned work; results are recorded separately.
        </p>
      )}
    </section>
  );
}
