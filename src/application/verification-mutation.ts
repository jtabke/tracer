import { ensure, json } from "../core/model.ts";
import type { Json, Fields } from "../core/model.ts";
import type { VerificationMutation } from "../core/verification-lifecycle.ts";
import type { InputDeclaration } from "../core/evidence.ts";
import type { VerificationCaseScope } from "../core/verification-case.ts";
import { verificationCaseLimits } from "../core/verification-case.ts";
import { analyzeVerification } from "./verification-analysis.ts";
import { declaredFacts } from "./captured-facts.ts";
import type { Transaction } from "./ports/repository.ts";
import type { EvaluationComposition } from "./evaluation-executor.ts";

export async function verificationMutationContext(
  tx: Transaction,
  request: VerificationMutation,
  closed = false,
) {
  const result = await analyzeVerification(tx, request, request.expectedCaseVersion),
    { analysis } = result;
  ensure(
    analysis.view.model.compatibility.writable,
    "conflict",
    "Verification model is incompatible with the current schema",
  );
  ensure(
    analysis.view.case.state ===
      (closed
        ? analysis.view.model.definition.states.closed
        : analysis.view.model.definition.states.open),
    "conflict",
    closed
      ? "Only a concluded verification can be reopened"
      : "Reopen a concluded verification before changing its basis or result selection",
  );
  ensure(
    analysis.proposalDigest === request.expectedAnalysisDigest,
    "conflict",
    "Verification analysis changed; inspect the current obligations before applying this intent",
  );
  return result;
}
export function verificationMutationFacts(
  result: Awaited<ReturnType<typeof analyzeVerification>>,
  ids: Set<string>,
) {
  const { context, governing, entries } = result,
    { entity, view } = context,
    definition = view.model.definition;
  const chosen = entries.filter((x) => ids.has(x.summary.id));
  const fixed: InputDeclaration[] = [
    {
      entityId: view.model.pin.entityId,
      facet: "native",
      revision: view.model.pin.version,
      fields: [view.model.pin.field],
    },
    {
      entityId: entity.id,
      facet: "native",
      revision: entity.version,
      fields: [definition.case.fields.model],
    },
    ...governing.inputs,
    ...chosen.flatMap((x) =>
      x.raw.current
        ? [
            {
              entityId: x.raw.current.id,
              facet: "native" as const,
              revision: x.raw.current.version,
              fields: [definition.execution.fields.data],
            },
          ]
        : [],
    ),
  ];
  const declarations = declaredFacts([
    {
      inputs: fixed,
      relationshipInputs: [
        { id: view.scope.membershipId, revision: 1 },
        ...governing.relationships,
      ],
    },
    ...chosen.map((x) => ({ inputs: x.inputs, relationshipInputs: x.relationships })),
  ]);
  declarations.inputs[0].role = "verification interpretation model";
  const facts = {
    basisDigest: governing.digest,
    state: governing.state,
    ...declarations,
    executions: chosen.map((x) => ({
      id: x.summary.id,
      receiptId: x.summary.receiptId,
      stateDigest: x.summary.stateDigest,
      reviewIds: x.reviewIds,
      absences: x.absences,
    })),
  };
  ensure(json(facts), "validation", "Verification state references must be JSON");
  return { declarations, facts: facts as Json };
}
export function composeVerificationMutation(
  result: Awaited<ReturnType<typeof analyzeVerification>>,
  request: VerificationMutation,
  fields: Fields,
  declarations: ReturnType<typeof declaredFacts>,
  outcome: string,
  assertComplete: EvaluationComposition["assertComplete"],
  scope: VerificationCaseScope = result.context.view.scope,
): EvaluationComposition {
  const { entity, view } = result.context,
    definition = view.model.definition;
  return {
    maxResultBytes: verificationCaseLimits.responseBytes,
    assertComplete,
    operations: [
      {
        op: "entity.update",
        id: entity.id,
        expectedVersion: entity.version,
        input: {
          fields: {
            ...entity.fields,
            ...fields,
            [definition.case.fields.basis]: {
              ...scope,
              control: { ...scope.control, commandId: request.commandId },
            },
          },
        },
      },
    ],
    receipt: {
      outputId: entity.id,
      expectedOutputVersion: entity.version + 1,
      outcome,
      ...declarations,
    },
  };
}
