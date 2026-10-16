import type { Field, TypeDefinition } from "../src/core/model.ts";

export function SchemaFields({
  definition,
  onChange,
}: {
  definition: TypeDefinition;
  onChange(name: string, patch: Partial<Field>): void;
}) {
  return (
    <table className="schema-fields">
      <thead>
        <tr>
          <th scope="col">Field</th>
          <th scope="col">Type</th>
          <th scope="col">Required</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(definition.fields).map(([field, value]) => (
          <tr key={field}>
            <th scope="row">{field}</th>
            <td>
              <select
                aria-label={`Field type · ${field}`}
                value={value.type}
                onChange={(event) => onChange(field, { type: event.target.value as Field["type"] })}
              >
                {["string", "number", "boolean", "json"].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </td>
            <td>
              <input
                type="checkbox"
                aria-label={`Required · ${field}`}
                checked={value.required ?? false}
                onChange={(event) => onChange(field, { required: event.target.checked })}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
