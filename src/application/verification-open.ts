import { ensure } from "../core/model.ts";
import type { OpenVerificationCase, VerificationCaseScope } from "../core/verification-case.ts";
import { verificationCaseLimits } from "../core/verification-case.ts";
import { parseVerificationScope } from "../core/verification-case-validation.ts";
import { resolveVerificationModel } from "./verification-models.ts";
import { resolveVerificationBasis } from "./verification-basis.ts";
import type { Transaction } from "./ports/repository.ts";
import type { EvaluationComposition } from "./evaluation-executor.ts";
import { verificationContext } from "./verification-context.ts";
import { bindVerificationTarget } from "./verification-target.ts";

export async function openVerificationCase(
  tx: Transaction,
  request: OpenVerificationCase,
): Promise<EvaluationComposition> {
  const model = await resolveVerificationModel(tx, request.basis.model);
  ensure(
    model.compatibility.writable,
    "conflict",
    "Verification model is incompatible with the current schema",
  );
  ensure(
    !(await tx.getRevision("entity", request.caseId, 1)) &&
      !(await tx.getRevision("relationship", request.membershipId, 1)),
    "conflict",
    "Verification case/membership identity has already been used",
  );
  const basis = await resolveVerificationBasis(tx, request.basis),
    definition = model.definition,
    fields = definition.case.fields;
  ensure(
    Object.keys(request.additionalFields).every((field) => !Object.values(fields).includes(field)),
    "validation",
    "Additional fields cannot replace controlled verification fields",
  );
  const scope: VerificationCaseScope = {
    contract: "verification_case_scope",
    version: 1,
    purpose: request.purpose,
    basis,
    membershipId: request.membershipId,
    control: { commandId: request.commandId, openingCommandId: request.commandId },
  };
  const target = await bindVerificationTarget(
    tx,
    request.targetConfigurationId,
    basis,
    request.targetPolicy,
  );
  if (target) scope.target = target;
  parseVerificationScope(scope);
  return {
    maxResultBytes: verificationCaseLimits.responseBytes,
    assertComplete: async (tx) => {
      await verificationContext(tx, {
        caseId: request.caseId,
        openingCommandId: request.commandId,
      });
    },
    operations: [
      {
        op: "entity.create",
        id: request.caseId,
        input: {
          type: definition.case.type,
          fields: {
            ...request.additionalFields,
            [fields.title]: request.title,
            [fields.state]: definition.states.open,
            [fields.model]: request.basis.model,
            [fields.basis]: scope,
            [fields.executions]: [],
            [fields.selection]: null,
            [fields.conclusion]: null,
          },
        },
      },
      {
        op: "relationship.create",
        id: request.membershipId,
        input: {
          type: definition.relationships.requirementCase,
          source: basis.requirement.entityId,
          target: request.caseId,
          fields: {},
        },
      },
    ],
    receipt: {
      outputId: request.caseId,
      expectedOutputVersion: 1,
      outcome:
        "Verification case opened with an exact declared criterion/method basis; no execution, selected result or verified conclusion established",
      inputs: [
        {
          entityId: request.basis.model.entityId,
          facet: "native",
          revision: request.basis.model.version,
          fields: [request.basis.model.field],
          role: "verification interpretation model",
        },
        {
          entityId: basis.requirement.entityId,
          facet: "native",
          revision: basis.requirement.version,
          fields: [
            definition.requirement.fields.statement,
            ...definition.requirement.fields.acceptance,
          ],
          role: "declared requirement basis",
        },
        ...basis.methods.map((method) => ({
          entityId: method.entityId,
          facet: "native" as const,
          revision: method.version,
          fields: [definition.method.fields.procedure, definition.method.fields.expected],
          role: "declared verification method",
        })),
      ],
      relationshipInputs: [
        ...basis.methods.map((method) => ({
          id: method.relationship.id,
          revision: method.relationship.version,
          role: "declared method assignment",
        })),
        { id: request.membershipId, expectedVersion: 1, role: "owned requirement-case membership" },
      ],
    },
  };
}
