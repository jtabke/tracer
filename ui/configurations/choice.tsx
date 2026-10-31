import type { Configuration } from "../../src/core/configuration.ts";
export function ConfigurationChoice({
  title,
  value,
  items,
  onChange,
  disabled = false,
}: {
  title: string;
  value?: Pick<Configuration, "id" | "name">;
  items: Configuration[];
  onChange(value: Configuration | undefined): void;
  disabled?: boolean;
}) {
  return (
    <label>
      {title}
      <select
        aria-label={title}
        value={value?.id ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(items.find((x) => x.id === e.target.value))}
      >
        <option value="">Choose an exact capture</option>
        {value && !items.some((x) => x.id === value.id) && (
          <option value={value.id}>{value.name} · retained selection</option>
        )}
        {items.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name} · {x.members.length} members · {x.at}
          </option>
        ))}
      </select>
    </label>
  );
}
