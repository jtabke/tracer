import { ensure, json, knownProperties, record } from "./model.ts";
import { canonical } from "./evidence.ts";
import type { Configuration, ExactConfigurationInput } from "./configuration.ts";

const configurationCaptureLimits = {
  inputBytes: 131072,
  resultBytes: 2097152,
  content: 100,
};
function text(value: unknown, maximum = 200) {
  ensure(
    typeof value === "string" && !!value.trim() && value.length <= maximum,
    "validation",
    "Configuration needs bounded nonempty text",
  );
}
function integer(value: unknown, minimum = 0) {
  ensure(
    Number.isSafeInteger(value) && Number(value) >= minimum,
    "validation",
    "Configuration needs an exact nonnegative revision",
  );
}
function configurationCaptureBytes(value: unknown, maximum: number) {
  ensure(
    new TextEncoder().encode(JSON.stringify(value)).byteLength <= maximum,
    "validation",
    "Configuration capture exceeds its byte budget; narrow the declared scope",
  );
}
export function validateExactConfiguration(input: ExactConfigurationInput) {
  ensure(record(input) && json(input), "validation", "Invalid exact configuration capture");
  knownProperties(input, [
    "id",
    "name",
    "subjectId",
    "expectedSubjectVersion",
    "members",
    "relationships",
    "content",
    "scope",
    "expectedSchemaVersion",
    "expectedProjectRevision",
    "expectedEvidenceRevision",
  ]);
  text(input.id);
  text(input.name, 80);
  text(input.subjectId);
  integer(input.expectedSubjectVersion, 1);
  integer(input.expectedSchemaVersion, 1);
  integer(input.expectedProjectRevision);
  integer(input.expectedEvidenceRevision);
  ensure(
    Array.isArray(input.members) && input.members.length > 0 && input.members.length <= 100,
    "validation",
    "Configuration needs 1–100 native members",
  );
  ensure(
    Array.isArray(input.relationships) && input.relationships.length <= 200,
    "validation",
    "Exact configuration needs at most 200 explicit relationships",
  );
  validateNativeSelections(input);
  ensure(record(input.scope), "validation", "Declare configuration scope");
  knownProperties(input.scope, ["purpose", "coverage", "rationale"]);
  text(input.scope.purpose, 4000);
  text(input.scope.rationale, 4000);
  ensure(
    ["complete", "partial"].includes(input.scope.coverage),
    "validation",
    "Declare complete or partial configuration scope",
  );
  validateContentSelections(input);
  configurationCaptureBytes(input, configurationCaptureLimits.inputBytes);
}
function validateNativeSelections(input: ExactConfigurationInput) {
  const members = new Set<string>(),
    links = new Set<string>();
  for (const member of input.members) {
    ensure(record(member), "validation", "Invalid configuration member");
    knownProperties(member, ["entityId", "version"]);
    text(member.entityId);
    integer(member.version, 1);
    ensure(!members.has(member.entityId), "validation", "Declare each configuration member once");
    members.add(member.entityId);
  }
  for (const link of input.relationships) {
    ensure(record(link), "validation", "Invalid configuration relationship");
    knownProperties(link, ["relationshipId", "version"]);
    text(link.relationshipId);
    integer(link.version, 1);
    ensure(
      !links.has(link.relationshipId),
      "validation",
      "Declare each configuration relationship once",
    );
    links.add(link.relationshipId);
  }
}
function validateContentSelections(input: ExactConfigurationInput) {
  ensure(
    Array.isArray(input.content) && input.content.length <= configurationCaptureLimits.content,
    "validation",
    "Declare at most 100 content selections",
  );
  const seen = new Set<string>();
  for (const selection of input.content) {
    ensure(record(selection), "validation", "Invalid configuration content selection");
    knownProperties(selection, ["entityId", "observationId", "reason"]);
    text(selection.entityId);
    ensure(
      input.members.some((member) => member.entityId === selection.entityId),
      "validation",
      "Content must belong to a selected native member",
    );
    ensure(
      !seen.has(selection.entityId),
      "validation",
      "Declare content once per configuration member",
    );
    seen.add(selection.entityId);
    if (selection.observationId !== null) text(selection.observationId);
    if (selection.observationId === null || selection.reason !== undefined)
      text(selection.reason, 4000);
  }
}
/** Correlate the immutable capture with the exact pins, rather than trusting authored metadata. */
export function validateConfigurationCapture(value: Configuration) {
  const capture = value.capture;
  if (!capture) return;
  ensure(
    capture.contract === "configuration_capture" && capture.version === 1,
    "validation",
    "Unsupported configuration capture",
  );
  validateExactConfiguration(capture.intent);
  const input = capture.intent;
  ensure(
    value.id === input.id &&
      value.name === input.name.trim() &&
      value.subject.id === input.subjectId &&
      value.subject.version === input.expectedSubjectVersion,
    "validation",
    "Configuration identity does not match original capture",
  );
  ensure(
    capture.context.schema.version === input.expectedSchemaVersion &&
      capture.context.projectRevision === input.expectedProjectRevision &&
      capture.context.evidenceRevision === input.expectedEvidenceRevision,
    "validation",
    "Configuration clocks do not match original capture",
  );
  ensure(
    canonical(value.members.map((p) => ({ entityId: p.entity.id, version: p.entity.version }))) ===
      canonical(input.members),
    "validation",
    "Configuration members do not match original selection",
  );
  ensure(
    canonical(
      value.relationships?.map((p) => ({
        relationshipId: p.relationship.id,
        version: p.relationship.version,
      })),
    ) === canonical(input.relationships),
    "validation",
    "Configuration topology does not match original selection",
  );
  ensure(
    capture.content.length === input.content.length,
    "validation",
    "Configuration content selection is incomplete",
  );
  for (const [i, state] of capture.content.entries()) {
    const selected = input.content[i]!;
    ensure(
      state.entityId === selected.entityId &&
        state.reason === selected.reason &&
        (state.observation?.id ?? null) === selected.observationId &&
        (!state.observation || state.observation.entityId === state.entityId),
      "validation",
      "Configuration content does not match original selection",
    );
  }
  const members = new Set(value.members.map((pin) => pin.entity.id));
  ensure(
    value.relationships!.every(
      (pin) => members.has(pin.relationship.source) && members.has(pin.relationship.target),
    ),
    "validation",
    "Configuration topology endpoints are outside selected membership",
  );
  configurationCaptureBytes(value, configurationCaptureLimits.resultBytes);
}
