/** Configurable field names are own keys, including constructor and __proto__. */
export function draftValue(values: Record<string, string>, name: string): string {
  return Object.hasOwn(values, name) ? (values[name] ?? "") : "";
}
