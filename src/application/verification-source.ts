import { ensure } from "../core/model.ts";
import type { Receipt, CapturedInput } from "../core/evidence.ts";
import { canonical } from "../core/evidence.ts";
import type {
  VerificationCaseView,
  RecordVerificationExecution,
} from "../core/verification-case.ts";
import type { Transaction } from "./ports/repository.ts";
import { verificationBytes } from "../core/verification-case-validation.ts";
import { verificationCaseLimits } from "../core/verification-case.ts";
import { nativeState } from "./receipt-comparison.ts";

function matches(
  inputs: CapturedInput[],
  id: string,
  fields: string[],
  expected: Record<string, unknown>,
) {
  return inputs.some(
    (input) =>
      input.entityId === id &&
      !input.observation &&
      input.facet !== "content" &&
      fields.every((field) => input.fields === undefined || input.fields.includes(field)) &&
      canonical(nativeState(input.entity, fields)) ===
        canonical(fields.map((name) => ({ name, present: true, value: expected[name] }))),
  );
}
/** Prior execution interpretation is an explicit new attestation, never a guessed PASS parser. */
export async function priorVerificationSource(
  tx: Transaction,
  view: VerificationCaseView,
  input: RecordVerificationExecution,
): Promise<Receipt | null> {
  if (input.source.kind === "performed") return null;
  const receipt = await tx.getEvidence("receipt", input.source.receiptId);
  ensure(receipt, "not_found", "Original execution receipt is unavailable");
  verificationBytes(receipt, verificationCaseLimits.priorReceiptBytes);
  const definition = view.model.definition,
    basis = view.scope.basis,
    method = basis.methods.find((x) => x.entityId === input.methodId)!;
  const reqFields = [
    definition.requirement.fields.statement,
    ...definition.requirement.fields.acceptance,
  ];
  const requirement = {
    ...basis.requirement.acceptance,
    [definition.requirement.fields.statement]: basis.requirement.statement,
  };
  const methodFields = [definition.method.fields.procedure, definition.method.fields.expected];
  const expectedMethod = {
    [definition.method.fields.procedure]: method.procedure,
    [definition.method.fields.expected]: method.expected,
  };
  ensure(
    matches(receipt.inputs, basis.requirement.entityId, reqFields, requirement) &&
      matches(receipt.inputs, method.entityId, methodFields, expectedMethod),
    "validation",
    "Prior receipt must explicitly capture the selected requirement and method semantic basis",
  );
  return receipt;
}
