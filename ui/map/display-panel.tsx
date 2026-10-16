import { Choice } from "./controls.tsx";
import type { Display } from "./types.ts";

const controls: {
  field: keyof Display;
  label: string;
  name?: string;
  options: Record<string, string>;
}[] = [
  {
    field: "spacing",
    label: "Spacing",
    name: "Graph spacing",
    options: { comfortable: "Comfortable", compact: "Compact" },
  },
  {
    field: "traceEmphasis",
    label: "Trace emphasis",
    name: "Trace line emphasis",
    options: { context: "Path + next connections", path: "Path only", all: "All connections" },
  },
  {
    field: "links",
    label: "Draw connections",
    options: {
      all: "All in this scope",
      selection: "Selected item or branch",
      none: "Hide connections",
    },
  },
  {
    field: "labels",
    label: "Connection labels",
    options: { context: "Relevant labels", all: "All labels", none: "No labels" },
  },
];

export function DisplayPanel({
  display,
  pathDetail,
  onChange,
  onClose,
}: {
  display: Display;
  pathDetail: boolean;
  onChange(field: keyof Display, value: string): void;
  onClose(): void;
}) {
  return (
    <section className="floating-panel display" aria-label="Graph display">
      <div className="panel-heading">
        <strong>Display</strong>
        <button aria-label="Close display" onClick={onClose}>
          ×
        </button>
      </div>
      <p className="layout-help">
        Expanding keeps your place. Only overlapping branches move aside. Arrange reorganizes the
        whole view and closes gaps.
      </p>
      {controls
        .filter(({ field }) => field !== "traceEmphasis" || pathDetail)
        .map(({ field, label, name, options }) => (
          <Choice
            label={label}
            key={field}
            name={name ?? label}
            value={display[field] ?? Object.keys(options)[0]}
            onChange={(value) => onChange(field, value)}
            options={Object.entries(options)}
          />
        ))}
    </section>
  );
}
