import { ensure } from "../core/model.ts";
import type {
  RecordVerificationExecution,
  VerificationExecutionData,
} from "../core/verification-case.ts";
import { verificationCaseLimits } from "../core/verification-case.ts";
import {
  parseExecutionRegistry,
  parseVerificationExecution,
} from "../core/verification-case-validation.ts";
import { verificationContext } from "./verification-context.ts";
import { priorVerificationSource } from "./verification-source.ts";
import type { Transaction } from "./ports/repository.ts";
import type { EvaluationComposition } from "./evaluation-executor.ts";
import { readVerificationExecution } from "./verification-execution-read.ts";

export async function recordVerificationExecution(
  tx: Transaction,
  request: RecordVerificationExecution,
): Promise<EvaluationComposition> {
  const { entity, view } = await verificationContext(tx, request, request.expectedCaseVersion);
  const definition = view.model.definition,
    basis = view.scope.basis,
    caseFields = definition.case.fields,
    executionFields = definition.execution.fields;
  ensure(
    view.model.compatibility.writable,
    "conflict",
    "Verification model is incompatible with the current schema",
  );
  const method = basis.methods.find((x) => x.entityId === request.methodId);
  ensure(method, "validation", "Method is outside this case's declared population");
  ensure(
    request.results.length === method.criterionIds.length &&
      request.results.every((x) => method.criterionIds.includes(x.criterionId)),
    "validation",
    "Record exactly one explicit result for every assigned criterion",
  );
  ensure(
    !(await tx.getRevision("entity", request.executionId, 1)) &&
      !(await tx.getRevision("relationship", request.membershipId, 1)),
    "conflict",
    "Execution/membership identity has already been used",
  );
  ensure(
    Object.keys(request.additionalFields).every(
      (field) => !Object.values(executionFields).includes(field),
    ),
    "validation",
    "Additional fields cannot replace controlled execution fields",
  );
  const prior = await priorVerificationSource(tx, view, request);
  const data: VerificationExecutionData = {
    contract: "verification_execution",
    version: 1,
    caseId: entity.id,
    openingCommandId: request.openingCommandId,
    commandId: request.commandId,
    methodId: method.entityId,
    methodVersion: method.version,
    membershipId: request.membershipId,
    basisVersion: entity.version,
    source: prior
      ? { ...request.source, recordedAt: prior.at, actor: prior.actor }
      : request.source,
    conditions: request.conditions,
    results: request.results,
  };
  parseVerificationExecution(data);
  const registry = parseExecutionRegistry([
    ...view.executions,
    {
      executionId: request.executionId,
      membershipId: request.membershipId,
      commandId: request.commandId,
    },
  ]);
  return {
    maxResultBytes: verificationCaseLimits.responseBytes,
    assertComplete: async (tx) => {
      await readVerificationExecution(tx, request, request.executionId);
    },
    operations: [
      {
        op: "entity.create",
        id: request.executionId,
        input: {
          type: definition.execution.type,
          fields: {
            ...request.additionalFields,
            [executionFields.title]: request.title,
            [executionFields.data]: data,
          },
        },
      },
      {
        op: "relationship.create",
        id: request.membershipId,
        input: {
          type: definition.relationships.caseExecution,
          source: entity.id,
          target: request.executionId,
          fields: {},
        },
      },
      {
        op: "entity.update",
        id: entity.id,
        expectedVersion: entity.version,
        input: {
          fields: {
            ...entity.fields,
            [caseFields.basis]: {
              ...view.scope,
              control: { ...view.scope.control, commandId: request.commandId },
            },
            [caseFields.executions]: registry,
          },
        },
      },
    ],
    receipt: {
      outputId: request.executionId,
      expectedOutputVersion: 1,
      outcome:
        "Explicit verification execution attestation recorded; criterion results are not a selected result, current applicability judgment or verified conclusion",
      inputs: [
        {
          entityId: view.model.pin.entityId,
          facet: "native",
          revision: view.model.pin.version,
          fields: [view.model.pin.field],
          role: "verification interpretation model",
        },
        {
          entityId: entity.id,
          facet: "native",
          revision: entity.version,
          fields: [caseFields.model],
          role: "case identity/profile; exact native basis at the recorded case version",
        },
        {
          entityId: basis.requirement.entityId,
          facet: "native",
          revision: basis.requirement.version,
          fields: [
            definition.requirement.fields.statement,
            ...definition.requirement.fields.acceptance,
          ],
          role: "declared interpretation requirement basis",
        },
        {
          entityId: method.entityId,
          facet: "native",
          revision: method.version,
          fields: [definition.method.fields.procedure, definition.method.fields.expected],
          role: "declared interpretation method",
        },
        ...(prior
          ? [
              {
                entityId: prior.output.id,
                facet: "native" as const,
                revision: prior.output.version,
                role: "original receipt output identity; original input state compared separately",
              },
            ]
          : []),
        ...request.inputs,
      ],
      relationshipInputs: [
        {
          id: method.relationship.id,
          revision: method.relationship.version,
          role: "declared method mapping",
        },
        { id: request.membershipId, expectedVersion: 1, role: "owned case-execution membership" },
        ...request.relationshipInputs,
      ],
    },
  };
}
