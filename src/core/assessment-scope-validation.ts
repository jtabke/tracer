import { ensure, json, knownProperties, record } from "./model.ts";
import { changeAssessmentLimits } from "./change-assessment.ts";
import type { AssessmentScope } from "./change-assessment.ts";

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
  object(value, ["projectRevision", "evidenceRevision", "schemaVersion", "baselineRevision"]);
  revision(value.projectRevision);
  revision(value.evidenceRevision, 0);
  revision(value.schemaVersion);
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
  knownProperties(value, ["kind", "id", "scope", "supersession", "inputs", "relationshipInputs"]);
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
  ]);
  ensure(
    value.contract === "change_assessment_scope" &&
      value.version === 1 &&
      typeof value.purpose === "string" &&
      value.purpose.trim().length > 0 &&
      value.purpose.length <= 4000,
    "validation",
    "Invalid assessment scope contract",
  );
  const query = value.query;
  object(query, ["baselineId", "rootId", "direction", "relationshipTypes", "depth"]);
  text(query.baselineId);
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
  basis(value.basis);
  const discovery = value.discovery;
  object(discovery, ["complete", "interpretation", "excludedReceiptOutputId", "before", "after"]);
  ensure(
    discovery.complete === true && discovery.interpretation === "selected_traversal",
    "validation",
    "Incomplete assessment discovery",
  );
  text(discovery.excludedReceiptOutputId);
  reachability(discovery.before);
  reachability(discovery.after);
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
  return value as AssessmentScope;
}
