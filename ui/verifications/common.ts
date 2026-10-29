import type { InputDeclaration, RelationshipDeclaration } from "../../src/core/evidence.ts";
import type { VerificationAnalysis } from "../../src/core/verification-lifecycle.ts";
import type { Entity } from "../../src/core/model.ts";
import { label } from "../entity-label.ts";
export function verificationCommand(a: VerificationAnalysis, reason: string) {
  return {
    caseId: a.view.case.id,
    openingCommandId: a.view.opening.commandId,
    commandId: crypto.randomUUID(),
    reason,
    expectedSchemaVersion: a.view.model.context.schemaVersion,
    expectedProjectRevision: a.view.model.context.projectRevision,
    expectedEvidenceRevision: a.view.model.context.evidenceRevision,
    expectedCaseVersion: a.view.case.version,
    expectedAnalysisDigest: a.proposalDigest,
  };
}
export function samePreparation(a: VerificationAnalysis, b: VerificationAnalysis) {
  return (
    a.view.case.version === b.view.case.version &&
    JSON.stringify(a.view.model.context) === JSON.stringify(b.view.model.context) &&
    a.proposalDigest === b.proposalDigest
  );
}
export function executionName(a: VerificationAnalysis, id: string, entities: Entity[]) {
  const entity = entities.find((x) => x.id === id),
    title = entity?.fields[a.view.model.definition.execution.fields.title];
  return typeof title === "string" ? title : entity ? label(entity) : "Activity " + id.slice(0, 8);
}
export type VerificationEditorProps = {
  analysis: VerificationAnalysis;
  entities: Entity[];
  editing: import("../editing.ts").Editing;
  ready: boolean;
  saved(): void;
  onDirty(value: boolean): void;
};
export { useRecoveredApplication as useRecoveredVerification } from "../use-application-outcome.ts";

export type VerificationSupportDraft = {
  inputs: InputDeclaration[];
  relationshipInputs: RelationshipDeclaration[];
};
