import { observed, inputFact, receiptCandidateBasis } from "./assessment-receipt-facts.ts";
import { captureAssessmentFact } from "./assessment-fact-capture.ts";
import { pairCandidateBasis } from "./pair-assessment-facts.ts";
import type { PairAssessmentState } from "./pair-assessment-facts.ts";
import { ensure } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type {
  CandidateKey,
  CapturedBasis,
  AssessmentScope,
  SupportReference,
  ResolvedSupport,
} from "../core/change-assessment.ts";
import type { InputDeclaration, RelationshipDeclaration } from "../core/evidence.ts";
import type { Transaction } from "./ports/repository.ts";
import { pinEntity, pinRelationship } from "./native-pins.ts";
import { compareCapturedInputs, comparisonToken } from "./receipt-comparison.ts";

export { assessmentCandidateKey as candidateKey } from "../core/change-assessment.ts";
import { assessmentCandidateKey as candidateKey } from "../core/change-assessment.ts";
export { factDigest } from "./fact-digest.ts";
export { declaredFacts } from "./captured-facts.ts";

function fact(
  tx: Transaction,
  value: unknown,
  hasUnknown: boolean,
  inputs: InputDeclaration[],
  relationshipInputs: RelationshipDeclaration[],
  absences: CandidateKey[] = [],
) {
  return captureAssessmentFact(tx, { value, hasUnknown, inputs, relationshipInputs, absences });
}
export async function candidateBasis(
  tx: Transaction,
  scope: AssessmentScope,
  subject: CandidateKey,
  selected?: PairAssessmentState,
): Promise<CapturedBasis> {
  ensure(
    scope.candidates.some((value) => candidateKey(value) === candidateKey(subject)),
    "validation",
    "Candidate is outside the declared assessment population",
  );
  if (scope.version === 2) return pairCandidateBasis(tx, scope, subject, selected);
  if (subject.kind === "receipt") return receiptCandidateBasis(tx, scope, subject);
  const current = await tx.get(subject.kind, subject.id);
  if (subject.kind === "relationship")
    return fact(
      tx,
      { subject, current: current ?? null },
      false,
      [],
      current ? [{ id: current.id, revision: current.version }] : [],
      current ? [] : [subject],
    );
  return entityBasis(tx, subject);
}
async function entityBasis(tx: Transaction, subject: CandidateKey) {
  const entity = await tx.get("entity", subject.id);
  const external =
    entity && (entity.resource?.source ?? (await tx.getEvidence("external", subject.id)));
  const observation = external ? await tx.latestEvidence("observation", subject.id) : undefined;
  const inputs: InputDeclaration[] = entity
    ? [{ entityId: entity.id, facet: "native", revision: entity.version }]
    : [];
  if (entity && observation)
    inputs.push({ entityId: entity.id, facet: "content", observationId: observation.id });
  return fact(
    tx,
    { subject, entity: entity ?? null, ...(external ? { content: observed(observation) } : {}) },
    Boolean(external && observation?.availability !== "available"),
    inputs,
    [],
    entity ? [] : [subject],
  );
}
type SupportState = {
  selected: unknown;
  current: unknown;
  hasUnknown: boolean;
  inputs: InputDeclaration[];
  relationshipInputs: RelationshipDeclaration[];
  absences: CandidateKey[];
};
async function nativeSupport(
  tx: Transaction,
  reference: SupportReference & { version: number },
): Promise<SupportState> {
  const selected =
    reference.kind === "entity"
      ? (await pinEntity(tx, reference.id, reference.version, true)).entity
      : (await pinRelationship(tx, reference.id, reference.version)).relationship;
  const current = (await tx.get(reference.kind as "entity" | "relationship", reference.id)) ?? null;
  return {
    selected,
    current,
    hasUnknown: reference.mode === "current" && !current,
    inputs:
      reference.kind === "entity"
        ? [{ entityId: reference.id, facet: "native", revision: reference.version }]
        : [],
    relationshipInputs:
      reference.kind === "relationship" ? [{ id: reference.id, revision: reference.version }] : [],
    absences:
      reference.mode === "current" && !current
        ? [{ kind: reference.kind as "entity" | "relationship", id: reference.id }]
        : [],
  };
}
async function observationSupport(
  tx: Transaction,
  reference: SupportReference,
  requireCurrent: boolean,
): Promise<SupportState> {
  const observation = await tx.getEvidence("observation", reference.id);
  ensure(observation, "not_found", "Supporting observation is unavailable");
  const latest = await tx.latestEvidence("observation", observation.entityId);
  const selected = observed(observation),
    current = observed(latest);
  const entity = await tx.get("entity", observation.entityId);
  if (requireCurrent && reference.mode === "current")
    ensure(entity, "not_found", "Supporting current observed resource is unavailable");
  return {
    selected,
    current,
    hasUnknown:
      observation.availability !== "available" ||
      (reference.mode === "current" && (!entity || current.availability !== "available")),
    inputs: entity
      ? [observation, ...(reference.mode === "current" && latest ? [latest] : [])].map((value) => ({
          entityId: value.entityId,
          facet: "content" as const,
          observationId: value.id,
        }))
      : [],
    relationshipInputs: [],
    absences:
      reference.mode === "current" && !entity ? [{ kind: "entity", id: observation.entityId }] : [],
  };
}
async function receiptSupport(
  tx: Transaction,
  reference: SupportReference,
  requireCurrent: boolean,
): Promise<SupportState> {
  const receipt = await tx.getEvidence("receipt", reference.id);
  ensure(receipt, "not_found", "Supporting receipt is unavailable");
  const result: SupportState = {
    selected: { id: receipt.id },
    current: { id: receipt.id },
    hasUnknown: false,
    inputs: [{ entityId: receipt.output.id, facet: "native", revision: receipt.output.version }],
    relationshipInputs: [],
    absences: [],
  };
  if (reference.mode === "historical") return result;
  const compared = await compareCapturedInputs(tx, receipt),
    supersession = await tx.impactSupersession(receipt.id);
  if (requireCurrent)
    ensure(
      compared.state === "current" && supersession.count === 0,
      "conflict",
      "Supporting current receipt has changed, unknown or superseded inputs",
    );
  result.hasUnknown = compared.hasUnknown;
  const links = new Set(
    compared.inputs.flatMap((input) => input.recorded.links.map((link) => link.id)),
  );
  for (const input of compared.inputs) inputFact(input, true, links, result);
  for (const link of compared.relationshipInputs ?? [])
    if (link.current)
      result.relationshipInputs.push({ id: link.id, revision: link.current.version });
    else result.absences.push({ kind: "relationship", id: link.id });
  result.current = { comparison: comparisonToken(compared), supersession };
  return result;
}
export async function resolveSupport(
  tx: Transaction,
  reference: SupportReference,
  requireCurrent = false,
): Promise<ResolvedSupport> {
  ensure(
    reference.mode !== "configuration",
    "validation",
    "Configuration support requires its controlled assessment source",
  );
  const state =
    reference.kind === "entity" || reference.kind === "relationship"
      ? await nativeSupport(tx, reference)
      : reference.kind === "observation"
        ? await observationSupport(tx, reference, requireCurrent)
        : await receiptSupport(tx, reference, requireCurrent);
  if (requireCurrent && reference.mode === "current" && reference.kind !== "receipt")
    ensure(
      canonical(state.selected) === canonical(state.current) && !state.hasUnknown,
      "conflict",
      "Supporting current state differs from the selected state",
    );
  return {
    ...(await fact(
      tx,
      { reference, state: reference.mode === "current" ? state.current : state.selected },
      state.hasUnknown,
      state.inputs,
      state.relationshipInputs,
      state.absences,
    )),
    reference,
  };
}
