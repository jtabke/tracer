import { ensure, json, knownProperties, record } from "./model.ts";
import type { AssessmentClosure, AssessmentScope } from "./change-assessment.ts";
import { assessmentText, parseCandidate } from "./assessment-disposition.ts";

function digest(value: unknown) {
  ensure(
    typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value),
    "validation",
    "Invalid closure basis digest",
  );
}
function positive(value: unknown) {
  ensure(
    Number.isSafeInteger(value) && Number(value) > 0,
    "validation",
    "Invalid closure native version",
  );
}
/** Structural proof checks are independent of current engineering applicability. */
export function parseAssessmentClosure(
  value: unknown,
  scope: AssessmentScope,
  commandId: string,
  openingCommandId: string,
): AssessmentClosure {
  ensure(record(value) && json(value), "validation", "Controlled closure certificate is missing");
  knownProperties(value, [
    "contract",
    "version",
    "commandId",
    "openingCommandId",
    "rationale",
    "at",
    "population",
    "judgments",
  ]);
  ensure(
    value.contract === "change_assessment_closure" && value.version === 1,
    "validation",
    "Unsupported controlled closure contract",
  );
  ensure(
    value.commandId === commandId && value.openingCommandId === openingCommandId,
    "conflict",
    "Closure belongs to another application command",
  );
  assessmentText(value.rationale);
  ensure(record(value.at), "validation", "Closure context is missing");
  knownProperties(value.at, ["projectRevision", "evidenceRevision"]);
  positive(value.at.projectRevision);
  ensure(
    Number.isSafeInteger(value.at.evidenceRevision) && Number(value.at.evidenceRevision) >= 0,
    "validation",
    "Invalid closure evidence watermark",
  );
  ensure(
    Array.isArray(value.population) && value.population.length === scope.candidates.length,
    "validation",
    "Closure population is incomplete",
  );
  const population = new Set<string>();
  for (const entry of value.population) {
    ensure(record(entry), "validation", "Invalid closed subject");
    knownProperties(entry, ["subject", "digest"]);
    const subject = parseCandidate(entry.subject),
      key = subject.kind + ":" + subject.id;
    digest(entry.digest);
    ensure(
      !population.has(key) &&
        scope.candidates.some((item) => item.kind === subject.kind && item.id === subject.id),
      "validation",
      "Closure population differs from declared scope",
    );
    population.add(key);
  }
  const registry = scope.dispositions ?? [];
  ensure(
    registry.length === scope.candidates.length &&
      Array.isArray(value.judgments) &&
      value.judgments.length === registry.length,
    "validation",
    "Closure lacks a judgment for every candidate",
  );
  const records = new Set<string>();
  for (const entry of value.judgments) {
    ensure(record(entry), "validation", "Invalid closed judgment");
    knownProperties(entry, ["id", "version", "membershipId", "membershipVersion", "digest"]);
    assessmentText(entry.id, 200);
    positive(entry.version);
    positive(entry.membershipVersion);
    digest(entry.digest);
    ensure(
      !records.has(entry.id) &&
        registry.some((item) => item.id === entry.id && item.membershipId === entry.membershipId),
      "validation",
      "Closed judgment differs from controlled membership",
    );
    records.add(entry.id);
  }
  return value as AssessmentClosure;
}
