import type { Entity, Relationship, SchemaObject, Fields } from "../src/core/model.ts";
import type { Observation } from "../src/core/evidence.ts";
import type { Reference, ReferenceState } from "../src/core/references.ts";
import type { Operation } from "../src/application/commands.ts";
export type ReferenceContext = {
  source: Entity;
  schema: SchemaObject;
  resources: Entity[];
  link?: Relationship;
  observation?: Observation | null;
};
export function referenceFamilies(context: ReferenceContext) {
  return Object.entries(context.schema.relationshipTypes).filter(
    ([, d]) =>
      d.reference &&
      ((context.source.resource && d.resourceSource) ||
        !d.source ||
        d.source.includes(context.source.type)),
  );
}
export function initialReferenceDraft(context: ReferenceContext, sourceId: string) {
  const reference = context.link?.reference;
  return {
    resourceId: context.link?.target ?? "",
    sourceId,
    label: "",
    role: reference?.role ?? "support",
    scope: reference?.selector ? String(reference.selector.value) : "",
    explanation: reference?.explanation ?? "",
    mode: reference?.state.mode ?? "current",
    type: context.link?.type ?? referenceFamilies(context)[0]?.[0] ?? "",
    pinLatest: false,
  };
}
export type ReferenceDraft = ReturnType<typeof initialReferenceDraft>;
export function canPinReference(context: ReferenceContext, draft: ReferenceDraft) {
  if (context.link?.reference?.state.mode === "pinned") return true;
  if (context.observation?.availability === "available") return true;
  const target = context.resources.find((r) => r.id === draft.resourceId);
  return Boolean(target?.resource && !target.resource.source);
}
function selectedState(context: ReferenceContext, draft: ReferenceDraft): ReferenceState {
  if (draft.mode === "current") return { mode: "current" };
  if (!draft.pinLatest && context.link?.reference?.state.mode === "pinned")
    return context.link.reference.state;
  if (context.observation?.availability === "available")
    return { mode: "pinned", observationId: context.observation.id };
  const target = context.resources.find((r) => r.id === draft.resourceId);
  if (target?.resource && !target.resource.source)
    return { mode: "pinned", revision: target.version };
  throw new Error("Observe this source before selecting a pinned state.");
}
export function referenceQualification(
  context: ReferenceContext,
  draft: ReferenceDraft,
): Reference {
  const previous = context.link?.reference?.selector;
  const selector = draft.scope
    ? previous && draft.scope === String(previous.value)
      ? previous
      : { kind: "section", value: draft.scope }
    : undefined;
  return {
    role: draft.role,
    explanation: draft.explanation,
    ...(selector ? { selector } : {}),
    state: selectedState(context, draft),
  };
}
export function referenceOperation(
  context: ReferenceContext,
  draft: ReferenceDraft,
  fields: Fields = context.link?.fields ?? {},
): Operation {
  const reference = referenceQualification(context, draft);
  if (context.link) {
    const link = context.link;
    return {
      op: "relationship.update",
      id: link.id,
      expectedVersion: link.version,
      input: {
        type: link.type,
        source: link.source,
        target: link.target,
        fields,
        reference,
      },
    };
  }
  const target = context.resources.find((r) => r.id === draft.resourceId);
  return {
    op: "reference.create",
    input: {
      type: draft.type,
      source: context.source.id,
      sourceVersion: context.source.version,
      ...(target
        ? { target: target.id, targetVersion: target.version }
        : {
            resource: {
              label: draft.label,
              source: { system: "file", externalId: draft.sourceId },
            },
          }),
      fields,
      reference,
    },
  };
}
