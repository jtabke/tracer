import { ensure, knownProperties, record } from "./model.ts";
import type { AssessmentPairQuery, AssessmentPairContext } from "./change-assessment.ts";

export function parseAssessmentPairQuery(value: unknown): AssessmentPairQuery {
  ensure(record(value), "validation", "Select a pair assessment source");
  knownProperties(value, [
    "source",
    "beforeId",
    "afterId",
    "policy",
    "rootId",
    "direction",
    "relationshipTypes",
    "depth",
  ]);
  ensure(
    value.source === "configuration_pair" && value.policy === "scoped-reference-dependencies-v1",
    "validation",
    "Unsupported pair assessment source/policy",
  );
  for (const id of [value.beforeId, value.afterId, value.rootId])
    ensure(
      typeof id === "string" && id.trim().length > 0 && id.length <= 200,
      "validation",
      "Select bounded pair/source identities",
    );
  ensure(
    ["incoming", "outgoing", "both"].includes(String(value.direction)),
    "validation",
    "Invalid pair investigation direction",
  );
  ensure(
    Array.isArray(value.relationshipTypes) &&
      value.relationshipTypes.length <= 12 &&
      new Set(value.relationshipTypes).size === value.relationshipTypes.length,
    "validation",
    "Invalid pair relationship selection",
  );
  for (const type of value.relationshipTypes)
    ensure(
      typeof type === "string" && type.length > 0 && type.length <= 200,
      "validation",
      "Invalid pair relationship type",
    );
  ensure(
    value.depth === undefined ||
      (Number.isSafeInteger(value.depth) && Number(value.depth) >= 1 && Number(value.depth) <= 6),
    "validation",
    "Invalid pair investigation depth",
  );
  return value as AssessmentPairQuery;
}
export function parseAssessmentPairContext(value: unknown): AssessmentPairContext {
  ensure(record(value), "validation", "Missing captured pair context");
  knownProperties(value, ["query", "pairDigest"]);
  const query = parseAssessmentPairQuery(value.query);
  ensure(
    query.depth !== undefined &&
      typeof value.pairDigest === "string" &&
      /^sha256:[a-f0-9]{64}$/.test(value.pairDigest),
    "validation",
    "Invalid captured pair context",
  );
  return value as AssessmentPairContext;
}
