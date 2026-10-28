import { ensure, type Relationship } from "../core/model.ts";
import type { Observation } from "../core/evidence.ts";
import type { Repository, Transaction } from "./ports/repository.ts";
async function selectedObservation(
  tx: Transaction,
  link: Relationship,
  latest: Observation | undefined,
) {
  const state = link.reference!.state;
  if (state.mode === "pinned" && "observationId" in state)
    return await tx.getEvidence("observation", state.observationId);
  return latest;
}
function externalDrift(selected: Observation | undefined, latest: Observation | undefined) {
  if (selected?.availability !== "available" || latest?.availability !== "available") return null;
  return selected.hash !== latest.hash;
}
export async function referenceContext(repository: Repository, id: string) {
  return repository.transaction(async (tx) => {
    const relationship = await tx.get("relationship", id);
    ensure(relationship?.reference, "not_found", "Qualified reference not found");
    const resource = await tx.get("entity", relationship.target);
    ensure(resource?.resource, "not_found", "Reference resource unavailable");
    const latest = await tx.latestEvidence("observation", resource.id);
    const selected = await selectedObservation(tx, relationship, latest);
    const state = relationship.reference.state;
    const native =
      state.mode === "pinned" && "revision" in state
        ? await tx.getRevision("entity", resource.id, state.revision)
        : undefined;
    const external = Boolean(resource.resource.source);
    return {
      relationship,
      resource,
      selectedObservation: selected ?? null,
      latestObservation: latest ?? null,
      nativeVersion: native?.version ?? resource.version,
      sourceChanged: external
        ? externalDrift(selected, latest)
        : Boolean(native && native.version !== resource.version),
      availability: external ? (selected?.availability ?? "unknown") : "available",
      contentRetention: external ? "external-content-not-retained" : "native-history",
      passage: relationship.reference.selector ? "unknown" : "whole-resource",
    };
  });
}
