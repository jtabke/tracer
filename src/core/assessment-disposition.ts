import { ensure, json, knownProperties, record } from "./model.ts";
import { canonical } from "./evidence.ts";
import { parseAssessmentPairContext } from "./assessment-pair-source.ts";
import type {
  AssessmentAction,
  SupportReference,
  CandidateKey,
  DispositionView,
} from "./change-assessment.ts";
export function assessmentText(value: unknown, limit = 4000): asserts value is string {
  ensure(
    typeof value === "string" && value.trim().length > 0 && value.length <= limit,
    "validation",
    "Provide bounded nonempty assessment text",
  );
}
export function parseCandidate(value: unknown): CandidateKey {
  ensure(record(value), "validation", "Select an assessment candidate");
  knownProperties(value, ["kind", "id"]);
  ensure(
    ["entity", "relationship", "receipt"].includes(String(value.kind)),
    "validation",
    "Invalid candidate kind",
  );
  assessmentText(value.id, 200);
  return value as CandidateKey;
}
export function parseSupport(value: unknown): SupportReference[] {
  ensure(
    Array.isArray(value) && value.length <= 10,
    "validation",
    "Declare at most ten supporting references per use",
  );
  for (const reference of value) {
    ensure(record(reference), "validation", "Invalid supporting reference");
    knownProperties(reference, [
      "kind",
      "id",
      "mode",
      ...(reference.mode === "configuration" ? ["configurationId"] : []),
      ...(["entity", "relationship"].includes(String(reference.kind)) ? ["version"] : []),
    ]);
    assessmentText(reference.id, 200);
    ensure(
      ["entity", "relationship", "receipt", "observation"].includes(String(reference.kind)) &&
        (["historical", "current"].includes(String(reference.mode)) ||
          (reference.kind === "receipt" && reference.mode === "configuration")),
      "validation",
      "Supporting references need a kind and explicit historical/current/configuration mode",
    );
    if (reference.mode === "configuration") assessmentText(reference.configurationId, 200);
    if (reference.kind === "entity" || reference.kind === "relationship")
      ensure(
        Number.isSafeInteger(reference.version) && Number(reference.version) > 0,
        "validation",
        "Native support requires an exact version",
      );
  }
  return value as SupportReference[];
}
export function parseActions(value: unknown): AssessmentAction[] {
  ensure(
    Array.isArray(value) && value.length <= 5,
    "validation",
    "Declare at most five local action obligations",
  );
  const seen = new Set<string>();
  for (const action of value) {
    ensure(record(action), "validation", "Invalid assessment action");
    knownProperties(action, ["id", "kind", "title", "state", "resolution", "support"]);
    assessmentText(action.id, 100);
    assessmentText(action.title, 200);
    ensure(
      !seen.has(action.id) &&
        ["revise", "reverify", "investigate"].includes(String(action.kind)) &&
        ["open", "done", "waived"].includes(String(action.state)),
      "validation",
      "Actions need distinct identities and recognized kind/state",
    );
    seen.add(action.id);
    ensure(
      typeof action.resolution === "string" && action.resolution.length <= 4000,
      "validation",
      "Invalid action resolution",
    );
    const support = parseSupport(action.support);
    if (action.state !== "open") {
      assessmentText(action.resolution);
      ensure(
        support.length > 0,
        "validation",
        "Resolved actions need explicit supporting information",
      );
    }
  }
  return value as AssessmentAction[];
}

