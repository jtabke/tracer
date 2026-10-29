import type { EvaluationCommand } from "../../application/evaluations.ts";
import type { EvaluationResult } from "../../core/evaluation-command.ts";
import { changesetResult, receipt } from "../api-models.ts";
import { array, nullable, number, object, optional, text } from "../decode.ts";
import { read, write } from "./definition.ts";
import { operation, receiptCommandInput, strictObject } from "./input.ts";
import * as q from "./query.ts";
const feature = ["atomic-evaluation-commands"];
const result = object({ commandId: text, native: nullable(changesetResult), receipt });
export function evaluation(
  value: unknown,
  input?: Pick<EvaluationCommand, "commandId">,
): EvaluationResult {
  const decoded = result(value);
  if (
    (input && decoded.commandId !== input.commandId) ||
    (decoded.native &&
      (decoded.native.changeset.schemaVersion !== decoded.receipt.schema.version ||
        decoded.native.changeset.actor !== decoded.receipt.actor ||
        decoded.native.changeset.reason !== decoded.receipt.reason))
  )
    throw new Error("Evaluation result does not match its command/capture");
  return decoded;
}
export const evaluationReads = {
  "/api/evaluation-outcome": read({
    features: feature,
    query: q.query({ commandId: q.textParam }),
    handle: ({ tracer }, input) => tracer.evaluations.getOutcome(input.commandId),
    response: (value, input) => (value === null ? null : evaluation(value, input)),
  }),
};
export const evaluationWrites = {
  "/api/evaluation-commands": write(
    {
      commandId: text,
      expectedSchemaVersion: number,
      expectedProjectRevision: optional(number),
      expectedEvidenceRevision: optional(number),
      operations: array(operation),
      receipt: strictObject(receiptCommandInput),
    },
    evaluation,
    {
      features: [
        ...feature,
        "evidence-revision-guards",
        "reference-evaluation-inputs",
        "historical-content-inputs",
      ],
    },
  )(({ tracer, provenance }, input) => tracer.evaluations.commit(input, provenance)),
};
