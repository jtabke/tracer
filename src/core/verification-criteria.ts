import { ensure, json, knownProperties, record } from "./model.ts";
import { verificationLimits } from "./verification-model.ts";
import type { VerificationCriterion } from "./verification-basis.ts";

export function verificationText(value: unknown, maximum = 4000): asserts value is string {
  ensure(
    typeof value === "string" && value.length > 0 && value.length <= maximum && value.trim(),
    "validation",
    `Verification text must be nonblank and at most ${maximum} characters`,
  );
}
function criterion(value: unknown): asserts value is VerificationCriterion {
  ensure(record(value), "validation", "Criterion must be an object");
  knownProperties(value, ["id", "field", "start", "end", "quote"]);
  verificationText(value.id, 200);
  verificationText(value.field, 200);
  ensure(
    value.id.trim() === value.id && value.field.trim() === value.field,
    "validation",
    "Criterion identities and source fields cannot have surrounding whitespace",
  );
  verificationText(value.quote, verificationLimits.scopeBytes);
  ensure(
    Number.isSafeInteger(value.start) &&
      Number(value.start) >= 0 &&
      Number.isSafeInteger(value.end) &&
      Number(value.end) > Number(value.start),
    "validation",
    "Criterion needs a nonempty native text range",
  );
}

/** Validate exact UTF-16 ranges, disjointness and declared source coverage; never infer adequacy. */
export function validateVerificationCriteria(
  value: unknown,
  sources: Record<string, string>,
): { criteria: VerificationCriterion[]; sourceComplete: boolean } {
  ensure(
    json(value) &&
      Array.isArray(value) &&
      value.length > 0 &&
      value.length <= verificationLimits.criteria,
    "validation",
    "Select 1–25 criteria",
  );
  const ids = new Set<string>();
  const byField = new Map<string, VerificationCriterion[]>();
  for (const item of value) {
    criterion(item);
    ensure(!ids.has(item.id), "validation", "Criterion IDs must be unique within the basis");
    ids.add(item.id);
    ensure(
      Object.hasOwn(sources, item.field),
      "validation",
      "Criterion field is outside the configured acceptance sources",
    );
    const text = sources[item.field];
    ensure(
      item.end <= text.length && text.slice(item.start, item.end) === item.quote,
      "validation",
      "Criterion quote does not match the exact selected native range",
    );
    const ranges = byField.get(item.field) ?? [];
    ranges.push(item);
    byField.set(item.field, ranges);
  }
  let sourceComplete = true;
  for (const [field, text] of Object.entries(sources)) {
    const ranges = (byField.get(field) ?? []).sort((a, b) => a.start - b.start);
    let end = 0;
    for (const range of ranges) {
      ensure(range.start >= end, "validation", "Criterion ranges cannot overlap");
      if (text.slice(end, range.start).trim()) sourceComplete = false;
      end = range.end;
    }
    if (text.slice(end).trim()) sourceComplete = false;
  }
  return { criteria: value as VerificationCriterion[], sourceComplete };
}
