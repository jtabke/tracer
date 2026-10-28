import type { Verification } from "../../application/verification.ts";
import { array, integer, literal, nullable, optional, text } from "../decode.ts";
import { strictObject } from "./input.ts";
import { read, write } from "./definition.ts";
import * as q from "./query.ts";
import { verificationGuards, verificationBasisInput } from "./verification-cases.ts";
import {
  verificationAnalysisResponse,
  verificationSelectedResponse,
  verificationConcludedResponse,
  verificationReopenedResponse,
  verificationRevisedResponse,
} from "./verification-lifecycle-responses.ts";

const mutation = {
  ...verificationGuards,
  caseId: text,
  openingCommandId: text,
  expectedCaseVersion: integer(1),
  expectedAnalysisDigest: text,
  reason: text,
};
const choice = strictObject({ criterionId: text, methodId: text, executionId: text });
const accounting = strictObject({
  executionId: text,
  decision: literal("selected", "historical", "superseded"),
  rationale: text,
  replacementId: optional(text),
});
const features = {
  features: ["verification-results", "atomic-evaluation-commands", "evidence-revision-guards"],
};
export const verificationLifecycleReads = {
  "/api/verification-analysis": read({
    features: ["verification-results"],
    query: q.query({ caseId: q.textParam, openingCommandId: q.textParam }),
    response: verificationAnalysisResponse,
    handle: ({ tracer }, input) => {
      const verification: Verification = tracer.verification;
      return verification.analyze(input);
    },
  }),
};
export const verificationLifecycleWrites = {
  "/api/verifications/select": write(
    { ...mutation, selections: array(choice), accounting: array(accounting) },
    verificationSelectedResponse,
    features,
  )(({ tracer, provenance }, input) => {
    const verification: Verification = tracer.verification;
    return verification.selectResults(input, provenance);
  }),
  "/api/verifications/conclude": write(
    mutation,
    verificationConcludedResponse,
    features,
  )(({ tracer, provenance }, input) => {
    const verification: Verification = tracer.verification;
    return verification.conclude(input, provenance);
  }),
  "/api/verifications/reopen": write(
    mutation,
    verificationReopenedResponse,
    features,
  )(({ tracer, provenance }, input) => {
    const verification: Verification = tracer.verification;
    return verification.reopen(input, provenance);
  }),
  "/api/verifications/revise": write(
    {
      ...mutation,
      basis: verificationBasisInput,
      mapping: array(strictObject({ fromId: text, toId: nullable(text) })),
    },
    verificationRevisedResponse,
    features,
  )(({ tracer, provenance }, input) => {
    const verification: Verification = tracer.verification;
    return verification.reviseBasis(input, provenance);
  }),
};
