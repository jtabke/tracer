import type { Transaction } from "./ports/repository.ts";
import type { ChangeImpact } from "../core/impact.ts";
import { impactNativeFromGraphs } from "./impact-graph.ts";
import type { ImpactGraphReader } from "./impact-graph.ts";
export { impactLimits } from "./impact-graph.ts";

function graph(tx: Transaction, revision?: number): ImpactGraphReader {
  return {
    getEntity: (id) =>
      revision === undefined ? tx.get("entity", id) : tx.getAt("entity", id, revision),
    getRelationship: (id) =>
      revision === undefined ? tx.get("relationship", id) : tx.getAt("relationship", id, revision),
    incident: (query) => tx.impactIncident({ ...query, atRevision: revision }),
  };
}
export function impactNative(tx: Transaction, scope: ChangeImpact["scope"], revision: number) {
  return impactNativeFromGraphs(graph(tx, revision), graph(tx), scope);
}
