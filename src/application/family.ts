import { ensure, record } from "../core/model.ts";
import type { Entity, Relationship, SchemaObject } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";
import type { FamilyQuery, FamilyWorkspace } from "./views.ts";

function validateFamilyQuery(schema: SchemaObject, query: FamilyQuery) {
  ensure(
    record(query) &&
      Object.keys(query).every((key) =>
        ["rootId", "relationshipType", "direction", "after", "limit"].includes(key),
      ) &&
      typeof query.rootId === "string" &&
      query.rootId.length > 0 &&
      [query.relationshipType, query.after].every(
        (value) => value === undefined || typeof value === "string",
      ),
    "validation",
    "Invalid family query",
  );
  const limit = query.limit ?? 12;
  ensure(
    Number.isSafeInteger(limit) && limit > 0 && limit <= 20,
    "validation",
    "Family limit must be 1–20",
  );
  validateFamilySelection(schema, query);
  return limit;
}

function validateFamilySelection(schema: SchemaObject, query: FamilyQuery) {
  ensure(
    query.direction === undefined || ["incoming", "outgoing"].includes(query.direction),
    "validation",
    "Choose incoming or outgoing",
  );
  ensure(
    query.relationshipType !== undefined || query.after === undefined,
    "validation",
    "Family cursor needs a relationship type",
  );
  ensure(
    query.relationshipType === undefined ||
      Object.hasOwn(schema.relationshipTypes, query.relationshipType),
    "validation",
    "Unknown family relationship",
  );
}

async function loadMemberConnections(
  tx: Transaction,
  member: Entity,
  perMember: number,
  nodes: Map<string, Entity>,
  links: Map<string, Relationship>,
) {
  const incident = await tx.query("relationship", { incident: member.id, limit: perMember });
  const total = await tx.connectionCount(member.id);
  for (const link of incident.items as Relationship[]) {
    links.set(link.id, link);
    for (const id of [link.source, link.target]) {
      if (nodes.has(id)) continue;
      const entity = await tx.get("entity", id);
      ensure(entity, "referential_integrity", "Connected item is unavailable");
      nodes.set(id, entity);
    }
  }
  return { entityId: member.id, total, loaded: incident.items.length };
}

/** One snapshot; at most 20 membership edges and 200 incident links across its members. */
export async function familyWorkspace(
  tx: Transaction,
  schema: SchemaObject,
  query: FamilyQuery,
): Promise<FamilyWorkspace> {
  const limit = validateFamilyQuery(schema, query);
  const root = await tx.get("entity", query.rootId);
  ensure(root, "not_found", "Family root no longer exists");
  const incoming = query.direction === "incoming";
  const page =
    query.relationshipType === undefined
      ? { items: [] as Relationship[], nextAfter: undefined }
      : await tx.query("relationship", {
          type: query.relationshipType,
          ...(incoming ? { target: root.id } : { source: root.id }),
          after: query.after,
          limit,
        });
  const membership = page.items as Relationship[];
  const members = new Map<string, Entity>();
  if (query.relationshipType === undefined) members.set(root.id, root);
  for (const link of membership) {
    const id = incoming ? link.source : link.target;
    const entity = await tx.get("entity", id);
    ensure(entity, "referential_integrity", "Family member is unavailable");
    members.set(id, entity);
  }
  const nodes = new Map<string, Entity>([[root.id, root], ...members]);
  const links = new Map<string, Relationship>();
  const connections: FamilyWorkspace["connections"] = [];
  const perMember = Math.floor(200 / Math.max(1, members.size));
  for (const member of members.values()) {
    connections.push(await loadMemberConnections(tx, member, perMember, nodes, links));
  }
  return {
    schema,
    projectRevision: await tx.headRevision(),
    root,
    members: [...members.values()],
    membership,
    nextAfter: page.nextAfter,
    connections,
    nodes: [...nodes.values()],
    links: [...links.values()],
  };
}
