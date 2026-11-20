// Shared workspace adapter using native decoding, guards and mutation recovery.
import { connect, read } from "../api.ts";
import { createMutationController } from "../use-mutation.ts";
import type { ProjectSnapshot } from "../../src/core/project-snapshot.ts";
import { reconcileMutation } from "../reconcile-mutation.ts";
import type { Operation } from "../../src/application/commands.ts";
import type { Entity, Relationship, Revision } from "../../src/core/model.ts";
import { MAP_RECORD_LIMIT, MAP_CONNECTION_LIMIT } from "../../src/core/project-snapshot.ts";
import type { DemoGuide } from "../../src/interfaces/demo-guide.ts";
import { nativeFeed } from "./workspace-history.ts";
import type { WorkspaceData } from "./workspace-session.ts";
import { projectWorkspace } from "./workspace-snapshot.ts";
export let savedViews: import("../../src/core/presentation.ts").SavedView[] = [];
export let projectSnapshot: ProjectSnapshot;
export let projects: { id: string; title: string }[] = [];
let lastError: unknown;
export const mutations = createMutationController((error) => {
  lastError = error;
});
let guide: DemoGuide | null = null;
type PageSet = { entities: Entity[]; relationships: Relationship[] };
type PageCache = Map<string, Promise<PageSet>>;
let pages = new Map<number, PageCache>();
let sequence = 0;
let opening: WorkspaceData;
let windowSnapshot: ProjectSnapshot & { recent: Revision[] };
export function restoreWindow() {
  projectSnapshot = windowSnapshot;
}
export async function initialize() {
  await connect();
  [projects, guide] = await Promise.all([read("/api/projects", {}), read("/api/demo-guide", {})]);
  return load();
}
function checkHead(actual: number, expected: number) {
  if (actual !== expected)
    throw new Error("Project changed while reading. Refresh before editing.");
}
export async function load(
  ids: string[] = [],
  labels: string[] = [],
  expectedHead?: number,
): Promise<WorkspaceData> {
  const request = ++sequence;
  const keys = guide?.workspace?.keys ?? (guide?.tasks[0] ? [guide.tasks[0].root] : []);
  const [snapshot, views] = await Promise.all([
    read("/api/workspace-window", {
      keys: [...new Set([...labels, ...keys])].slice(0, 60),
      ids: [...new Set(ids)].slice(0, 60),
    }),
    read("/api/saved-views", {}),
  ]);
  if (expectedHead !== undefined) checkHead(snapshot.projectRevision, expectedHead);
  checkHead(await read("/api/workspace-clock", {}), snapshot.projectRevision);
  if (request !== sequence) throw new Error("Superseded workspace read");
  pages = new Map();
  savedViews = views;
  projectSnapshot = windowSnapshot = snapshot;
  opening = {
    ...projectWorkspace(snapshot, snapshot.recent, snapshot.changesets, keys[0], guide?.workspace),
    partial: snapshot.partial,
    projectWide: !snapshot.partial,
    modelRevision: snapshot.projectRevision,
  };
  opening.snapshotReference.historicalSnapshotsLoaded = false;
  return opening;
}
async function readPages(
  revision: number,
  kind: "entity" | "relationship",
  type?: string,
): Promise<PageSet> {
  const entities: Entity[] = [],
    relationships: Relationship[] = [];
  let after: string | undefined;
  do {
    const page = await read("/api/workspace-page", { revision, kind, type, after });
    entities.push(...page.entities);
    relationships.push(...page.relationships);
    if (entities.length > MAP_RECORD_LIMIT || relationships.length > MAP_CONNECTION_LIMIT)
      throw new Error(
        "Project view exceeds the bounded record or connection limit. Narrow the scope.",
      );
    after = page.nextAfter;
  } while (after);
  return { entities, relationships };
}
function part(revision: number, kind: "entity" | "relationship", type?: string) {
  // Retain the current head and at most one historical population.
  for (const at of pages.keys())
    if (at !== revision && at !== windowSnapshot.projectRevision) pages.delete(at);
  let cache = pages.get(revision);
  if (!cache) pages.set(revision, (cache = new Map()));
  const key = JSON.stringify([kind, type]);
  let value = cache.get(key);
  if (!value) {
    value = readPages(revision, kind, type).catch((error) => {
      cache!.delete(key);
      throw error;
    });
    cache.set(key, value);
  }
  return value;
}
export type ViewRequest = {
  revision: number;
  subject?: string;
  history?: boolean;
  limit: number;
  focusId?: string;
  scope: "opening" | "catalog" | "project" | "matrix";
  entityTypes: string[];
  linkTypes: string[];
};
async function catalogPopulation(
  base: ProjectSnapshot,
  revision: number,
  focusId?: string,
): Promise<PageSet> {
  const page = await part(revision, "entity");
  let relationships = base.relationships;
  if (focusId && !base.entities.some((entity) => entity.id === focusId)) {
    const neighborhood = await read("/api/workspace-window", { ids: [focusId] });
    checkHead(neighborhood.projectRevision, revision);
    relationships = [
      ...new Map(
        [...relationships, ...neighborhood.relationships].map((link) => [link.id, link]),
      ).values(),
    ];
  }
  return { entities: page.entities, relationships };
}
async function viewPopulation(base: ProjectSnapshot, request: ViewRequest): Promise<PageSet> {
  const { revision, scope } = request,
    current = revision === base.projectRevision;
  if (current && (opening.projectWide || scope === "opening")) return base;
  if (current && scope === "catalog") return catalogPopulation(base, revision, request.focusId);
  const types = (values: string[]) =>
    scope === "matrix" && current ? [...new Set(values)] : [undefined];
  const sets = await Promise.all([
    ...types(request.entityTypes).map((type) => part(revision, "entity", type)),
    ...types(request.linkTypes).map((type) => part(revision, "relationship", type)),
  ]);
  // Typed pages preserve the native order of links within each column. Add opening-only context last.
  if (current && scope === "matrix") sets.push(base);
  const entities = new Map<string, Entity>(),
    relationships = new Map<string, Relationship>();
  for (const page of sets) {
    for (const entity of page.entities) entities.set(entity.id, entity);
    for (const link of page.relationships) relationships.set(link.id, link);
  }
  if (entities.size > MAP_RECORD_LIMIT || relationships.size > MAP_CONNECTION_LIMIT)
    throw new Error(
      "Project view exceeds the bounded record or connection limit. Narrow the scope.",
    );
  return { entities: [...entities.values()], relationships: [...relationships.values()] };
}
async function readEvent(head: number, request: ViewRequest) {
  const query = { head, revision: request.revision, subject: request.subject };
  const result = await read("/api/workspace-event", {
    ...query,
    limit: Math.min(200, request.limit),
  });
  while (result.more && result.feed.length < request.limit) {
    const next = await read("/api/workspace-event", {
      ...query,
      before: result.feed.at(-1)!.projectRevision,
      limit: Math.min(200, request.limit - result.feed.length),
    });
    result.feed.push(...next.feed);
    result.more = next.more;
  }
  return result;
}
export async function readView(request: ViewRequest) {
  const base = windowSnapshot,
    start = opening,
    head = base.projectRevision;
  const [population, event] = await Promise.all([
    viewPopulation(base, request),
    (request.history || request.revision !== head) && request.revision > 0
      ? readEvent(head, request)
      : null,
  ]);
  checkHead(await read("/api/workspace-clock", {}), head);
  if (base !== windowSnapshot) throw new Error("Superseded workspace read");
  const snapshot = {
    ...population,
    projectRevision: head,
    schema: event ? event.schema : base.schema,
  };
  const revisions = new Map<string, Revision>();
  for (const r of [...base.recent, ...(event?.prior ?? []), ...(event?.entries ?? [])])
    revisions.set(r.revisionId, r);
  const data: WorkspaceData = {
    ...projectWorkspace(
      snapshot,
      [...revisions.values()],
      event && !start.changesets.some((x) => x.id === event.change.id)
        ? [...start.changesets, event.change]
        : start.changesets,
    ),
    trace: start.trace,
    modelRevision: request.revision,
    partial: request.revision === head && !start.projectWide && request.scope !== "project",
    projectWide: request.scope === "project" || start.projectWide,
    ...(event ? { feed: nativeFeed(event.feed), historyMore: event.more } : {}),
  };
  data.snapshotReference.historicalSnapshotsLoaded = false;
  return { data, current: request.revision === head ? snapshot : base };
}
export function installView(snapshot: ProjectSnapshot) {
  projectSnapshot = snapshot;
}
export async function save(expectedSchemaVersion: number, operations: Operation[]) {
  lastError = undefined;
  const result = await mutations.run("/api/changesets", { expectedSchemaVersion, operations });
  if (!result)
    throw (
      lastError ?? new Error("A save is pending. Inspect its outcome before making another change.")
    );
  return result;
}
export async function inspectAttempt() {
  const state = mutations.snapshot();
  if (state.status !== "unknown") return null;
  const finish = mutations.beginReconciliation();
  const results = await reconcileMutation(state.attempt.path, state.attempt.input);
  finish();
  return results;
}
