import { ensure } from "../core/model.ts";
import { parseAssessmentScope } from "../core/assessment-scope-validation.ts";
import type { AssessmentScope, RefreshChangeAssessment } from "../core/change-assessment.ts";
import type { Transaction } from "./ports/repository.ts";
import { assessmentContext } from "./assessment-context.ts";
import { discoverAssessmentScope } from "./assessment-scope.ts";
import type { Operation } from "./commands.ts";
import type { ReceiptInput } from "../core/evidence.ts";

function key(candidate: { kind: string; id: string }) {
  return candidate.kind + ":" + candidate.id;
}
function retain(
  previous: AssessmentScope,
  next: AssessmentScope,
  request: RefreshChangeAssessment,
) {
  const discovered = new Map(next.candidates.map((candidate) => [key(candidate), candidate]));
  const oldRetained = new Map(
    (previous.retained ?? []).map((candidate) => [key(candidate), candidate]),
  );
  const retained: NonNullable<AssessmentScope["retained"]> = [];
  const candidates = previous.candidates.map((candidate) => {
    const updated = discovered.get(key(candidate));
    if (updated) {
      discovered.delete(key(candidate));
      return updated;
    }
    retained.push(
      oldRetained.get(key(candidate)) ?? {
        kind: candidate.kind,
        id: candidate.id,
        basis: previous.basis,
      },
    );
    return candidate;
  });
  return parseAssessmentScope({
    ...next,
    ...(previous.dispositions ? { dispositions: previous.dispositions } : {}),
    ...(previous.reopened ? { reopened: previous.reopened } : {}),
    candidates: [...candidates, ...discovered.values()],
    retained,
    control: { commandId: request.commandId, openingCommandId: request.openingCommandId },
    refresh: {
      reason: request.reason,
      previousAssessmentVersion: request.expectedAssessmentVersion,
    },
  });
}
export async function refreshAssessment(
  tx: Transaction,
  request: RefreshChangeAssessment,
): Promise<{ operations: Operation[]; receipt: ReceiptInput }> {
  const { entity, view } = await assessmentContext(tx, request, request.expectedAssessmentVersion);
  const model = view.model.definition,
    fields = model.assessment.fields;
  ensure(
    view.model.compatibility.writable,
    "validation",
    "Application model is incompatible with the current schema",
  );
  ensure(
    view.assessment.state === model.states.open && entity.fields[fields.closure] === null,
    "conflict",
    "Only an open assessment can refresh its scope",
  );
  const discovered = await discoverAssessmentScope(tx, {
    assessmentId: entity.id,
    query: view.scope.query,
    purpose: view.scope.purpose,
  });
  const scope = retain(view.scope, discovered, request);
  return {
    operations: [
      {
        op: "entity.update",
        id: entity.id,
        expectedVersion: entity.version,
        input: { fields: { ...entity.fields, [fields.scope]: scope } },
      },
    ],
    receipt: {
      outputId: entity.id,
      expectedOutputVersion: entity.version + 1,
      outcome: `Scope refreshed: ${scope.candidates.length} obligations, ${scope.retained!.length} retained outside current discovery. ${request.reason}. No completion judgment established.`,
      inputs: [
        {
          entityId: view.model.pin.entityId,
          revision: view.model.pin.version,
          facet: "native",
          fields: [view.model.pin.field],
          role: "governing application model",
        },
        {
          entityId: entity.id,
          revision: entity.version,
          facet: "native",
          role: "assessment scope before refresh",
        },
      ],
    },
  };
}
