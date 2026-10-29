import { validateSelectedComparison } from "./selected-comparison.ts";
import type { VerificationTargetSupport } from "../../core/verification-case.ts";
import { verificationTargetPolicies } from "../../core/verification-case.ts";
import { canonical } from "../../core/evidence.ts";
import { array, literal, nullable, object, text } from "../decode.ts";
import { comparedState, reviewQualification, reviewState } from "../api-models.ts";

const digest = (value: unknown) => {
  const result = text(value);
  if (!/^sha256:[0-9a-f]{64}$/.test(result)) throw Error("Invalid support fingerprint");
  return result;
};
const support = object({
  target: object({
    configurationId: text,
    digest,
    policy: literal(...verificationTargetPolicies),
  }),
  basisDigest: digest,
  layers: array(
    object({
      receiptId: text,
      nextSourceReceiptId: nullable(text),
      comparison: comparedState,
      token: digest,
      qualification: reviewQualification,
      review: reviewState,
    }),
  ),
});
function validateQualifiedReview(
  layer: VerificationTargetSupport["layers"][number],
  caseId: string,
) {
  for (const review of [layer.review.decision, layer.review.previous].filter(
    (x) => x !== undefined,
  )) {
    if (
      review.receiptId !== layer.receiptId ||
      canonical(review.qualification) !== canonical(layer.qualification)
    )
      throw Error("Qualified review context mismatch");
  }
  if (
    (layer.review.state === "unreviewed") !== !layer.review.decision ||
    (layer.review.decision &&
      (layer.review.decision.token !== layer.token ||
        layer.review.state !== layer.review.decision.decision))
  )
    throw Error("Qualified review decision mismatch");
  if (
    layer.qualification.ownerId !== caseId ||
    layer.qualification.contract !== "verification_target_support" ||
    layer.qualification.version !== 1
  )
    throw Error("Unsupported target support qualification");
}
export function verificationTargetSupportResponse(
  value: unknown,
  receiptId: string,
  sourceId: string | null,
  caseId: string,
): VerificationTargetSupport {
  const result = support(value),
    ids = new Set<string>();
  if (
    result.layers.length < 1 ||
    result.layers.length > 26 ||
    result.layers[0].receiptId !== receiptId ||
    result.layers[0].nextSourceReceiptId !== sourceId
  )
    throw Error("Invalid selected support population");
  for (let index = 0; index < result.layers.length; index++) {
    const layer = result.layers[index];
    if (
      ids.has(layer.receiptId) ||
      layer.comparison.receiptId !== layer.receiptId ||
      layer.nextSourceReceiptId !== (result.layers[index + 1]?.receiptId ?? null)
    )
      throw Error("Incomplete or repeated selected support source chain");
    ids.add(layer.receiptId);
    validateSelectedComparison(
      layer.comparison,
      result.target.policy === "target-reference-uses-v2",
    );
    validateQualifiedReview(layer, caseId);
  }
  return result;
}
