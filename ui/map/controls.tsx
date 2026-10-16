type ChoiceOption<T extends string = string> = readonly [T, string];
type ChoiceProps<T extends string> = {
  label: string;
  name?: string;
  value: string;
  onChange(value: T): void;
  className?: string;
  options: readonly ChoiceOption<T>[];
  disabled?: boolean;
};
// Validate the DOM value against the declared choices before crossing the typed boundary.
export function Choice<T extends string>({
  label,
  name = label,
  value,
  onChange,
  className,
  options,
  disabled,
}: ChoiceProps<T>) {
  return (
    <label className={className}>
      {label}{" "}
      <select
        aria-label={name}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const choice = options.find(([value]) => value === event.target.value);
          if (choice) onChange(choice[0]);
        }}
      >
        {options.map(([value, caption]) => (
          <option key={value} value={value}>
            {caption}
          </option>
        ))}
      </select>
    </label>
  );
}
export const traceDirections = [
  ["both", "Both directions"],
  ["upstream", "Upstream"],
  ["downstream", "Downstream"],
] as const;
export const traceLevels = [
  ["0", "0 · Source items"],
  ["1", "1 · Direct connections"],
  ["2", "2 levels"],
  ["3", "3 levels"],
] as const;
export const groupDetails = [
  ["folders", "Folders"],
  ["items", "Items"],
] as const;
export const mapScopes: Record<string, string> = {
  requirements: "Requirements flow",
  development: "Full development",
  all: "All model types",
  custom: "Custom scope",
};
