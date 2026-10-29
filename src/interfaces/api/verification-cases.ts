import type { Verification } from "../../application/verification.ts";
import { verificationTargetPolicies } from "../../core/verification-case.ts";
import { json } from "../../core/model.ts";
import { array, fields, integer, literal, optional, text, union } from "../decode.ts";
import { read, write } from "./definition.ts";
import { strictObject, receiptCommandInput, relationshipDeclaration } from "./input.ts";
import * as q from "./query.ts";
import {
  verificationCaseResponse,
  verificationExecutionResponse,
  openedVerificationResponse,
  recordedVerificationResponse,
} from "./verification-case-responses.ts";

export const verificationGuards = {
  commandId: text,
  expectedSchemaVersion: integer(1),
  expectedProjectRevision: integer(),
  expectedEvidenceRevision: integer(),
};
const pin = strictObject({ entityId: text, version: integer(1) });
export const verificationBasisInput = strictObject({
  model: strictObject({ entityId: text, version: integer(1), field: text }),
  requirement: pin,
  coverage: strictObject({ kind: literal("complete", "partial"), rationale: text }),
  criteria: array(
    strictObject({ id: text, field: text, start: integer(), end: integer(1), quote: text }),
  ),
  methods: array(
    strictObject({
      entityId: text,
      version: integer(1),
      relationship: strictObject({ id: text, version: integer(1) }),
      criterionIds: array(text),
    }),
  ),
});
const source = union(
  strictObject({ kind: literal("performed") }),
  strictObject({ kind: literal("prior_receipt"), receiptId: text, rationale: text }),
);
const caseQuery = { caseId: q.textParam, openingCommandId: q.textParam };
export const verificationReads = {
  "/api/verification-case": read({
    features: ["verification-cases"],
    query: q.query(caseQuery),
    response: verificationCaseResponse,
    handle: ({ tracer }, input) => {
      const verification: Verification = tracer.verification;
      return verification.get(input);
    },
  }),
  "/api/verification-case-locate": read({
    features: ["verification-cases"],
    query: q.query({ caseId: q.textParam }),
    response: (value: unknown, input) => {
      if (
        !value ||
        typeof value !== "object" ||
        !("opening" in value) ||
        !value.opening ||
        typeof value.opening !== "object" ||
        !("commandId" in value.opening) ||
        typeof value.opening.commandId !== "string"
      )
        throw Error("Missing verification opening");
      return verificationCaseResponse(value, {
        caseId: input.caseId,
        openingCommandId: value.opening.commandId,
      });
    },
    handle: ({ tracer }, input) => {
      const verification: Verification = tracer.verification;
      return verification.locate(input.caseId);
    },
  }),
  "/api/verification-execution": read({
    features: ["verification-executions"],
    query: q.query({ ...caseQuery, executionId: q.textParam }),
    response: verificationExecutionResponse,
    handle: ({ tracer }, input) => {
      const verification: Verification = tracer.verification;
      return verification.execution(
        { caseId: input.caseId, openingCommandId: input.openingCommandId },
        input.executionId,
      );
    },
  }),
};
export const verificationWrites = {
  "/api/verifications/open": write(
    {
      ...verificationGuards,
      caseId: text,
      membershipId: text,
      title: text,
      purpose: text,
      targetConfigurationId: optional(text),
      targetPolicy: optional(literal(...verificationTargetPolicies)),
      basis: verificationBasisInput,
      additionalFields: fields,
    },
    openedVerificationResponse,
    {
      features: [
        "verification-cases",
        "atomic-evaluation-commands",
        "evidence-revision-guards",
        "configuration-bound-verification",
        "contextual-input-correspondence",
      ],
    },
  )(({ tracer, provenance }, input) => {
    const verification: Verification = tracer.verification;
    return verification.open(input, provenance);
  }),
  "/api/verifications/execute": write(
    {
      ...verificationGuards,
      caseId: text,
      openingCommandId: text,
      expectedCaseVersion: integer(1),
      executionId: text,
      membershipId: text,
      title: text,
      methodId: text,
      source,
      conditions: (value: unknown) => {
        if (!json(value)) throw Error("Execution conditions must be JSON");
        return value;
      },
      results: array(
        strictObject({
          criterionId: text,
          outcome: literal("passed", "failed", "blocked", "not_run"),
          actual: text,
          rationale: text,
        }),
      ),
      inputs: receiptCommandInput.inputs,
      relationshipInputs: array(relationshipDeclaration),
      additionalFields: fields,
    },
    recordedVerificationResponse,
    {
      features: [
        "verification-executions",
        "reference-evaluation-inputs",
        "historical-content-inputs",
        "atomic-evaluation-commands",
        "evidence-revision-guards",
      ],
    },
  )(({ tracer, provenance }, input) => {
    const verification: Verification = tracer.verification;
    return verification.recordExecution(input, provenance);
  }),
};
