import type { Configuration } from "../../src/core/configuration.ts";
import type { Entity, Relationship } from "../../src/core/model.ts";
import type { InputDeclaration } from "../../src/core/evidence.ts";
import { verificationCaseLimits } from "../../src/core/verification-case.ts";
import type { VerificationSupportDraft } from "./common.ts";
export type TargetInputDraft = {
  kind: "native" | "content" | "relationship";
  entityId: string;
  referenceId: string;
  fields: string[];
  role: string;
  relationshipId: string;
};
export function targetSupportProposal(
  draft: TargetInputDraft,
  selection: {
    entity?: Entity;
    version?: number;
    observationId?: string;
    reference?: Relationship;
    ready: boolean;
  },
  target: Configuration,
  value: VerificationSupportDraft,
): VerificationSupportDraft | undefined {
  if (!draft.role.trim()) return;
  if (draft.kind === "relationship") {
    const link = target.relationships?.find(
      (x) => x.relationship.id === draft.relationshipId,
    )?.relationship;
    if (!link) return;
    return bounded({
      ...value,
      relationshipInputs: [
        ...value.relationshipInputs,
        { id: link.id, revision: link.version, role: draft.role },
      ],
    });
  }
  const input = targetMaterialDeclaration(draft, selection);
  if (!input) return;
  const reference = selection.reference;
  const relationshipInputs =
    reference && !value.relationshipInputs.some((x) => x.id === reference.id)
      ? [
          ...value.relationshipInputs,
          {
            id: reference.id,
            revision: reference.version,
            role: "Explicit contextual reference use",
          },
        ]
      : value.relationshipInputs;
  return bounded({ inputs: [...value.inputs, input], relationshipInputs });
}
function bounded(value: VerificationSupportDraft) {
  return value.inputs.length + value.relationshipInputs.length <=
    verificationCaseLimits.supportInputs
    ? value
    : undefined;
}
function targetMaterialDeclaration(
  draft: TargetInputDraft,
  selection: {
    entity?: Entity;
    version?: number;
    observationId?: string;
    reference?: Relationship;
    ready: boolean;
  },
): InputDeclaration | undefined {
  if (!selection.entity || !selection.ready || (draft.referenceId && !selection.reference)) return;
  const common = {
    entityId: selection.entity.id,
    role: draft.role,
    ...(selection.reference ? { referenceId: selection.reference.id } : {}),
  };
  if (draft.kind === "content")
    return selection.observationId
      ? { ...common, facet: "content", observationId: selection.observationId }
      : undefined;
  return {
    ...common,
    facet: "native",
    revision: selection.version,
    ...(draft.fields.length ? { fields: draft.fields } : {}),
  };
}
