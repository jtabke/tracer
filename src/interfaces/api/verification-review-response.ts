import type { ReviewVerificationSupport } from "../../core/verification-lifecycle.ts";
import { verificationCaseLimits } from "../../core/verification-case.ts";
import {
  verificationBytes,
  parseVerificationScope,
} from "../../core/verification-case-validation.ts";
import { evaluation } from "./evaluations.ts";
import { matches, resultModel } from "./verification-case-responses.ts";

export function verificationSupportReviewedResponse(
  value: unknown,
  input?: ReviewVerificationSupport,
) {
  verificationBytes(value, verificationCaseLimits.responseBytes);
  const result = evaluation(value, input),
    { definition } = resultModel(result);
  if (result.native !== null) throw Error("Support review cannot mutate native case control");
  matches(result.receipt.output, { type: definition.case.type }, "Review case type");
  const scope = parseVerificationScope(result.receipt.output.fields[definition.case.fields.basis]);
  if (!scope.target) throw Error("Support review requires a captured target");
  if (input) {
    matches(
      result.receipt.output,
      { id: input.caseId, version: input.expectedCaseVersion },
      "Review case identity",
    );
    matches(scope.control, { openingCommandId: input.openingCommandId }, "Review opening context");
    if (
      !result.receipt.inputs.some((x) => x.entityId === input.executionId && x.facet === "native")
    )
      throw Error("Missing captured reviewed execution");
  }
  return result;
}
