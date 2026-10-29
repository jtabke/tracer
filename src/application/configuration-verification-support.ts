import { ensure } from "../core/model.ts";
import type { AssessmentScope, SupportReference, CandidateKey } from "../core/change-assessment.ts";
import type { Transaction } from "./ports/repository.ts";
import { analyzeVerificationConclusion } from "./verification-analysis.ts";
import { verificationConclusionContext } from "./verification-context.ts";
import { verificationConclusionContinuation } from "./verification-conclusion-applicability.ts";
import { verificationReceiptOrigin } from "./verification-receipt-origin.ts";
import { captureAssessmentFact } from "./assessment-fact-capture.ts";
import { verificationWorkBudget } from "./verification-support.ts";
import { factDigest } from "./fact-digest.ts";
import type { InputDeclaration, CapturedInput, Observation } from "../core/evidence.ts";

type PairScope = Extract<AssessmentScope, { version: 2 }>;
type Reference = Extract<SupportReference, { mode: "configuration" }>;
export async function configurationVerificationSupport(
  tx: Transaction,
  scope: PairScope,
  reference: Reference,
  work: ReturnType<typeof verificationWorkBudget>,
) {
  ensure(
    reference.configurationId === scope.query.afterId,
    "validation",
    "Verification support must name the assessment's exact after configuration",
  );
  const result = await analyzeVerificationConclusion(tx, reference.id, work),
    view = result.analysis.view;
  ensure(
    view.scope.target?.configurationId === reference.configurationId &&
      view.scope.target.digest === scope.basis.pair.afterDigest,
    "validation",
    "Controlled verification conclusion targets another configuration",
  );
  const control = await verificationConclusionContinuation(tx, result, work),
    supersession = await tx.impactSupersession(reference.id);
  const applicable =
    result.analysis.completion.state === "verified" &&
    control.applicable &&
    supersession.count === 0;
  const selected = new Set(result.analysis.recordedSelection!.selections.map((x) => x.executionId));
  const entries = result.entries.filter((x) => selected.has(x.summary.id));
  const model = view.model.definition;
  const inputs = [
    {
      entityId: view.case.id,
      facet: "native" as const,
      revision: view.case.version,
      fields: [
        model.case.fields.state,
        model.case.fields.model,
        model.case.fields.basis,
        model.case.fields.executions,
        model.case.fields.selection,
        model.case.fields.conclusion,
      ],
    },
    {
      entityId: view.model.pin.entityId,
      facet: "native" as const,
      revision: view.model.pin.version,
      fields: [view.model.pin.field],
    },
    ...result.governing.inputs,
    ...entries.flatMap((x) => x.inputs),
  ];
  const relationshipInputs = [
    ...result.governing.relationships,
    ...entries.flatMap((x) => x.relationships),
  ];
  const context = { query: scope.query, pairDigest: scope.basis.pair.digest };
  const captured = await captureAssessmentFact(tx, {
    value: {
      reference,
      conclusionDigest: await factDigest((await tx.getEvidence("receipt", reference.id))!),
      target: view.scope.target,
      basisDigest: result.analysis.basis.digest,
      evidenceDigest: result.analysis.selection.evidenceDigest,
      applicable,
      supersession,
    },
    hasUnknown:
      control.unknown ||
      result.analysis.basis.state === "unknown" ||
      result.analysis.obligations.some((x) => x.applicability === "unknown"),
    inputs,
    relationshipInputs,
    absences: entries.flatMap((x) => x.absences),
    context,
  });
  ensure(
    result.engineeringState.kind === "configuration",
    "storage",
    "Target verification source is not a selected configuration",
  );
  const configuration = result.engineeringState.configuration;
  const targetContent = new Map<string, Observation | null>(
    configuration.members.filter((x) => x.entity.resource?.source).map((x) => [x.entity.id, null]),
  );
  for (const content of configuration.capture!.content)
    targetContent.set(content.entityId, content.observation);
  return {
    support: {
      ...captured,
      reference,
      applicability: captured.hasUnknown
        ? ("unknown" as const)
        : applicable
          ? ("applicable" as const)
          : ("not_applicable" as const),
    },
    applicable,
    requirementId: view.scope.basis.requirement.entityId,
    entityIds: new Set([
      view.model.pin.entityId,
      ...[...result.governing.inputs, ...entries.flatMap((x) => x.inputs)].map((x) => x.entityId),
    ]),
    relationshipIds: new Set(relationshipInputs.map((x) => x.id)),
    targetEntities: new Set(result.engineeringState.configuration.members.map((x) => x.entity.id)),
    targetVersions: new Map(configuration.members.map((x) => [x.entity.id, x.entity.version])),
    targetRelationships: new Set(
      result.engineeringState.configuration.relationships!.map((x) => x.relationship.id),
    ),
    targetContent,
    contentSelections: new Set(
      entries
        .flatMap((x) => x.inputs)
        .filter((x) => x.facet === "content")
        .map((x) => x.entityId + ":" + x.observationId),
    ),
    productInputs: inputs.slice(1),
  };
}
function nativeUseCovered(recorded: CapturedInput, input: InputDeclaration, requirementId: string) {
  if (input.facet !== "native") return false;
  if (input.fields === undefined) return true;
  return recorded.fields
    ? recorded.fields.every((field) => input.fields!.includes(field))
    : recorded.entityId === requirementId;
}
function inputUseCovered(
  recorded: CapturedInput,
  selected: { version: number | null; observationId: string | null },
  proof: ConfigurationVerificationSupport,
) {
  const referenceId =
    recorded.referenceId ??
    (recorded.links.at(-1)?.reference ? recorded.links.at(-1)!.id : undefined);
  return proof.productInputs.some((input) => {
    if (input.entityId !== recorded.entityId || input.referenceId !== referenceId) return false;
    if (recorded.observation)
      return input.facet === "content" && input.observationId === selected.observationId;
    return (
      input.revision === selected.version && nativeUseCovered(recorded, input, proof.requirementId)
    );
  });
}
export type ConfigurationVerificationSupport = Awaited<
  ReturnType<typeof configurationVerificationSupport>
