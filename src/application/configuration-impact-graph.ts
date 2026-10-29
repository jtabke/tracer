import { ensure } from "../core/model.ts";
import type { Configuration } from "../core/configuration.ts";
import type { ImpactGraphReader } from "./impact-graph.ts";

/** Selected graph only; traversal chooses investigation scope, never configuration membership. */
export function configurationImpactGraph(value: Configuration): ImpactGraphReader {
  ensure(
    value.capture && value.relationships,
    "validation",
    "Pair assessment needs controlled scope and topology",
  );
  const entities = new Map(value.members.map((x) => [x.entity.id, x.entity]));
  const links = new Map(value.relationships.map((x) => [x.relationship.id, x.relationship]));
  return {
    getEntity: async (id) => entities.get(id),
    getRelationship: async (id) => links.get(id),
    incident: async (query) => {
      const selected = [...links.values()]
        .filter(
          (link) =>
            query.relationshipTypes.includes(link.type) &&
            ((query.direction !== "incoming" && link.source === query.id) ||
              (query.direction !== "outgoing" && link.target === query.id)),
        )
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      return {
        items: selected.slice(0, query.limit),
        ...(selected.length > query.limit ? { nextAfter: selected[query.limit - 1].id } : {}),
      };
    },
  };
}
