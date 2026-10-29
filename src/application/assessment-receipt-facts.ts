import { ensure } from "../core/model.ts";
import type {
  AssessmentScope,
  CandidateKey,
  AssessmentPairContext,
  CapturedBasis,
} from "../core/change-assessment.ts";
import type { InputComparison, Observation } from "../core/evidence.ts";
import type { Transaction } from "./ports/repository.ts";
import type { EngineeringStateReader } from "./engineering-state.ts";
import { currentEngineeringState } from "./engineering-state.ts";
import { compareCapturedInputs, nativeState, scopedInputState } from "./receipt-comparison.ts";
import { captureAssessmentFact } from "./assessment-fact-capture.ts";

type Facts = Pick<CapturedBasis, "inputs" | "relationshipInputs" | "absences">;
export function observed(value: Observation | null | undefined) {
  return { availability: value?.availability ?? "unknown", hash: value?.hash ?? null };
}
function inputSource(input: InputComparison, facts: Facts, historical: boolean) {
  if (!input.current.entity) {
    facts.absences.push({ kind: "entity", id: input.entityId });
    return input.recorded.observation ? observed(input.current.observation) : null;
  }
  const association =
    historical && input.referenceUse && input.referenceUse.selection !== "unavailable"
      ? { referenceId: input.referenceUse.relationshipId }
      : {};
  if (input.recorded.observation) {
    if (input.current.observation)
      facts.inputs.push({
        entityId: input.entityId,
        facet: "content",
        observationId: input.current.observation.id,
        ...(historical ? { revision: input.current.entity.version } : {}),
        ...association,
      });
    return observed(input.current.observation);
  }
  facts.inputs.push({
    entityId: input.entityId,
    facet: "native",
    revision: input.current.entity.version,
    ...(input.recorded.fields ? { fields: input.recorded.fields } : {}),
    ...association,
  });
  return nativeState(input.current.entity, input.recorded.fields);
}
export function inputFact(
  input: InputComparison,
  content: boolean,
  links: Set<string>,
  facts: Facts,
  historical = false,
) {
  const source = content ? inputSource(input, facts, historical) : null;
  const path = input.recorded.links.flatMap((link, index) => {
    if (!links.has(link.id)) return [];
    const current = input.current.links[index] ?? null;
    if (current) facts.relationshipInputs.push({ id: current.id, revision: current.version });
    else facts.absences.push({ kind: "relationship", id: link.id });
    return [{ id: link.id, current }];
  });
  return {
    entityId: input.entityId,
    ...(historical && input.referenceUse
      ? {
          referenceUse: {
            relationshipId: input.referenceUse.relationshipId,
            selection: input.referenceUse.selection,
            passage: input.referenceUse.passage,
          },
        }
      : {}),
    ...(content ? { exists: input.current.entity !== null, source } : {}),
    path,
  };
}

export async function receiptCandidateBasis(
  tx: Transaction,
  scope: AssessmentScope,
  subject: CandidateKey,
  state: EngineeringStateReader = currentEngineeringState(tx),
  context?: AssessmentPairContext,
) {
  const candidate = scope.candidates.find(
    (value) => value.kind === "receipt" && value.id === subject.id,
  );
  ensure(
    candidate?.kind === "receipt",
    "validation",
    "Receipt is outside the declared assessment population",
  );
  const receipt = await tx.getEvidence("receipt", subject.id);
  ensure(receipt, "not_found", "Candidate receipt is unavailable");
  const comparison = await compareCapturedInputs(tx, receipt, state);
  const entities = new Set(
    candidate.contentIds ??
      scope.candidates.filter((value) => value.kind === "entity").map((value) => value.id),
  );
  const links = new Set(candidate.scope.relationshipIds),
    facts: Facts = { inputs: [], relationshipInputs: [], absences: [] };
  const matched = comparison.inputs.filter(
    (input) =>
      entities.has(input.entityId) || input.recorded.links.some((link) => links.has(link.id)),
  );
  const values = matched.map((input) =>
    inputFact(input, entities.has(input.entityId), links, facts, state.kind === "configuration"),
  );
  let unknown = matched.some(
    (input) => scopedInputState(input, entities.has(input.entityId), links, state.kind).hasUnknown,
  );
  if (state.kind === "configuration")
    for (const input of matched) {
      if (
        !entities.has(input.entityId) ||
        !input.current.entity ||
        !input.referenceUse ||
        input.referenceUse.selection === "unavailable"
      )
        continue;
      const link = await state.getRelationship(input.referenceUse.relationshipId);
      ensure(link, "storage", "Selected reference qualification is unavailable");
      facts.relationshipInputs.push({ id: link.id, revision: link.version });
    }
  const direct = (comparison.relationshipInputs ?? [])
    .filter((link) => links.has(link.id))
    .map((link) => {
      if (link.current)
        facts.relationshipInputs.push({ id: link.id, revision: link.current.version });
      else facts.absences.push({ kind: "relationship", id: link.id });
      unknown ||= link.hasUnknown;
      return { id: link.id, current: link.current };
    });
  return captureAssessmentFact(tx, {
    value: { subject, values, direct, supersession: await tx.impactSupersession(subject.id) },
    hasUnknown: Boolean(unknown),
    ...facts,
    context,
  });
}
