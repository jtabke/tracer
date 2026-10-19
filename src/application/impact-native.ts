import { ensure } from "../core/model.ts";
import type { Entity, Relationship } from "../core/model.ts";
import type { ChangeImpact, ImpactDelta, ImpactReachability } from "../core/impact.ts";
import type { Transaction } from "./ports/repository.ts";

export const impactLimits = { entities: 200, relationships: 600, incident: 200, inputs: 200 };
type Scope = ChangeImpact["scope"];
type Ids = { entities: Set<string>; relationships: Set<string> };
async function getEntity(tx: Transaction, id: string, revision?: number) {
  return (
    revision === undefined ? await tx.get("entity", id) : await tx.getAt("entity", id, revision)
  ) as Entity | undefined;
}
function addIdentity(ids: Set<string>, id: string, limit: number, kind: string) {
  ids.add(id);
  ensure(
    ids.size <= limit,
    "validation",
    `Impact context exceeds ${limit} ${kind}; reduce depth or narrow relationship types`,
  );
}
async function walk(
  tx: Transaction,
  scope: Scope,
  ids: Ids,
  revision?: number,
): Promise<ImpactReachability> {
  const root = await getEntity(tx, scope.rootId, revision);
  if (!root) return { paths: [], expandedIds: [], frontierIds: [] };
  addIdentity(ids.entities, root.id, impactLimits.entities, "entities");
  const paths = [{ entityId: root.id, depth: 0, relationshipIds: [] as string[] }];
  const seen = new Set([root.id]),
    expandedIds: string[] = [];
  for (let index = 0; index < paths.length; index++) {
    const current = paths[index];
    if (current.depth >= scope.depth) continue;
    const page = await tx.impactIncident({
      id: current.entityId,
      direction: scope.direction,
      relationshipTypes: scope.relationshipTypes,
      atRevision: revision,
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
        await getEntity(tx, next, revision),
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
async function deltas<T extends Entity | Relationship>(
  tx: Transaction,
  kind: "entity" | "relationship",
  ids: Set<string>,
  revision: number,
): Promise<ImpactDelta<T>[]> {
  const results: ImpactDelta<T>[] = [];
  for (const id of [...ids].sort()) {
    const before = (await tx.getAt(kind, id, revision)) as T | undefined;
    const after = (await tx.get(kind, id)) as T | undefined;
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
export async function impactNative(
  tx: Transaction,
  scope: Scope,
  revision: number,
): Promise<ChangeImpact["native"]> {
  const ids: Ids = { entities: new Set(), relationships: new Set() };
  const before = await walk(tx, scope, ids, revision),
    after = await walk(tx, scope, ids);
  ensure(
    ids.entities.has(scope.rootId),
    "not_found",
    "Impact root is absent from both native snapshots",
  );
  return {
    before,
    after,
    entities: await deltas<Entity>(tx, "entity", ids.entities, revision),
    relationships: await deltas<Relationship>(tx, "relationship", ids.relationships, revision),
  };
}
