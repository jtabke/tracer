import type { Changeset, Fields, Json } from "../../src/core/model.ts";
import type {
  WorkspaceEntity,
  WorkspaceRelationship,
  WorkspaceRevision,
} from "./workspace-snapshot.ts";
import { typeName } from "./presentation.ts";

type History = {
  revisions: WorkspaceRevision[];
  changesets: Pick<Changeset, "projectRevision" | "reason">[];
};
type Event = { revision: number; title: string; detail: string; key?: string };
type Snapshot = WorkspaceRevision["snapshot"];
type FieldDiff = { key: string; before: Json | undefined; after: Json | undefined };
const identity = (entry: WorkspaceRevision) => `${entry.kind}:${entry.id}`;

export function snapshotAt(data: Pick<History, "revisions">, revision: number) {
  const records = new Map<string, WorkspaceEntity>();
  const links = new Map<string, WorkspaceRelationship>();
  for (const entry of data.revisions) {
    if (entry.projectRevision > revision) break;
    if (entry.kind === "entity") {
      if (entry.snapshot) records.set(entry.id, entry.snapshot);
      else records.delete(entry.id);
    } else if (entry.kind === "relationship") {
      if (entry.snapshot) links.set(entry.id, entry.snapshot);
      else links.delete(entry.id);
    }
  }
  return {
    records: new Map([...records.values()].map((record) => [record.key, record])),
    links: [...links.values()],
  };
}
function selectedHistoryEntry(entry: WorkspaceRevision, selected: string) {
  if (entry.kind === "entity") return entry.snapshot?.key === selected;
  if (entry.kind === "relationship")
    return entry.snapshot?.source === selected || entry.snapshot?.target === selected;
  return false;
}
export function significantEvents(data: History, selected: string | null = null): Event[] {
  const revisions = selected
    ? data.revisions.filter((entry) => selectedHistoryEntry(entry, selected))
    : data.revisions;
  const entityAdds = revisions.filter((entry) => entry.kind === "entity" && entry.version === 1);
  const linkAdds = revisions.filter(
    (entry) => entry.kind === "relationship" && entry.version === 1,
  );
  const events: Event[] = [];
  if (!selected)
    events.push({
      revision: 1,
      title: "Model defined",
      detail: "Project-owned types and relationship rules",
    });
  const lastEntity = entityAdds.at(-1),
    lastLink = linkAdds.at(-1);
  if (lastEntity)
    events.push({
      revision: lastEntity.projectRevision,
      title: selected ? `${selected} created` : `${entityAdds.length} artifacts created`,
      detail: "End of initial record creation",
    });
  if (lastLink)
    events.push({
      revision: lastLink.projectRevision,
      title: `${linkAdds.length} connections recorded`,
      detail: selected
        ? `Incoming and outgoing links for ${selected}`
        : "End of initial relationship creation",
    });
  const changesets = new Map(data.changesets.map((change) => [change.projectRevision, change]));
  for (const entry of revisions.filter((entry) => entry.version > 1)) {
    const key = entry.kind === "entity" ? entry.snapshot?.key : undefined;
    const type = entry.kind !== "schema" ? entry.snapshot?.type : undefined;
    events.push({
      revision: entry.projectRevision,
      title: `${key ?? typeName(type ?? entry.kind)} updated`,
      key,
      detail: changesets.get(entry.projectRevision)?.reason ?? "Native revision",
    });
  }
  return events.sort((a, b) => a.revision - b.revision);
}
function snapshotFields(snapshot: Snapshot | undefined): Fields {
  return snapshot && "fields" in snapshot ? snapshot.fields : {};
}
function fieldDiff(before: Snapshot | undefined, after: Snapshot): FieldDiff[] {
  const previous = snapshotFields(before),
    next = snapshotFields(after);
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])]
    .filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]))
    .map((key) => ({ key, before: previous[key], after: next[key] }));
}
function relationshipDiff(before: Snapshot | undefined, after: Snapshot): FieldDiff[] {
  if (!before || !after || !("source" in before) || !("source" in after)) return [];
  // Preserve the existing endpoint-first display order (target, type, source).
  return (["source", "type", "target"] as const)
    .filter((key) => before[key] !== after[key])
    .map((key) => ({ key, before: before[key], after: after[key] }))
    .reverse();
}
export function diffAt(data: Pick<History, "revisions">, revision: number) {
  // Index the preceding state once. Every object in one changeset compares with
  // the prior revision, even when that changeset contains multiple operations.
  const previous = new Map<string, Snapshot>();
  for (const entry of data.revisions) {
    if (entry.projectRevision >= revision) break;
    previous.set(identity(entry), entry.snapshot);
  }
  return data.revisions
    .filter((entry) => entry.projectRevision === revision)
    .map((entry) => {
      const before = previous.get(identity(entry)),
        after = entry.snapshot;
      const fields = fieldDiff(before, after);
      if (entry.kind === "relationship") fields.unshift(...relationshipDiff(before, after));
      return { ...entry, before, after, fields };
    });
}
