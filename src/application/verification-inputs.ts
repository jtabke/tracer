import { ensure } from "../core/model.ts";
import type {
  OpenVerificationCase,
  RecordVerificationExecution,
  VerificationSelection,
} from "../core/verification-case.ts";
import { verificationCaseLimits } from "../core/verification-case.ts";
import {
  verificationObject,
  verificationBytes,
  verificationVersion,
  verificationResults,
} from "../core/verification-case-validation.ts";
import { verificationText } from "../core/verification-criteria.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { prepareVerificationBasis } from "./verification-basis.ts";
import { prepareReceipt } from "./receipt-capture.ts";
import { changesetCommandId } from "./changeset-command.ts";

const guardKeys = [
  "commandId",
  "expectedSchemaVersion",
  "expectedProjectRevision",
  "expectedEvidenceRevision",
];
function guards(input: Record<string, unknown>) {
  changesetCommandId(input.commandId);
  verificationVersion(input.expectedSchemaVersion);
  for (const key of ["expectedProjectRevision", "expectedEvidenceRevision"])
    ensure(
      Number.isSafeInteger(input[key]) && Number(input[key]) >= 0,
      "validation",
      "Verification needs exact native/evidence guards",
    );
}
export function prepareVerificationSelection(input: VerificationSelection) {
  input = snapshotInput(input);
  verificationObject(input, ["caseId", "openingCommandId"]);
  verificationText(input.caseId, 200);
  changesetCommandId(input.openingCommandId);
  return input;
}
export function prepareVerificationOpening(input: OpenVerificationCase) {
  input = snapshotInput(input);
  verificationObject(input, [
    ...guardKeys,
    "caseId",
    "membershipId",
    "title",
    "purpose",
    "basis",
    "additionalFields",
  ]);
  verificationBytes(input, verificationCaseLimits.commandBytes);
  guards(input);
  for (const key of ["caseId", "membershipId", "title"] as const) verificationText(input[key], 200);
  verificationText(input.purpose);
  verificationObject(input.additionalFields, Object.keys(input.additionalFields ?? {}));
  input.basis = prepareVerificationBasis(input.basis);
  return input;
}
export function prepareVerificationExecution(input: RecordVerificationExecution) {
  input = snapshotInput(input);
  verificationObject(input, [
    ...guardKeys,
    "caseId",
    "openingCommandId",
    "expectedCaseVersion",
    "executionId",
    "membershipId",
    "title",
    "methodId",
    "source",
    "conditions",
    "results",
    "inputs",
    "relationshipInputs",
    "additionalFields",
  ]);
  verificationBytes(input, verificationCaseLimits.commandBytes);
  guards(input);
  prepareVerificationSelection({ caseId: input.caseId, openingCommandId: input.openingCommandId });
  verificationVersion(input.expectedCaseVersion);
  for (const key of ["executionId", "membershipId", "title", "methodId"] as const)
    verificationText(input[key], 200);
  verificationObject(input.source, ["kind", "receiptId", "rationale"]);
  if (input.source.kind === "prior_receipt") {
    verificationText(input.source.receiptId, 200);
    verificationText(input.source.rationale);
  } else
    ensure(
      input.source.kind === "performed" && Object.keys(input.source).length === 1,
      "validation",
      "Invalid execution source",
    );
  ensure(
    Object.hasOwn(input, "conditions"),
    "validation",
    "Record execution conditions explicitly",
  );
  verificationBytes(input.conditions, 16384);
  verificationResults(input.results);
  verificationObject(input.additionalFields, Object.keys(input.additionalFields ?? {}));
  ensure(
    Array.isArray(input.inputs) &&
      Array.isArray(input.relationshipInputs) &&
      input.inputs.length + input.relationshipInputs.length <= verificationCaseLimits.supportInputs,
    "validation",
    "Execution supports up to 20 explicit supporting input uses",
  );
  if (input.inputs.length + input.relationshipInputs.length > 0) {
    const receipt = prepareReceipt({
      outputId: input.executionId,
      outcome: "Execution input validation",
      inputs: input.inputs,
      relationshipInputs: input.relationshipInputs,
    });
    input.inputs = receipt.inputs;
    input.relationshipInputs = receipt.relationshipInputs ?? [];
  }
  return input;
}

import type {
  VerificationMutation,
  SelectVerificationResults,
  ReviseVerificationBasis,
} from "../core/verification-lifecycle.ts";
import {
  verificationDigest,
  verificationChoices,
  verificationAccounting,
} from "../core/verification-lifecycle-validation.ts";

export function prepareVerificationMutation<T extends VerificationMutation>(
  input: T,
  extraKeys: string[] = [],
): T {
  input = snapshotInput(input);
  verificationObject(input, [
    ...guardKeys,
    "caseId",
    "openingCommandId",
    "expectedCaseVersion",
    "expectedAnalysisDigest",
    "reason",
    ...extraKeys,
  ]);
  verificationBytes(input, verificationCaseLimits.commandBytes);
  guards(input);
  prepareVerificationSelection({ caseId: input.caseId, openingCommandId: input.openingCommandId });
  verificationVersion(input.expectedCaseVersion);
  verificationDigest(input.expectedAnalysisDigest);
  verificationText(input.reason);
  return input;
}
export function prepareVerificationResults(input: SelectVerificationResults) {
  input = prepareVerificationMutation(input, ["selections", "accounting"]);
  verificationChoices(input.selections);
  verificationAccounting(input.accounting);
  return input;
}
export function prepareVerificationRevision(input: ReviseVerificationBasis) {
  input = prepareVerificationMutation(input, ["basis", "mapping"]);
  input.basis = prepareVerificationBasis(input.basis);
  ensure(
    Array.isArray(input.mapping) && input.mapping.length <= 25,
    "validation",
    "Explicitly map at most 25 previous criteria",
  );
  const ids = new Set<string>(),
    targets = new Set<string>();
  for (const item of input.mapping) {
    verificationObject(item, ["fromId", "toId"]);
    verificationText(item.fromId, 200);
    ensure(!ids.has(item.fromId), "validation", "Duplicate previous criterion mapping");
    ids.add(item.fromId);
    if (item.toId !== null) {
      verificationText(item.toId, 200);
      ensure(!targets.has(item.toId), "validation", "Criterion mappings must be one to one");
      targets.add(item.toId);
    }
  }
  return input;
}
