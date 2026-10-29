import { ensure, json, knownProperties, record } from "./model.ts";
import { changeAssessmentLimits } from "./change-assessment.ts";
import type { AssessmentScope } from "./change-assessment.ts";
import { parseAssessmentPairQuery } from "./assessment-pair-source.ts";

function object(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  ensure(record(value), "validation", "Invalid assessment scope object");
  knownProperties(value, keys);
}
function text(value: unknown): asserts value is string {
  ensure(
    typeof value === "string" && value.length > 0 && value.length <= 200,
    "validation",
    "Invalid scope identity",
  );
}
function revision(value: unknown, minimum = 1) {
  ensure(
    Number.isSafeInteger(value) && Number(value) >= minimum,
    "validation",
    "Invalid scope revision",
  );
}
function list(value: unknown, limit: number): asserts value is unknown[] {
  ensure(Array.isArray(value) && value.length <= limit, "validation", "Invalid scope population");
}
function ids(value: unknown, limit: number): asserts value is string[] {
  list(value, limit);
  value.forEach(text);
}
function basis(value: unknown) {
  object(value, [
    "projectRevision",
    "evidenceRevision",
    "schemaVersion",
    "baselineRevision",
    "pair",
  ]);
  revision(value.projectRevision);
  revision(value.evidenceRevision, 0);
  revision(value.schemaVersion);
  if (value.pair !== undefined) {
    knownProperties(value, ["projectRevision", "evidenceRevision", "schemaVersion", "pair"]);
    object(value.pair, ["beforeId", "afterId", "policy", "beforeDigest", "afterDigest", "digest"]);
    text(value.pair.beforeId);
    text(value.pair.afterId);
    ensure(
      value.pair.policy === "exact-selected-state-v1" &&
        [value.pair.beforeDigest, value.pair.afterDigest, value.pair.digest].every(
          (x) => typeof x === "string" && /^sha256:[a-f0-9]{64}$/.test(x),
        ),
      "validation",
      "Invalid captured pair basis",
    );
    return;
  }
  revision(value.baselineRevision);
  ensure(
    Number(value.baselineRevision) <= Number(value.projectRevision),
    "validation",
    "Baseline cannot follow scope capture",
  );
}
function reachability(value: unknown) {
  object(value, ["paths", "expandedIds", "frontierIds"]);
  ids(value.expandedIds, 200);
  ids(value.frontierIds, 200);
  list(value.paths, 200);
  for (const path of value.paths) {
    object(path, ["entityId", "depth", "relationshipIds"]);
    text(path.entityId);
    revision(path.depth, 0);
    ids(path.relationshipIds, 6);
    ensure(path.depth === path.relationshipIds.length, "validation", "Scope path depth mismatch");
  }
}
function nativeCandidate(value: Record<string, unknown>) {
  knownProperties(value, ["kind", "id", "change", "beforeVersion", "version", "observationId"]);
  ensure(
    ["added", "removed", "modified", "unchanged"].includes(String(value.change)),
    "validation",
    "Invalid native change",
  );
  if (value.beforeVersion !== null) revision(value.beforeVersion);
  if (value.version !== null) revision(value.version);
  ensure(
    value.beforeVersion !== null || value.version !== null,
    "validation",
    "Native candidate has no captured state",
  );
  const before = value.beforeVersion,
    after = value.version;
  const expected =
    before === null
      ? "added"
      : after === null
        ? "removed"
        : before === after
          ? "unchanged"
          : "modified";
  ensure(value.change === expected, "validation", "Native change does not match its versions");
  if (value.observationId !== undefined && value.observationId !== null) text(value.observationId);
}
function linkVersions(value: unknown) {
  list(value, 100);
  for (const link of value) {
    object(link, ["id", "version"]);
    text(link.id);
    if (link.version !== null) revision(link.version);
  }
}
function receiptCandidate(value: Record<string, unknown>) {
  knownProperties(value, [
    "kind",
    "id",
    "contentIds",
    "scope",
    "supersession",
    "inputs",
    "relationshipInputs",
  ]);
  if (value.contentIds !== undefined) ids(value.contentIds, 100);
  const scope = value.scope;
  object(scope, ["inputIds", "relationshipIds", "hasChanged", "hasUnknown", "state"]);
  ids(scope.inputIds, 100);
  ids(scope.relationshipIds, 600);
  ensure(
    typeof scope.hasChanged === "boolean" &&
      typeof scope.hasUnknown === "boolean" &&
      scope.state === (scope.hasUnknown ? "unknown" : scope.hasChanged ? "changed" : "current"),
    "validation",
    "Invalid scoped comparison",
  );
  const supersession = value.supersession;
  object(supersession, ["count", "ids"]);
  revision(supersession.count, 0);
  ids(supersession.ids, 3);
  ensure(
    Number(supersession.count) >= (supersession.ids as unknown[]).length,
    "validation",
    "Invalid supersession count",
  );
  list(value.inputs, 100);
  linkVersions(value.relationshipInputs);
  ensure(
    value.inputs.length + (value.relationshipInputs as unknown[]).length <= 100,
    "validation",
    "Too many captured uses",
  );
  for (const input of value.inputs) {
    object(input, ["entityId", "version", "observationId", "links"]);
    text(input.entityId);
    if (input.version !== null) revision(input.version);
    if (input.observationId !== null) text(input.observationId);
    linkVersions(input.links);
  }
}
function metadata(value: Record<string, unknown>, keys: Set<string>) {
  if (value.control !== undefined) {
    object(value.control, ["commandId", "openingCommandId"]);
    text(value.control.commandId);
    text(value.control.openingCommandId);
  }
  if (value.refresh !== undefined) {
    object(value.refresh, ["reason", "previousAssessmentVersion"]);
    ensure(
      typeof value.refresh.reason === "string" &&
        value.refresh.reason.trim().length > 0 &&
        value.refresh.reason.length <= 4000,
      "validation",
      "Refresh needs rationale",
    );
    revision(value.refresh.previousAssessmentVersion);
  }
  if (value.retained === undefined) return;
  list(value.retained, changeAssessmentLimits.candidates);
  const seen = new Set<string>();
  for (const retained of value.retained) {
    object(retained, ["kind", "id", "basis"]);
    text(retained.id);
    basis(retained.basis);
    const key = String(retained.kind) + ":" + retained.id;
    ensure(keys.has(key) && !seen.has(key), "validation", "Invalid retained obligation");
    seen.add(key);
  }
}
function registrationMetadata(value: Record<string, unknown>, keys: Set<string>) {
  if (value.dispositions !== undefined) {
    list(value.dispositions, changeAssessmentLimits.candidates);
    const subjects = new Set<string>(),
      records = new Set<string>(),
      members = new Set<string>();
    for (const entry of value.dispositions) {
      object(entry, ["subject", "id", "membershipId", "commandId"]);
      object(entry.subject, ["kind", "id"]);
      text(entry.subject.id);
      text(entry.id);
      text(entry.membershipId);
      text(entry.commandId);
      const subject = String(entry.subject.kind) + ":" + entry.subject.id;
      ensure(
        keys.has(subject) &&
          !subjects.has(subject) &&
          !records.has(entry.id) &&
          !members.has(entry.membershipId),
        "validation",
        "Invalid disposition registry",
      );
      subjects.add(subject);
      records.add(entry.id);
      members.add(entry.membershipId);
    }
  }
  if (value.reopened !== undefined) {
    object(value.reopened, ["fromCommandId", "reason"]);
    text(value.reopened.fromCommandId);
    ensure(
      typeof value.reopened.reason === "string" &&
        value.reopened.reason.trim().length > 0 &&
        value.reopened.reason.length <= 4000,
      "validation",
      "Reopen needs rationale",
    );
  }
}
function scopeQuery(query: unknown, version: unknown) {
  object(
    query,
    version === 1
      ? ["baselineId", "rootId", "direction", "relationshipTypes", "depth"]
      : [
          "source",
          "beforeId",
          "afterId",
          "policy",
          "rootId",
          "direction",
          "relationshipTypes",
          "depth",
        ],
  );
  if (version === 1) text(query.baselineId);
  else {
    parseAssessmentPairQuery(query);
  }
  text(query.rootId);
  ids(query.relationshipTypes, 12);
  ensure(
    new Set(query.relationshipTypes as string[]).size ===
      (query.relationshipTypes as string[]).length,
    "validation",
    "Duplicate selected relationship types",
  );
  revision(query.depth);
  ensure(
    Number(query.depth) <= 6 && ["incoming", "outgoing", "both"].includes(String(query.direction)),
    "validation",
    "Invalid traversal scope",
  );
  return query;
}
function scopeDiscovery(discovery: unknown, version: unknown) {
  object(
    discovery,
    version === 1
      ? ["complete", "interpretation", "excludedReceiptOutputId", "before", "after"]
      : [
          "complete",
          "interpretation",
          "excludedReceiptOutputId",
          "before",
          "after",
          "comparability",
        ],
  );
  ensure(
    discovery.complete === true &&
      discovery.interpretation ===
        (version === 1 ? "selected_traversal" : "selected_configuration_pair"),
    "validation",
    "Incomplete assessment discovery",
  );
  if (version === 2) {
    object(discovery.comparability, ["state", "issues", "engineeringMeaning"]);
    ensure(
      ["exact", "qualified"].includes(String(discovery.comparability.state)) &&
        discovery.comparability.engineeringMeaning === "not_assessed",
      "validation",
      "Invalid selected pair comparability",
    );
    list(discovery.comparability.issues, 12);
    for (const issue of discovery.comparability.issues) {
      object(issue, ["code", "explanation"]);
      text(issue.code);
      ensure(
        typeof issue.explanation === "string" &&
          issue.explanation.length > 0 &&
          issue.explanation.length <= 4000,
        "validation",
        "Invalid pair comparability explanation",
      );
    }
  }
  text(discovery.excludedReceiptOutputId);
  reachability(discovery.before);
  reachability(discovery.after);
}
/** Validate stored and wire scope data without treating a JSON status as engineering proof. */
export function parseAssessmentScope(value: unknown): AssessmentScope {
  ensure(
    json(value) &&
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
        changeAssessmentLimits.scopeBytes,
    "validation",
    "Assessment scope exceeds 64 KiB or is not JSON",
  );
  object(value, [
    "contract",
    "version",
    "purpose",
    "query",
    "basis",
    "discovery",
    "candidates",
    "control",
    "retained",
    "refresh",
    "dispositions",
    "reopened",
  ]);
  ensure(
    value.contract === "change_assessment_scope" &&
      (value.version === 1 || value.version === 2) &&
      typeof value.purpose === "string" &&
      value.purpose.trim().length > 0 &&
      value.purpose.length <= 4000,
    "validation",
    "Invalid assessment scope contract",
  );
  const query = scopeQuery(value.query, value.version);
  basis(value.basis);
  ensure(record(value.basis), "validation", "Invalid assessment basis");
  ensure(
    value.version === 1
      ? value.basis.pair === undefined
      : record(value.basis.pair) &&
          value.basis.pair.beforeId === query.beforeId &&
          value.basis.pair.afterId === query.afterId,
    "validation",
    "Assessment source and captured basis differ",
  );
  scopeDiscovery(value.discovery, value.version);
  list(value.candidates, changeAssessmentLimits.candidates);
  const keys = new Set<string>();
  for (const candidate of value.candidates) {
    ensure(record(candidate), "validation", "Invalid scope candidate");
    text(candidate.id);
    const key = String(candidate.kind) + ":" + candidate.id;
    ensure(!keys.has(key), "validation", "Duplicate scope candidate");
    keys.add(key);
    if (candidate.kind === "receipt") receiptCandidate(candidate);
    else {
      ensure(
        candidate.kind === "entity" || candidate.kind === "relationship",
        "validation",
        "Invalid candidate kind",
      );
      nativeCandidate(candidate);
    }
  }
  ensure(keys.has("entity:" + query.rootId), "validation", "Scope omits its selected root");
  metadata(value, keys);
  registrationMetadata(value, keys);
  return value as AssessmentScope;
}
