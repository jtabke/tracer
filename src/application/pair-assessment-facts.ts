import { ensure } from "../core/model.ts";
import type {
  AssessmentScope,
  CandidateKey,
  AssessmentPairContext,
  CapturedBasis,
} from "../core/change-assessment.ts";
import type { Transaction } from "./ports/repository.ts";
import { compareConfigurations } from "./configuration-comparison.ts";
import { configurationEngineeringState, boundedEngineeringState } from "./engineering-state.ts";
import { referenceEngineeringState } from "./reference-engineering-state.ts";
import { captureAssessmentFact } from "./assessment-fact-capture.ts";
import { observed, receiptCandidateBasis } from "./assessment-receipt-facts.ts";

type PairScope = Extract<AssessmentScope, { version: 2 }>;
export async function pairAssessmentState(tx: Transaction, scope: PairScope) {
  const pair = await compareConfigurations(tx, {
    beforeId: scope.query.beforeId,
    afterId: scope.query.afterId,
  });
  ensure(
    pair.basis.digest === scope.basis.pair.digest,
    "conflict",
    "Selected assessment pair differs from its controlled capture",
  );
  const context: AssessmentPairContext = { query: scope.query, pairDigest: pair.basis.digest };
  const readers = [];
  for (const id of [scope.query.beforeId, scope.query.afterId])
    readers.push(
      boundedEngineeringState(
        referenceEngineeringState(tx, await configurationEngineeringState(tx, id)),
        8388608,
        "Pair assessment facts exceed 8 MiB selected reads per side; narrow the scope",
      ),
    );
  return { pair, context, before: readers[0], after: readers[1] };
}
export type PairAssessmentState = Awaited<ReturnType<typeof pairAssessmentState>>;
export async function pairCandidateBasis(
  tx: Transaction,
  scope: PairScope,
  subject: CandidateKey,
  selected?: PairAssessmentState,
) {
  const state = selected ?? (await pairAssessmentState(tx, scope));
  if (subject.kind === "receipt")
    return receiptCandidateBasis(tx, scope, subject, state.after, state.context);
  if (subject.kind === "relationship") {
    const before = await state.before.getRelationship(subject.id),
      after = await state.after.getRelationship(subject.id);
    return captureAssessmentFact(tx, {
      value: { subject, before: before ?? null, after: after ?? null },
      hasUnknown: false,
      inputs: [],
      relationshipInputs: after ? [{ id: after.id, revision: after.version }] : [],
      absences: after ? [] : [subject],
      context: state.context,
    });
  }
  return entityPairBasis(tx, state, subject);
}
async function selectedEntity(
  state: import("./engineering-state.ts").EngineeringStateReader,
  configuration: import("../core/configuration.ts").Configuration,
  id: string,
) {
  const entity = await state.getEntity(id);
  const external =
    !!entity &&
    (!!entity.resource?.source || configuration.capture!.content.some((x) => x.entityId === id));
  const content = external ? await state.getObservation(id) : null;
  return { entity, external, content };
}
async function entityPairBasis(tx: Transaction, state: PairAssessmentState, subject: CandidateKey) {
  const {
    entity: before,
    external: beforeExternal,
    content: beforeContent,
  } = await selectedEntity(state.before, state.pair.before, subject.id);
  const {
    entity: after,
    external: afterExternal,
    content: afterContent,
  } = await selectedEntity(state.after, state.pair.after, subject.id);
  const facts: Pick<CapturedBasis, "inputs" | "relationshipInputs" | "absences"> = {
    inputs: [],
    relationshipInputs: [],
    absences: after ? [] : [subject],
  };
  if (after) {
    facts.inputs.push({ entityId: after.id, facet: "native", revision: after.version });
    if (afterContent)
      facts.inputs.push({
        entityId: after.id,
        facet: "content",
        revision: after.version,
        observationId: afterContent.id,
      });
  }
  return captureAssessmentFact(tx, {
    value: {
      subject,
      before: before ?? null,
      after: after ?? null,
      ...(beforeExternal ? { beforeContent: observed(beforeContent) } : {}),
      ...(afterExternal ? { afterContent: observed(afterContent) } : {}),
    },
    hasUnknown:
      !!after &&
      ((beforeExternal && beforeContent?.availability !== "available") ||
        (afterExternal && afterContent?.availability !== "available")),
    ...facts,
    context: state.context,
  });
}
