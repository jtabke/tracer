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

/** Guard evidence-dependent proposals independently of the native project head. */
export function expectEvidenceRevision(actual: number, expected: number) {
  ensure(
    Number.isSafeInteger(expected) && expected >= 0,
    "validation",
    "Expected evidence revision must be a nonnegative safe integer",
    { path: ["expectedEvidenceRevision"] },
  );
  ensure(
    actual === expected,
    "conflict",
    `Evidence changed since preparation (expected ${expected}, current ${actual}). Prepare again.`,
    { path: ["expectedEvidenceRevision"], expectedVersion: expected, actualVersion: actual },
  );
}