function revision(value: unknown) {
  ensure(
    Number.isSafeInteger(value) && Number(value) > 0,
    "validation",
    "Invalid captured native version",
  );
}
function basisInput(input: unknown, version: unknown) {
  ensure(record(input), "validation", "Invalid captured entity use");
  knownProperties(input, [
    "entityId",
    "facet",
    "revision",
    "observationId",
    "fields",
    ...(version === 2 ? ["referenceId"] : []),
  ]);
  if (input.referenceId !== undefined) assessmentText(input.referenceId, 200);
  assessmentText(input.entityId, 200);
  if (input.facet === "native") revision(input.revision);
  else {
    ensure(input.facet === "content", "validation", "Explicit captured facet required");
    assessmentText(input.observationId, 200);
    if (version === 2 && input.revision !== undefined) revision(input.revision);
  }
  if (input.fields !== undefined) {
    ensure(
      Array.isArray(input.fields) && input.fields.length > 0,
      "validation",
      "Invalid field scope",
    );
    input.fields.forEach((name) => assessmentText(name, 200));
  }
}
function resolvedBasisReference(value: Record<string, unknown>) {
  const reference = parseSupport([value.reference])[0];
  if (reference.mode === "configuration") {
    ensure(value.version === 2, "validation", "Configuration support needs captured pair context");
    const context = parseAssessmentPairContext(value.context);
    ensure(
      reference.configurationId === context.query.afterId,
      "validation",
      "Supporting target differs from captured pair context",
    );
    ensure(
      ["applicable", "not_applicable", "unknown"].includes(String(value.applicability)),
      "validation",
      "Selected verification support needs explicit applicability",
    );
  } else
    ensure(
      value.applicability === undefined,
      "validation",
      "Legacy support cannot claim selected verification applicability",
    );
}
function basis(value: unknown, resolved = false) {
  ensure(record(value), "validation", "Invalid captured basis");
  knownProperties(value, [
    "contract",
    "version",
    "digest",
    "hasUnknown",
    "at",
    "inputs",
    "relationshipInputs",
    "absences",
    "context",
    ...(resolved ? ["reference", "applicability"] : []),
  ]);
  ensure(
    value.contract === "assessment_basis" && (value.version === 1 || value.version === 2),
    "validation",
    "Unsupported captured assessment basis",
  );
  if (value.version === 2) parseAssessmentPairContext(value.context);
  else
    ensure(
      value.context === undefined,
      "validation",
      "Legacy basis cannot claim selected pair context",
    );
  ensure(
    typeof value.digest === "string" &&
      /^sha256:[a-f0-9]{64}$/.test(value.digest) &&
      typeof value.hasUnknown === "boolean" &&
      record(value.at),
    "validation",
    "Invalid captured basis digest/context",
  );
  knownProperties(value.at, ["projectRevision", "evidenceRevision"]);
  ensure(
    Array.isArray(value.absences) && value.absences.length <= 80,
    "validation",
    "Invalid captured absence facts",
  );
  value.absences.forEach(parseCandidate);
  revision(value.at.projectRevision);
  ensure(
    Number.isSafeInteger(value.at.evidenceRevision) && Number(value.at.evidenceRevision) >= 0,
    "validation",
    "Invalid evidence watermark",
  );
  ensure(
    Array.isArray(value.inputs) &&
      Array.isArray(value.relationshipInputs) &&
      value.inputs.length + value.relationshipInputs.length + value.absences.length <= 80,
    "validation",
    "Captured basis exceeds 80 direct facts",
  );
  value.inputs.forEach((input) => basisInput(input, value.version));
  for (const link of value.relationshipInputs) {
    ensure(record(link), "validation", "Invalid captured relationship use");
    knownProperties(link, ["id", "revision"]);
    assessmentText(link.id, 200);
    revision(link.revision);
  }
  if (resolved) resolvedBasisReference(value);
}
function supporting(value: unknown) {
  ensure(Array.isArray(value) && value.length <= 10, "validation", "Invalid resolved support");
  value.forEach((item) => basis(item, true));
}
export function parseDispositionView(value: unknown): DispositionView {
  ensure(
    record(value) &&
      json(value) &&
      new TextEncoder().encode(JSON.stringify(value)).byteLength <= 65536,
    "validation",
    "Invalid or oversized disposition view",
  );
  knownProperties(value, [
    "id",
    "version",
    "membershipId",
    "title",
    "decision",
    "rationale",
    "actions",
    "data",
    "assessment",
  ]);
  ensure(record(value.assessment), "validation", "Disposition owner is missing");
  knownProperties(value.assessment, ["assessmentId", "openingCommandId"]);
  assessmentText(value.assessment.assessmentId, 200);
  assessmentText(value.assessment.openingCommandId, 200);
  assessmentText(value.id, 200);
  revision(value.version);
  assessmentText(value.membershipId, 200);
  assessmentText(value.title, 200);
  assessmentText(value.rationale);
  ensure(
    ["no_action", "revise", "reverify", "investigate", "acknowledge_unknown"].includes(
      String(value.decision),
    ),
    "validation",
    "Invalid disposition decision",
  );
  const actions = parseActions(value.actions),
    data = value.data;
  ensure(record(data), "validation", "Invalid disposition basis");
  knownProperties(data, ["subject", "basis", "support", "actionSupport"]);
  parseCandidate(data.subject);
  basis(data.basis);
  supporting(data.support);
  ensure(
    Array.isArray(data.actionSupport) && data.actionSupport.length === actions.length,
    "validation",
    "Action support does not cover action population",
  );
  const ids = new Set<string>();
  for (const entry of data.actionSupport) {
    ensure(record(entry), "validation", "Invalid action support");
    knownProperties(entry, ["id", "support"]);
    assessmentText(entry.id, 100);
    ensure(
      !ids.has(entry.id) && actions.some((action) => action.id === entry.id),
      "validation",
      "Invalid action support identity",
    );
    ids.add(entry.id);
    supporting(entry.support);
    const selected = (entry.support as import("./change-assessment.ts").ResolvedSupport[]).map(
      (item) => item.reference,
    );
    ensure(
      canonical(selected) === canonical(actions.find((action) => action.id === entry.id)!.support),
      "validation",
      "Action support does not match its captured references",
    );
  }
  ensure(
    (data.support as unknown[]).length +
      (data.actionSupport as { support: unknown[] }[]).reduce(
        (count, item) => count + item.support.length,
        0,
      ) <=
      20,
    "validation",
    "Disposition exceeds twenty supporting uses",
  );
  return value as DispositionView;
}
