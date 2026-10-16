import type { FlowRoute } from "./model-flow.ts";

export function FlowLabel({
  route,
  index,
  onSelect,
}: {
  route: FlowRoute;
  index: number;
  onSelect(name: string): void;
}) {
  const gap = route.target.x - route.source.x;
  const returning = gap <= 0;
  const long = gap > 420;
  const width = long || returning ? 178 : Math.min(124, Math.max(76, gap - 206));
  const lines = wrapLabel(route.label, Math.floor((width - 16) / 6));
  const x = returning ? route.source.x + 95 : (route.source.x + 190 + route.target.x) / 2;
  const y = returning
    ? Math.min(route.source.y, route.target.y) - 38 - (index % 4) * 6
    : long
      ? Math.max(route.source.y, route.target.y) + 110 + (index % 4) * 6
      : (route.source.y + route.target.y) / 2 + 18;
  const height = lines.length * 15 + 10;
  return (
    <g
      id={`model-route-${encodeURIComponent(route.key)}`}
      className="model-flow-label"
      role="button"
      tabIndex={0}
      aria-label={`Inspect workflow path · ${route.source.name} → ${route.label} → ${route.target.name}`}
      onClick={() => onSelect(route.name)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect(route.name);
      }}
    >
      <rect x={x - width / 2} y={y - height / 2} width={width} height={height} rx={4} />
      <text x={x} textAnchor="middle">
        {lines.map((line, position) => (
          <tspan key={position} x={x} y={y - (lines.length - 1) * 7.5 + position * 15 + 4}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
function wrapLabel(label: string, length: number) {
  const lines: string[] = [];
  for (const word of label.split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + word.length + 1 <= length)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}
