import { ensure } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";
import type { RefreshChangeAssessment } from "../core/change-assessment.ts";
import { analyzeAssessmentContext, judgmentDigest } from "./assessment-analysis.ts";
import { assessmentContext } from "./assessment-context.ts";
import { parseAssessmentScope } from "../core/assessment-scope-validation.ts";
import type { EvaluationComposition } from "./evaluation-executor.ts";
import { candidateBasis } from "./assessment-facts.ts";
import { assessmentSupportResolver } from "./assessment-support.ts";
import { pairAssessmentState } from "./pair-assessment-facts.ts";

export async function concludeAssessment(
  tx: Transaction,
  request: RefreshChangeAssessment,
  reopen: boolean,
): Promise<EvaluationComposition> {
  const context = await assessmentContext(tx, request, request.expectedAssessmentVersion);
  const { entity, view } = context;
  const inspected = reopen ? null : await analyzeAssessmentContext(tx, context);
  const owned = inspected?.owned ?? [],
    analysis = inspected?.analysis;
  const model = view.model.definition,
    fields = model.assessment.fields;
  ensure(
    view.model.compatibility.writable,
    "conflict",
    "Application model is incompatible with the current schema",
  );
  ensure(
    view.assessment.state === (reopen ? model.states.closed : model.states.open),
    "conflict",
    reopen ? "Only a controlled closed assessment can reopen" : "Only an open assessment can close",
  );
  if (!reopen) {
    ensure(analysis, "storage", "Closure analysis is missing");
    ensure(
      analysis.discovery === "current",
      "conflict",
      "Refresh changed or incomplete scope before closure",
    );
    ensure(
      analysis.obligations.every((item) => item.state === "accounted"),
      "conflict",
      "Closure requires a current disposition and resolved actions for every obligation",
    );
  }
  const scope = parseAssessmentScope({
    ...view.scope,
    control: { commandId: request.commandId, openingCommandId: request.openingCommandId },
    ...(reopen
      ? { reopened: { fromCommandId: view.control.commandId, reason: request.reason } }
      : {}),
  });
  const judgments = [];
  for (const item of owned)
    judgments.push({
      id: item.entity.id,
      version: item.entity.version,
      membershipId: item.member.id,
      membershipVersion: item.member.version,
      digest: await judgmentDigest(item.disposition),
    });
  const closure = reopen
    ? null
    : {
        contract: "change_assessment_closure",
        version: 1,
        commandId: request.commandId,
        openingCommandId: request.openingCommandId,
        rationale: request.reason,
        at: {
          projectRevision: request.expectedProjectRevision,
          evidenceRevision: request.expectedEvidenceRevision,
        },
        population: analysis!.obligations.map((item) => ({
          subject: item.subject,
          digest: item.currentDigest,
        })),
        judgments,
      };
  return {
    assertResult: async (current) => {
      if (reopen) return;
      const resolver = assessmentSupportResolver(current, view.scope);
      const selected =
        view.scope.version === 2 ? await pairAssessmentState(current, view.scope) : undefined;
      for (const item of analysis!.obligations)
        ensure(
          (await candidateBasis(current, view.scope, item.subject, selected)).digest ===
            item.currentDigest,
          "conflict",
          "Closure changes its own candidate basis",
        );
      for (const item of owned)
        for (const support of [
          ...item.disposition.data.support,
          ...item.disposition.data.actionSupport.flatMap((action) => action.support),
        ])
          if (support.reference.mode !== "historical")
            ensure(
              (await resolver.resolve(support.reference)).digest === support.digest,
              "conflict",
              "Closure changes its own current supporting basis; select independent evidence or historical context",
            );
    },
    operations: [
      {
        op: "entity.update",
        id: entity.id,
        expectedVersion: entity.version,
        input: {
          fields: {
            ...entity.fields,
            [fields.scope]: scope,
            [fields.state]: reopen ? model.states.open : model.states.closed,
            [fields.closure]: closure,
          },
        },
      },
    ],
    receipt: {
      outputId: entity.id,
      expectedOutputVersion: entity.version + 1,
      outcome: reopen
        ? `Reopened assessment for explicit reassessment: ${request.reason}. Historical closure remains recorded.`
        : `Completed declared scoped assessment with ${analysis!.obligations.length} accounted obligations: ${request.reason}. Engineering judgments retained; no release approval implied.`,
      inputs: [
        {
          entityId: entity.id,
          facet: "native",
          revision: entity.version,
          role: reopen ? "previous controlled closure" : "assessment before closure",
        },
        {
          entityId: view.model.pin.entityId,
          facet: "native",
          revision: view.model.pin.version,
          fields: [view.model.pin.field],
          role: "governing model",
        },
        ...owned.map((item) => ({
          entityId: item.entity.id,
          facet: "native" as const,
          revision: item.entity.version,
          role: "controlled disposition and exact captured supporting basis",
        })),
      ],
      relationshipInputs: owned.map((item) => ({
        id: item.member.id,
        revision: item.member.version,
        role: "controlled judgment membership",
      })),
    },
  };
}
