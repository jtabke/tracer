import {
  parseVerificationModel,
  verificationLimits,
  verificationRoles,
} from "../../core/verification-model.ts";
import type { ResolvedVerificationModel } from "../../core/verification-model.ts";
import type { ApplicationModelPin } from "../../core/application-model.ts";
import type { Verification } from "../../application/verification.ts";
import { array, boolean, integer, nullable, object, text } from "../decode.ts";
import { modelRequiredFields } from "./application-models.ts";
import { read } from "./definition.ts";
import * as q from "./query.ts";

const resolved = object({
  pin: object({ entityId: text, version: integer(1), field: text }),
  definition: parseVerificationModel,
  source: object({
    id: text,
    type: text,
    version: integer(1),
    currentVersion: nullable(integer(1)),
  }),
  context: object({
    projectRevision: integer(1),
    schemaVersion: integer(1),
    evidenceRevision: integer(),
  }),
  pinnedSchemaVersion: integer(1),
  compatibility: object({
    writable: boolean,
    issues: array(object({ path: array(text), message: text })),
  }),
  requiredFields: object({
    requirement: modelRequiredFields,
    method: modelRequiredFields,
    case: modelRequiredFields,
    execution: modelRequiredFields,
  }),
});
function matchesSelection(result: ResolvedVerificationModel, selection: ApplicationModelPin) {
  return (
    result.pin.entityId === selection.entityId &&
    result.pin.version === selection.version &&
    result.pin.field === selection.field &&
    result.source.id === selection.entityId &&
    result.source.version === selection.version
  );
}
function validContext(result: ResolvedVerificationModel) {
  return (
    (result.source.currentVersion === null || result.source.currentVersion >= result.pin.version) &&
    result.pinnedSchemaVersion <= result.context.schemaVersion &&
    result.compatibility.issues.length <= 64 &&
    result.compatibility.issues.every((x) => x.path.length >= 1 && x.path.length <= 3) &&
    result.compatibility.writable === (result.compatibility.issues.length === 0)
  );
}
function verificationModelResponse(
  value: unknown,
  selection: ApplicationModelPin,
): ResolvedVerificationModel {
  if (
    new TextEncoder().encode(JSON.stringify(value)).length > verificationLimits.modelResponseBytes
  )
    throw Error("Resolved verification model exceeds 128 KiB");
  const result = resolved(value);
  if (!matchesSelection(result, selection) || !validContext(result))
    throw Error(
      "Verification model response does not match its selection or compatibility context",
    );
  if (
    result.compatibility.writable &&
    verificationRoles.some((role) => result.requiredFields[role] === null)
  )
    throw Error("Writable verification model requires complete field metadata");
  return result;
}
export const verificationModelReads = {
  "/api/verification-model": read({
    features: ["verification-models"],
    query: q.query({ entityId: q.textParam, version: q.positive, field: q.textParam }),
    response: verificationModelResponse,
    handle: ({ tracer }, input) => {
      const verification: Verification = tracer.verification;
      return verification.resolveModel(input);
    },
  }),
};
