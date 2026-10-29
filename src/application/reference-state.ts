import type { Entity, Relationship } from "../core/model.ts";
import type { Observation, InputReferenceUse } from "../core/evidence.ts";
import type { Transaction } from "./ports/repository.ts";

type SelectedReferenceState = {
  entity: Entity | undefined;
  observation: Observation | null;
  selection: InputReferenceUse["selection"];
  reason?: string;
};
function unavailable(reason: string): SelectedReferenceState {
  return { entity: undefined, observation: null, selection: "unavailable", reason };
}
/** Resolve an explicitly selected reference, never discover another resource or observe bytes. */
export async function selectedReferenceState(
  tx: Transaction,
  link: Relationship | undefined,
  resource: Entity | undefined,
  observation: Observation | null,
  facet: "native" | "content",
): Promise<SelectedReferenceState> {
  if (!resource?.resource) return unavailable("Referenced resource is not selected or unavailable");
  if (!link?.reference || link.target !== resource.id)
    return unavailable(
      "Selected qualifying reference is missing, unqualified or targets another resource",
    );
  if ((facet === "content") !== Boolean(resource.resource.source))
    return unavailable("Reference-selected content is incompatible with the declared input facet");
  const state = link.reference.state;
  if (state.mode === "current")
    return {
      entity: resource,
      observation: facet === "content" ? observation : null,
      selection: "resource-default",
    };
  return "observationId" in state
    ? pinnedObservationState(tx, resource, facet, state.observationId)
    : pinnedNativeState(tx, resource, facet, state.revision);
}
async function pinnedObservationState(
  tx: Transaction,
  resource: Entity,
  facet: "native" | "content",
  id: string,
): Promise<SelectedReferenceState> {
  if (facet !== "content")
    return unavailable("An observed reference cannot select native annotation content");
  const selected = await tx.getEvidence("observation", id);
  if (!selected || selected.entityId !== resource.id)
    return unavailable("Pinned reference observation is missing or belongs to another resource");
  return { entity: resource, observation: selected, selection: "pinned-observation" };
}
async function pinnedNativeState(
  tx: Transaction,
  resource: Entity,
  facet: "native" | "content",
  version: number,
): Promise<SelectedReferenceState> {
  if (facet !== "native")
    return unavailable("A native reference revision cannot select observed content");
  const revision = await tx.getRevision("entity", resource.id, version),
    selected = revision?.snapshot;
  if (!selected || !("fields" in selected) || "source" in selected || selected.id !== resource.id)
    return unavailable("Pinned native reference revision is unavailable");
  return { entity: selected as Entity, observation: null, selection: "pinned-revision" };
}
