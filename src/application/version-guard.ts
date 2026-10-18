import { ensure } from "../core/model.ts";
import type { ErrorDetails } from "../core/model.ts";

export function expectVersion(
  actual: number,
  expected: number,
  schema = false,
  subject: Pick<ErrorDetails, "kind" | "id"> = {},
) {
  ensure(
    Number.isSafeInteger(expected) && expected >= 0 && actual === expected,
    schema ? "schema_conflict" : "conflict",
    `Expected ${schema ? "schema " : ""}version ${expected}, current version ${actual}`,
    {
      ...subject,
      ...(Number.isFinite(expected) ? { expectedVersion: expected } : {}),
      actualVersion: actual,
    },
  );
}

export function expectProjectRevision(actual: number, expected: number) {
  ensure(
    Number.isSafeInteger(expected) && expected >= 0,
    "validation",
    "Expected project revision must be a nonnegative integer",
  );
  ensure(
    actual === expected,
    "conflict",
    `Project changed since preview (expected r${expected}, current r${actual}). Create a new preview.`,
    { path: ["expectedProjectRevision"], expectedVersion: expected, actualVersion: actual },
  );
}
