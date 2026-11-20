import { ensure } from "../core/model.ts";
import type { Entity, Relationship, Revision } from "../core/model.ts";
import type { Transaction } from "./ports/repository.ts";
import { queryShape, validatePageLimit } from "./native-query-support.ts";
import { nativeTimeline } from "./temporal.ts";

export type WindowQuery = { keys?: string[]; ids?: string[] };
export type WorkspacePage = {
  revision: number;
  kind: "entity" | "relationship";
  type?: string;
  after?: string;
};
export type EventQuery = {
  head: number;
  revision: number;
  subject?: string;
  before?: number;
  limit?: number;
};

async function focusNodes(tx: Transaction, query: WindowQuery, first: Entity[]) {
  const nodes = new Map<string, Entity>();
  for (const key of query.keys ?? []) {
    const item = (await tx.query("entity", { key, limit: 1 })).items[0] as Entity | undefined;
    if (item) nodes.set(item.id, item);
  }
  for (const id of query.ids ?? []) {
    const item = await tx.get("entity", id);
    if (item) nodes.set(item.id, item);
  }
  if (!nodes.size && first.length) nodes.set(first[0].id, first[0]);
  return nodes;
}
async function neighborhood(tx: Transaction, query: WindowQuery, first: Entity[]) {
  const nodes = await focusNodes(tx, query, first);
  const links = new Map<string, Relationship>();
  const queue = [...nodes.keys()];
  // Bound both the native reads and wire payload, independently of total project size.
  for (let i = 0; i < Math.min(16, queue.length) && links.size < 256; i++) {
    const incident = await tx.query("relationship", {
      incident: queue[i],
      limit: Math.min(128, 256 - links.size),
    });
    for (const link of incident.items as Relationship[]) {
      links.set(link.id, link);
      const id = link.source === queue[i] ? link.target : link.source;
      if (!nodes.has(id)) {
        const item = await tx.get("entity", id);
        ensure(item, "referential_integrity", "Missing connection endpoint");
        nodes.set(id, item);
        queue.push(id);
      }
    }
  }
  return { entities: [...nodes.values()], relationships: [...links.values()], partial: true };
}

/** A bounded first view and its clock/identity in one SQLite snapshot. Tiny projects already fit the window. */
export async function workspaceWindow(tx: Transaction, query: WindowQuery) {
  queryShape(query, ["keys", "ids"], "Invalid workspace focus");
  for (const values of [query.keys, query.ids])
    ensure(
      values === undefined ||
        (Array.isArray(values) &&
          values.length <= 60 &&
          values.every((v) => typeof v === "string")),
      "validation",
      "Invalid workspace focus",
    );
  const page = await tx.query("entity", { limit: 32 });
  const first = page.items as Entity[];
  const edges = !page.nextAfter
    ? await tx.orderedRelationships(undefined, { limit: 128 })
    : undefined;
  const scope =
    edges && !edges.nextAfter
      ? { entities: first, relationships: edges.items as Relationship[], partial: false }
      : await neighborhood(tx, query, first);
  const timeline = await nativeTimeline(tx);
  const earliest = await tx.changesets(0, 1);
  const changesets =
    timeline.items[0]?.id === earliest[0]?.id ? timeline.items : [...earliest, ...timeline.items];
  const recent: Revision[] = [];
  for (const entity of scope.entities.slice(0, 8)) {
    for (let v = Math.max(1, entity.version - 1); v <= entity.version; v++) {
      const revision = await tx.getRevision("entity", entity.id, v);
      if (revision) recent.push(revision);
    }
  }
  return {
    ...scope,
    schema: (await tx.get("schema", "project")) ?? null,
    projectRevision: timeline.head,
    changesets,
    recent,
  };
}

/** Every continuation names an immutable native revision, including when head moves mid-page. */
export async function workspacePage(
  tx: Transaction,
  query: WorkspacePage,
): Promise<{ entities: Entity[]; relationships: Relationship[]; nextAfter?: string }> {
  queryShape(query, ["revision", "kind", "type", "after"], "Invalid workspace page");
  const head = await tx.headRevision();
  ensure(
    (query.kind === "entity" || query.kind === "relationship") &&
      (query.after === undefined || typeof query.after === "string") &&
      (query.type === undefined || typeof query.type === "string"),
    "validation",
    "Invalid workspace page",
  );
  ensure(
    Number.isSafeInteger(query.revision) && query.revision >= 0 && query.revision <= head,
    "validation",
    "Invalid workspace revision",
  );
  const filters = { after: query.after, type: query.type, limit: 1000 };
  if (query.kind === "relationship") {
    const page = await tx.orderedRelationships(
      query.revision === head ? undefined : query.revision,
      filters,
    );
    return { entities: [], relationships: page.items, nextAfter: page.nextAfter };
  }
  const page =
    query.revision === head
      ? await tx.query(query.kind, filters)
      : await tx.queryAt(query.kind, query.revision, filters);
  return {
    entities: page.items as Entity[],
    relationships: [],
    nextAfter: page.nextAfter,
  };
}

async function eventVersions(tx: Transaction, at: number) {
  const entries: Revision[] = [],
    prior: Revision[] = [];
  const seen = new Set<string>();
  let after: string | undefined;
  do {
    const page = await tx.history({ atRevision: at, limit: 1000, after });
    for (const entry of page.items) {
      entries.push(entry);
      if (!seen.has(entry.id) && entry.version > 1) {
        const previous = await tx.getRevision(entry.kind, entry.id, entry.version - 1);
        if (previous) prior.push(previous);
      }
      seen.add(entry.id);
    }
    ensure(
      entries.length <= 10000,
      "validation",
      "Changeset exceeds 10,000 detail entries; inspect paged native history",
    );
    after = page.nextAfter;
  } while (after);
  return { entries, prior };
}

export async function workspaceEvent(tx: Transaction, query: EventQuery) {
  queryShape(query, ["head", "revision", "subject", "before", "limit"], "Invalid history page");
  ensure(
    query.subject === undefined || typeof query.subject === "string",
    "validation",
    "Invalid history subject",
  );
  const head = await tx.headRevision();
  ensure(query.head === head, "conflict", "Project changed while reading. Refresh before editing.");
  const at = query.revision,
    before = query.before ?? head + 1,
    limit = query.limit ?? 30;
  ensure(
    Number.isSafeInteger(at) &&
      at > 0 &&
      at <= head &&
      Number.isSafeInteger(before) &&
      before > 0 &&
      before <= head + 1,
    "validation",
    "Invalid history page",
  );
  validatePageLimit(limit, 200, "History page limit must be 1–200");
  const change = (await tx.changesets(at - 1, 1))[0];
  ensure(change?.projectRevision === at, "validation", "Native revision does not exist");
  const first = await tx.changeFeed(before, limit + 1, query.subject);
  const detail = await eventVersions(tx, at);
  const schema = (await tx.getAt("schema", "project", at)) ?? null;
  return {
    change,
    schema,
    feed: first.slice(0, limit),
    more: first.length > limit,
    ...detail,
  };
}
