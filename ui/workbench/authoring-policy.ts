import type { Schema } from "../../src/core/model.ts";
export function requiredField(
  schema: Schema,
  kind: "entityTypes" | "relationshipTypes",
  type: string,
  field: string,
) {
  return Boolean(schema[kind]?.[type]?.fields?.[field]?.required);
}
export function suggestedKey(records: Map<string, { key: string; type: string }>, type: string) {
  const sample = [...records.values()].find(
    (record) => record.type === type && /\d+$/.test(record.key),
  );
  const prefix =
    sample?.key.replace(/\d+$/, "") ??
    `${type
      .split("_")
      .map((word) => word[0])
      .join("")
      .toUpperCase()}-`;
  let next = 1;
  for (const record of records.values())
    if (record.key.startsWith(prefix) && /^\d+$/.test(record.key.slice(prefix.length))) {
      const value = Number(record.key.slice(prefix.length));
      if (Number.isSafeInteger(value) && value < Number.MAX_SAFE_INTEGER - 1)
        next = Math.max(next, value + 1);
    }
  return `${prefix}${String(next).padStart(2, "0")}`;
}
// Highlight literal text edits; this does not infer engineering field semantics.
export function changedText(before: unknown, after: unknown) {
  const a = String(before ?? ""),
    b = String(after ?? "");
  let start = 0,
    end = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  )
    end++;
  // Keep complete words/numbers around the edit, including units such as °C.
  while (start > 0 && /[\p{L}\p{N}]/u.test(a[start - 1]) && /[\p{L}\p{N}]/u.test(a[start] ?? ""))
    start--;
  while (
    end > 0 &&
    /[\p{L}\p{N}]/u.test(a[a.length - end - 1] ?? "") &&
    /[\p{L}\p{N}]/u.test(a[a.length - end] ?? "")
  )
    end--;
  return {
    before: {
      prefix: a.slice(0, start),
      change: a.slice(start, a.length - end),
      suffix: end ? a.slice(-end) : "",
    },
    after: {
      prefix: b.slice(0, start),
      change: b.slice(start, b.length - end),
      suffix: end ? b.slice(-end) : "",
    },
  };
}
