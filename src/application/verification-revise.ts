import { ensure } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type { ReviseVerificationBasis } from "../core/verification-lifecycle.ts";
import { parseVerificationScope } from "../core/verification-case-validation.ts";
import {
  verificationMutationContext,
  verificationMutationFacts,
  composeVerificationMutation,
} from "./verification-mutation.ts";
import { resolveVerificationBasis } from "./verification-basis.ts";
import { verificationGoverningBasis } from "./verification-governing.ts";
import { analyzeVerification } from "./verification-analysis.ts";
import type { Transaction } from "./ports/repository.ts";

export async function reviseVerificationBasis(tx: Transaction, request: ReviseVerificationBasis) {
  const result = await verificationMutationContext(tx, request),
    { view } = result.context;
  ensure(
    canonical(request.basis.model) === canonical(view.scope.basis.model) &&
      request.basis.requirement.entityId === view.scope.basis.requirement.entityId,
    "validation",
    "Basis revision must retain the same requirement identity and pinned interpretation model",
  );
  const basis = await resolveVerificationBasis(tx, request.basis);
  ensure(
    request.mapping.length === view.scope.basis.criteria.length &&
      request.mapping.every(
        (x) =>
          view.scope.basis.criteria.some((c) => c.id === x.fromId) &&
          (x.toId === null || basis.criteria.some((c) => c.id === x.toId)),
      ),
    "validation",
    "Map every previous criterion explicitly to a new criterion or retirement",
  );
  const scope = {
    ...view.scope,
    basis,
    revisions: [
      ...(view.scope.revisions ?? []),
      {
        commandId: request.commandId,
        caseVersion: view.case.version,
        reason: request.reason,
        mapping: request.mapping,
      },
    ],
  };
  parseVerificationScope(scope);
  const governing = await verificationGoverningBasis(tx, { ...view, scope });
  ensure(
    governing.state === "current",
    "conflict",
    "Revised basis must identify the current governing semantic state",
  );
  const { declarations } = verificationMutationFacts({ ...result, governing }, new Set());
  const fields = view.model.definition.case.fields;
  return composeVerificationMutation(
    result,
    request,
    { [fields.selection]: null, [fields.conclusion]: null },
    declarations,
    "Verification basis explicitly revised; previous executions retained, result selection cleared and affected obligations require new execution",
    async (tx) => {
      const current = (await analyzeVerification(tx, request)).analysis;
      ensure(
        current.basis.state === "current" && current.recordedSelection === null,
        "conflict",
        "Basis revision did not establish the declared current basis",
      );
    },
    scope,
  );
}
