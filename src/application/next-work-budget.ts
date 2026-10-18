import { ensure } from "../core/model.ts";

export function workByteBudget(mebibytes = 8) {
  let bytes = 0;
  return (value: unknown) => {
    bytes += new TextEncoder().encode(JSON.stringify(value)).length;
    ensure(
      bytes <= mebibytes * 1024 * 1024,
      "validation",
      `Next work exceeds its ${mebibytes} MiB data budget; no partial queues were returned. Use paged record, coverage and evidence queries for this project.`,
    );
  };
}