>;

async function receiptRequirement(tx: Transaction, id: string) {
  const receipt = await tx.getEvidence("receipt", id);
  ensure(receipt, "not_found", "Assessed receipt is unavailable");
  const origin = await verificationReceiptOrigin(tx, receipt);
  if (origin) return origin.basis.requirement.entityId;
  const commandId = await tx.evaluationCommandForReceipt(id);
  if (!commandId) return null;
  const command = await tx.getEvaluationCommand(commandId);
  ensure(command, "storage", "Assessed receipt origin is unavailable");
  const intent: unknown = JSON.parse(command.intent);
  if (
    typeof intent === "object" &&
    intent !== null &&
    "operation" in intent &&
    intent.operation === "verification.conclude"
  )
    return (await verificationConclusionContext(tx, id)).view.scope.basis.requirement.entityId;
  return null;
}
export async function configurationSupportRelated(
  tx: Transaction,
  scope: PairScope,
  subject: CandidateKey,
  proof: ConfigurationVerificationSupport,
) {
  if (!proof.applicable) return false;
  if (subject.kind === "entity") {
    if (!proof.entityIds.has(subject.id)) return false;
    if (
      !proof.productInputs.some(
        (input) =>
          input.entityId === subject.id && input.revision === proof.targetVersions.get(subject.id),
      )
    )
      return false;
    if (!proof.targetContent.has(subject.id)) return true;
    const content = proof.targetContent.get(subject.id);
    return (
      content?.availability === "available" &&
      proof.contentSelections.has(subject.id + ":" + content.id)
    );
  }
  if (subject.kind === "relationship") return proof.relationshipIds.has(subject.id);
  const requirement = await receiptRequirement(tx, subject.id);
  if (requirement) return requirement === proof.requirementId;
  const candidate = scope.candidates.find((x) => x.kind === "receipt" && x.id === subject.id);
  ensure(candidate?.kind === "receipt", "validation", "Receipt is outside the pair assessment");
  const entities = (candidate.contentIds ?? candidate.scope.inputIds).filter((id) =>
    proof.targetEntities.has(id),
  );
  const relationships = candidate.scope.relationshipIds.filter((id) =>
    proof.targetRelationships.has(id),
  );
  const receipt = await tx.getEvidence("receipt", subject.id);
  ensure(receipt, "not_found", "Assessed receipt is unavailable");
  ensure(
    candidate.inputs.length === receipt.inputs.length,
    "storage",
    "Assessed receipt population differs from its controlled capture",
  );
  const covered = receipt.inputs.every(
    (input, index) =>
      !entities.includes(input.entityId) || inputUseCovered(input, candidate.inputs[index], proof),
  );
  return (
    entities.length + relationships.length > 0 &&
    entities.every((id) => proof.entityIds.has(id)) &&
    relationships.every((id) => proof.relationshipIds.has(id)) &&
    covered
  );
}
