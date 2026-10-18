import type { SchemaObject } from "../src/core/model.ts";
import { nextWorkDefaults, type NextWorkSelection } from "../src/core/next-work.ts";

export function NextWorkChoices({
  schema,
  selection,
  onChange,
  onReset,
}: {
  schema: SchemaObject | null;
  selection: NextWorkSelection;
  onChange(selection: NextWorkSelection): void;
  onReset(): void;
}) {
  const policies = Object.entries(schema?.coverageExpectations ?? {}).filter(
    ([, rule]) => rule.subject.type === selection.requirementType,
  );
  const fields = Object.entries(
    schema?.entityTypes[selection.requirementType]?.fields ?? {},
  ).filter(([, field]) => field.type === "string");
  return (
    <details className="next-work-choices">
      <summary>Queue definitions</summary>
      <p>
        Engineering policies supply the initial choices. Choose the types, text field and saved
        policies for another model. These choices stay in this tab.
      </p>
      <button onClick={onReset}>Use current model defaults</button>
      <div className="next-work-choice-grid">
        <label>
          Requirement type
          <select
            aria-label="Next work requirement type"
            value={selection.requirementType}
            onChange={(event) => onChange(nextWorkDefaults(schema, event.target.value))}
          >
            <option value="">Not configured</option>
            {Object.keys(schema?.entityTypes ?? {}).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Statement field
          <select
            aria-label="Next work statement field"
            value={selection.statementField}
            onChange={(event) => onChange({ ...selection, statementField: event.target.value })}
          >
            <option value="">Not configured</option>
            {fields.map(([name]) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["allocationExpectationId", "Allocation policy"],
            ["verificationExpectationId", "Verification plan policy"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <select
              aria-label={`Next work ${label.toLowerCase()}`}
              value={selection[key]}
              onChange={(event) => onChange({ ...selection, [key]: event.target.value })}
            >
              <option value="">Not configured</option>
              {policies.map(([id, policy]) => (
                <option key={id} value={id}>
                  {policy.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </details>
  );
}
