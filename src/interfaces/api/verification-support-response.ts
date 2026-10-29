import type { VerificationTargetSupport } from "../../core/verification-case.ts";
import { verificationTargetPolicies } from "../../core/verification-case.ts";
import type { ComparedState, InputComparison } from "../../core/evidence.ts";
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
function validateReferenceUse(input: InputComparison, policy: string) {
  const use = input.referenceUse;
  if (!use) return;
  if (policy !== "target-reference-uses-v2")
    throw Error("Reference-use state requires its explicit target policy");
  for (const entity of [input.current.entity, use.resourceDefault.entity])
    if (entity && entity.id !== input.entityId)
      throw Error("Reference-use resource identity mismatch");
  for (const observation of [input.current.observation, use.resourceDefault.observation])
    if (observation && observation.entityId !== input.entityId)
      throw Error("Reference-use observation identity mismatch");
  if (input.recorded.referenceId !== undefined && input.recorded.referenceId !== use.relationshipId)
    throw Error("Reference-use declaration mismatch");
  if (use.selection === "unavailable" && !input.hasUnknown)
    throw Error("Unavailable reference use cannot establish known applicability");
}
function validateComparison(value: ComparedState, policy: string) {
  for (const input of value.inputs) {
    validateReferenceUse(input, policy);
    if (
      input.entityId !== input.recorded.entityId ||
      input.current.links.length !== input.recorded.links.length
    )
      throw Error("Invalid selected support input correspondence");
  }
  const rows = [...value.inputs, ...(value.relationshipInputs ?? [])],
    unknown = rows.some((x) => x.hasUnknown),
    changed = rows.some((x) => x.hasChanged);
  if (
    value.hasUnknown !== unknown ||
    value.hasChanged !== changed ||
    value.state !== (unknown ? "unknown" : changed ? "changed" : "current")
  )
    throw Error("Contradictory selected support comparison");
}
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
    validateComparison(layer.comparison, result.target.policy);
    validateQualifiedReview(layer, caseId);
  }
  return result;
}
