import {
  parseChangeAssessmentModel,
  applicationModelLimits,
} from "../../core/application-model.ts";
import type {
  ApplicationModelPin,
  ResolvedApplicationModel,
} from "../../core/application-model.ts";
import { record } from "../../core/model.ts";
import type { Field } from "../../core/model.ts";
import { array, boolean, integer, literal, nullable, object, optional, text } from "../decode.ts";
import { read } from "./definition.ts";
import * as q from "./query.ts";
const field = object({
  type: literal("string", "number", "boolean", "json"),
  required: optional(boolean),
});
function requiredFields(value: unknown): Record<string, Field> | null {
  if (value === null) return null;
  if (!record(value) || Object.keys(value).length > applicationModelLimits.extraRequiredFields)
    throw Error("Invalid required field metadata");
  for (const [name, metadata] of Object.entries(value)) {
    if (name.length > 200) throw Error("Invalid required field name");
    if (!field(metadata).required) throw Error("Field metadata must identify a required field");
  }
  return value as Record<string, Field>;
}
const pin = object({ entityId: text, version: integer(1), field: text });
const resolved = object({
  pin,
  definition: parseChangeAssessmentModel,
  source: object({
    id: text,
    type: text,
    version: integer(1),
    currentVersion: nullable(integer(1)),
  }),
  context: object({
    projectRevision: integer(),
    evidenceRevision: integer(),
    schemaVersion: integer(1),
  }),
  pinnedSchemaVersion: integer(1),
  compatibility: object({
    writable: boolean,
    issues: array(object({ path: array(text), message: text })),
  }),
  requiredFields: object({ assessment: requiredFields, disposition: requiredFields }),
});
export function applicationModelResponse(
  value: unknown,
  input: ApplicationModelPin,
): ResolvedApplicationModel {
  if (
    new TextEncoder().encode(JSON.stringify(value)).byteLength >
    applicationModelLimits.responseBytes
  )
    throw Error("Resolved application model exceeds 128 KiB");
  const result = resolved(value);
  if (
    result.compatibility.issues.length > 13 ||
    result.compatibility.issues.some((issue) => issue.path.length === 0 || issue.path.length > 3)
  )
    throw Error("Invalid compatibility issue scope");
  if (
    result.pin.entityId !== input.entityId ||
    result.pin.version !== input.version ||
    result.pin.field !== input.field ||
    result.source.id !== input.entityId ||
    result.source.version !== input.version ||
    (result.source.currentVersion !== null && result.source.currentVersion < input.version) ||
    result.pinnedSchemaVersion > result.context.schemaVersion ||
    result.compatibility.writable !== (result.compatibility.issues.length === 0)
  )
    throw Error("Application model response does not match its selection/context");
  if (
    result.compatibility.writable &&
    (result.requiredFields.assessment === null || result.requiredFields.disposition === null)
  )
    throw Error("Writable model needs complete required field metadata");
  return result;
}
export const applicationModelReads = {
  "/api/application-model": read({
    features: ["pinned-application-models"],
    query: q.query({ entityId: q.textParam, version: q.positive, field: q.textParam }),
    response: applicationModelResponse,
    handle: ({ tracer }, input) => tracer.applicationModels.resolve(input),
  }),
};
