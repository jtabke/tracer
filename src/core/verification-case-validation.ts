import { ensure, json, knownProperties, record } from "./model.ts";
import { verificationText, validateVerificationCriteria } from "./verification-criteria.ts";
import { verificationCaseLimits } from "./verification-case.ts";
import type {
  VerificationCaseScope,
  VerificationExecutionData,
  VerificationExecutionRegistration,
  VerificationCriterionResult,
} from "./verification-case.ts";
import { canonical } from "./evidence.ts";

export function verificationObject(value: unknown, keys: string[]) {
  ensure(record(value) && json(value), "validation", "Verification needs a JSON object");
  knownProperties(value, keys);
  return value;
}
export function verificationVersion(value: unknown) {
  ensure(
    Number.isSafeInteger(value) && Number(value) > 0,
    "validation",
    "Select a positive verification version",
  );
}
export function verificationBytes(value: unknown, limit: number) {
  ensure(
    new TextEncoder().encode(JSON.stringify(value)).length <= limit,
    "validation",
    "Verification value exceeds its byte budget",
  );
}
export function verificationResults(
  value: unknown,
): asserts value is VerificationCriterionResult[] {
  ensure(
    json(value) && Array.isArray(value) && value.length > 0 && value.length <= 25,
    "validation",
    "Record 1–25 explicit criterion results",
  );
  const ids = new Set<string>();
  for (const item of value) {
    const result = verificationObject(item, ["criterionId", "outcome", "actual", "rationale"]);
    verificationText(result.criterionId, 200);
    verificationText(result.actual);
    verificationText(result.rationale);
    ensure(
      ["passed", "failed", "blocked", "not_run"].includes(String(result.outcome)),
      "validation",
      "Unknown verification outcome",
    );
    ensure(!ids.has(result.criterionId), "validation", "Criterion results must be unique");
    ids.add(result.criterionId);
  }
}
export function parseExecutionRegistry(value: unknown): VerificationExecutionRegistration[] {
  ensure(
    json(value) && Array.isArray(value) && value.length <= verificationCaseLimits.executions,
    "validation",
    "Verification registry exceeds 100 executions",
  );
  const used = new Set<string>();
  for (const item of value) {
    const registration = verificationObject(item, ["executionId", "membershipId", "commandId"]);
    for (const key of ["executionId", "membershipId", "commandId"]) {
      verificationText(registration[key], 200);
      const identity = key + ":" + registration[key];
      ensure(!used.has(identity), "validation", "Duplicate execution registry identity");
      used.add(identity);
    }
  }
  verificationBytes(value, verificationCaseLimits.scopeBytes);
  return value as VerificationExecutionRegistration[];
}
function basisMethods(value: unknown, requirementId: string, criterionIds: string[]) {
  ensure(
    Array.isArray(value) && value.length > 0 && value.length <= 10,
    "validation",
    "Invalid verification methods",
  );
  const methods = new Set<string>(),
    assigned = new Set<string>();
  let count = 0;
  for (const item of value) {
    const method = verificationObject(item, [
      "entityId",
      "version",
      "title",
      "procedure",
      "expected",
      "relationship",
      "criterionIds",
    ]);
    verificationText(method.entityId, 200);
    verificationVersion(method.version);
    for (const key of ["title", "procedure", "expected"]) verificationText(method[key], 65536);
    ensure(!methods.has(method.entityId), "validation", "Duplicate verification method identity");
    methods.add(method.entityId);
    ensure(
      Array.isArray(method.criterionIds) &&
        method.criterionIds.length > 0 &&
        method.criterionIds.every((id) => typeof id === "string" && criterionIds.includes(id)) &&
        new Set(method.criterionIds).size === method.criterionIds.length,
      "validation",
      "Invalid verification method assignments",
    );
    count += method.criterionIds.length;
    for (const id of method.criterionIds) assigned.add(String(id));
    ensure(
      record(method.relationship) &&
        method.relationship.source === requirementId &&
        method.relationship.target === method.entityId,
      "validation",
      "Verification method link has different endpoints",
    );
    verificationText(method.relationship.id, 200);
    verificationText(method.relationship.type, 200);
    verificationVersion(method.relationship.version);
  }
  ensure(count <= 100, "validation", "Verification assignment budget exceeded");
  return criterionIds.filter((id) => !assigned.has(id));
}
function basisShape(value: unknown) {
  const basis = verificationObject(value, [
    "contract",
    "version",
    "model",
    "at",
    "requirement",
    "coverage",
    "criteria",
    "methods",
  ]);
  ensure(
    basis.contract === "verification_basis" && basis.version === 1,
    "validation",
    "Unsupported verification basis",
  );
  const source = verificationObject(basis.requirement, [
    "entityId",
    "version",
    "title",
    "statement",
    "acceptance",
  ]);
  verificationText(source.entityId, 200);
  verificationVersion(source.version);
  verificationText(source.title, 65536);
  verificationText(source.statement, 65536);
  ensure(
    record(source.acceptance) &&
      Object.keys(source.acceptance).length > 0 &&
      Object.keys(source.acceptance).length <= 10,
    "validation",
    "Invalid verification acceptance sources",
  );
  for (const text of Object.values(source.acceptance)) verificationText(text, 65536);
  const { sourceComplete, criteria } = validateVerificationCriteria(
    basis.criteria,
    source.acceptance as Record<string, string>,
  );
  const coverage = verificationObject(basis.coverage, [
    "kind",
    "rationale",
    "sourceComplete",
    "unassignedCriterionIds",
  ]);
  verificationText(coverage.rationale);
  ensure(
    ["complete", "partial"].includes(String(coverage.kind)) &&
      coverage.sourceComplete === sourceComplete &&
      (coverage.kind !== "complete" || sourceComplete) &&
      Array.isArray(coverage.unassignedCriterionIds),
    "validation",
    "Invalid criterion source coverage",
  );
  const unassigned = basisMethods(
    basis.methods,
    source.entityId,
    criteria.map((x) => x.id),
  );
  ensure(
    canonical(unassigned) === canonical(coverage.unassignedCriterionIds),
    "validation",
    "Unassigned criterion accounting does not match its methods",
  );
  const pin = verificationObject(basis.model, ["entityId", "version", "field"]);
  verificationText(pin.entityId, 200);
  verificationText(pin.field, 200);
  verificationVersion(pin.version);
  const at = verificationObject(basis.at, ["projectRevision", "schemaVersion", "evidenceRevision"]);
  verificationVersion(at.schemaVersion);
  for (const key of ["projectRevision", "evidenceRevision"])
    ensure(
      Number.isSafeInteger(at[key]) && Number(at[key]) >= 0,
      "validation",
      "Invalid verification basis context",
    );
}
export function parseVerificationScope(value: unknown): VerificationCaseScope {
  const scope = verificationObject(value, [
    "contract",
    "version",
    "purpose",
    "basis",
    "membershipId",
    "control",
    "revisions",
    "reopened",
  ]);
  ensure(
    scope.contract === "verification_case_scope" && scope.version === 1,
    "validation",
    "Unsupported verification case scope",
  );
  verificationText(scope.purpose);
  verificationText(scope.membershipId, 200);
  const control = verificationObject(scope.control, ["commandId", "openingCommandId"]);
  verificationText(control.commandId, 200);
  verificationText(control.openingCommandId, 200);
  if (scope.revisions !== undefined) {
    ensure(
      Array.isArray(scope.revisions) && scope.revisions.length <= 25,
      "validation",
      "Verification basis revision history exceeds 25 entries",
    );
    for (const item of scope.revisions) {
      const revision = verificationObject(item, ["commandId", "caseVersion", "reason", "mapping"]);
      verificationText(revision.commandId, 200);
      verificationVersion(revision.caseVersion);
      verificationText(revision.reason);
      ensure(
        Array.isArray(revision.mapping) && revision.mapping.length <= 25,
        "validation",
        "Invalid criterion revision mapping",
      );
      for (const item of revision.mapping) {
        const entry = verificationObject(item, ["fromId", "toId"]);
        verificationText(entry.fromId, 200);
        if (entry.toId !== null) verificationText(entry.toId, 200);
      }
    }
  }
  if (scope.reopened !== undefined) {
    const reopened = verificationObject(scope.reopened, ["commandId", "reason"]);
    verificationText(reopened.commandId, 200);
    verificationText(reopened.reason);
  }
  basisShape(scope.basis);
  verificationBytes(scope, verificationCaseLimits.scopeBytes);
  return scope as VerificationCaseScope;
}
export function parseVerificationExecution(value: unknown): VerificationExecutionData {
  const data = verificationObject(value, [
    "contract",
    "version",
    "caseId",
    "openingCommandId",
    "commandId",
    "methodId",
    "methodVersion",
    "membershipId",
    "basisVersion",
    "source",
    "conditions",
    "results",
  ]);
  ensure(
    data.contract === "verification_execution" && data.version === 1,
    "validation",
    "Unsupported verification execution",
  );
  for (const key of ["caseId", "openingCommandId", "commandId", "methodId", "membershipId"])
    verificationText(data[key], 200);
  verificationVersion(data.methodVersion);
  verificationVersion(data.basisVersion);
  const source = verificationObject(data.source, [
    "kind",
    "receiptId",
    "rationale",
    "recordedAt",
    "actor",
  ]);
  if (source.kind === "prior_receipt") {
    verificationText(source.receiptId, 200);
    verificationText(source.rationale);
    verificationText(source.recordedAt, 200);
    verificationText(source.actor, 65536);
  } else
    ensure(
      source.kind === "performed" && Object.keys(source).length === 1,
      "validation",
      "Invalid execution source",
    );
  ensure(Object.hasOwn(data, "conditions"), "validation", "Record execution conditions explicitly");
  verificationBytes(data.conditions, 16384);
  verificationResults(data.results);
  verificationBytes(data, verificationCaseLimits.executionBytes);
  return data as VerificationExecutionData;
}
