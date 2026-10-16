import { readable } from "./presentation-text.ts";

/** Authored type identities remain exact while their labels are readable. */
export function NativeTypeOptions({
  names,
  counts,
}: {
  names: string[];
  counts?: { type: string; count: number }[];
}) {
  const byType = counts && new Map(counts.map((item) => [item.type, item.count]));
  return names.map((name) => (
    <option key={name} value={name}>
      {readable(name)}
      {byType && ` (${byType.get(name) ?? 0})`}
    </option>
  ));
}
