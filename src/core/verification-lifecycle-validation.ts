import { ensure } from "./model.ts";
import {
  verificationObject,
  verificationVersion,
  verificationBytes,
} from "./verification-case-validation.ts";
import { verificationText } from "./verification-criteria.ts";
import type {
  VerificationChoice,
  VerificationAccounting,
  VerificationResultSelection,
  VerificationConclusion,
} from "./verification-lifecycle.ts";

export function verificationDigest(value: unknown): asserts value is string {
  ensure(
    typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value),
    "validation",
    "Invalid verification evidence digest",
  );
}
export function verificationChoices(value: unknown): asserts value is VerificationChoice[] {
  ensure(
    Array.isArray(value) && value.length <= 100,
    "validation",
    "Select at most 100 verification obligations",
  );
  const ids = new Set<string>();
  for (const item of value) {
    const choice = verificationObject(item, ["criterionId", "methodId", "executionId"]);
    for (const key of ["criterionId", "methodId", "executionId"])
      verificationText(choice[key], 200);
    const key = JSON.stringify([choice.criterionId, choice.methodId]);
    ensure(!ids.has(key), "validation", "Duplicate selected verification obligation");
    ids.add(key);
  }
}
export function verificationAccounting(value: unknown): asserts value is VerificationAccounting[] {
  ensure(
    Array.isArray(value) && value.length <= 100,
    "validation",
    "Account for at most 100 registered executions",
  );
  const ids = new Set<string>();
  for (const item of value) {
    const entry = verificationObject(item, [
      "executionId",
      "decision",
      "rationale",
      "replacementId",
    ]);
    verificationText(entry.executionId, 200);
    verificationText(entry.rationale);
    ensure(!ids.has(entry.executionId), "validation", "Duplicate execution accounting");
    ids.add(entry.executionId);
    ensure(
      ["selected", "historical", "superseded"].includes(String(entry.decision)),
      "validation",
      "Unknown execution accounting decision",
    );
    if (entry.decision === "superseded") verificationText(entry.replacementId, 200);
    else
      ensure(
        entry.replacementId === undefined,
        "validation",
        "Only superseded executions name a replacement",
      );
  }
}
export function parseVerificationResultSelection(
  value: unknown,
): VerificationResultSelection | null {
  if (value === null) return null;
  const selected = verificationObject(value, [
    "contract",
    "version",
    "reason",
    "selections",
    "accounting",
    "evidenceDigest",
    "facts",
  ]);
  ensure(
    selected.contract === "verification_result_selection" && selected.version === 1,
    "validation",
    "Unsupported verification result selection",
  );
  verificationText(selected.reason);
  verificationChoices(selected.selections);
  verificationAccounting(selected.accounting);
  ensure(
    Object.hasOwn(selected, "facts"),
    "validation",
    "Verification selection needs exact assessed-state references",
  );
  verificationDigest(selected.evidenceDigest);
  verificationBytes(selected, 65536);
  return selected as VerificationResultSelection;
}
export function parseVerificationConclusion(value: unknown): VerificationConclusion | null {
  if (value === null) return null;
  const certificate = verificationObject(value, [
    "contract",
    "version",
    "commandId",
    "openingCommandId",
    "rationale",
    "at",
    "evidenceDigest",
    "basisDigest",
    "obligations",
  ]);
  ensure(
    certificate.contract === "verification_conclusion" && certificate.version === 1,
    "validation",
    "Unsupported verification conclusion",
  );
  verificationText(certificate.commandId, 200);
  verificationText(certificate.openingCommandId, 200);
  verificationText(certificate.rationale);
  verificationDigest(certificate.evidenceDigest);
  verificationDigest(certificate.basisDigest);
  verificationChoices(certificate.obligations);
  const at = verificationObject(certificate.at, ["projectRevision", "evidenceRevision"]);
  verificationVersion(at.projectRevision);
  ensure(
    Number.isSafeInteger(at.evidenceRevision) && Number(at.evidenceRevision) >= 0,
    "validation",
    "Invalid conclusion evidence watermark",
  );
  verificationBytes(certificate, 65536);
  return certificate as VerificationConclusion;
}
