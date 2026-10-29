import { ensure } from "../core/model.ts";
import type { Entity, Relationship } from "../core/model.ts";
import type { ChangeImpact, ImpactDelta, ImpactReachability } from "../core/impact.ts";
import type { Page } from "../core/model.ts";

export type ImpactGraphReader = {
  getEntity(id: string): Promise<Entity | undefined>;
  getRelationship(id: string): Promise<Relationship | undefined>;
  incident(query: {
    id: string;
    direction: Scope["direction"];
    relationshipTypes: string[];
    limit: number;
  }): Promise<Page<Relationship>>;
};

export const impactLimits = { entities: 200, relationships: 600, incident: 200, inputs: 200 };
type Scope = ChangeImpact["scope"];
type Ids = { entities: Set<string>; relationships: Set<string> };
function addIdentity(ids: Set<string>, id: string, limit: number, kind: string) {
  ids.add(id);
  ensure(
    ids.size <= limit,
    "validation",
    `Impact context exceeds ${limit} ${kind}; reduce depth or narrow relationship types`,
  );
}
async function walk(graph: ImpactGraphReader, scope: Scope, ids: Ids): Promise<ImpactReachability> {
  const root = await graph.getEntity(scope.rootId);
  if (!root) return { paths: [], expandedIds: [], frontierIds: [] };
  addIdentity(ids.entities, root.id, impactLimits.entities, "entities");
  const paths = [{ entityId: root.id, depth: 0, relationshipIds: [] as string[] }];
  const seen = new Set([root.id]),
    expandedIds: string[] = [];
  for (let index = 0; index < paths.length; index++) {
    const current = paths[index];
    if (current.depth >= scope.depth) continue;
    const page = await graph.incident({
      id: current.entityId,
      direction: scope.direction,
      relationshipTypes: scope.relationshipTypes,
      limit: impactLimits.incident,
    });
    ensure(
      !page.nextAfter,
      "validation",
      `Impact entity ${current.entityId} exceeds ${impactLimits.incident} selected connections; narrow relationship types`,
    );
    expandedIds.push(current.entityId);
    for (const link of page.items) {
      addIdentity(ids.relationships, link.id, impactLimits.relationships, "connections");
      const next = link.source === current.entityId ? link.target : link.source;
      if (seen.has(next)) continue;
      ensure(
        await graph.getEntity(next),
        "referential_integrity",
        "Selected impact connection has an unavailable native endpoint",
      );
      addIdentity(ids.entities, next, impactLimits.entities, "entities");
      seen.add(next);
      paths.push({
        entityId: next,
        depth: current.depth + 1,
        relationshipIds: [...current.relationshipIds, link.id],
      });
    }
  }
  const expanded = new Set(expandedIds);
  return {
    paths,
    expandedIds,
    frontierIds: paths.filter((path) => !expanded.has(path.entityId)).map((path) => path.entityId),
  };
}
async function graphValue<T extends Entity | Relationship>(
  graph: ImpactGraphReader,
  kind: "entity" | "relationship",
  id: string,
) {
  return (kind === "entity" ? await graph.getEntity(id) : await graph.getRelationship(id)) as
    T | undefined;
}
async function deltas<T extends Entity | Relationship>(
  beforeGraph: ImpactGraphReader,
  afterGraph: ImpactGraphReader,
  kind: "entity" | "relationship",
  ids: Set<string>,
): Promise<ImpactDelta<T>[]> {
  const results: ImpactDelta<T>[] = [];
  for (const id of [...ids].sort()) {
    const before = await graphValue<T>(beforeGraph, kind, id);
    const after = await graphValue<T>(afterGraph, kind, id);
    results.push({
      id,
      before: before ?? null,
      after: after ?? null,
      state: !before
        ? "added"
        : !after
          ? "removed"
          : before.version === after.version
            ? "unchanged"
            : "modified",
    });
  }
  return results;
}
export async function impactNativeFromGraphs(
  beforeGraph: ImpactGraphReader,
  afterGraph: ImpactGraphReader,
  scope: Scope,
): Promise<ChangeImpact["native"]> {
  const ids: Ids = { entities: new Set(), relationships: new Set() };
  const before = await walk(beforeGraph, scope, ids),
    after = await walk(afterGraph, scope, ids);
  ensure(
    ids.entities.has(scope.rootId),
    "not_found",
    "Impact root is absent from both native snapshots",
  );
  return {
    before,
    after,
    entities: await deltas<Entity>(beforeGraph, afterGraph, "entity", ids.entities),
    relationships: await deltas<Relationship>(
      beforeGraph,
      afterGraph,
      "relationship",
      ids.relationships,
    ),
  };
}
