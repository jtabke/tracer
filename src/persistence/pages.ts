import type { Page } from "../core/model.ts";

export function page<T>(items: T[], limit: number, cursor: (item: T) => string): Page<T> {
  const selected = items.slice(0, limit);
  return {
    items: selected,
    ...(items.length > limit ? { nextAfter: cursor(selected[selected.length - 1]) } : {}),
  };
}

/** Decode only the selected rows; SQL owners still choose ordering, filtering and limit+1. */
export function jsonPage<T>(
  rows: Record<string, unknown>[],
  limit: number,
  payload = "payload_json",
  cursor = "sequence",
): Page<T> {
  const result = page(rows, limit, (row) => String(row[cursor]));
  return { ...result, items: result.items.map((row) => JSON.parse(String(row[payload])) as T) };
}
