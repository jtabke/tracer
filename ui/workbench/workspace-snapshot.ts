import type {
  Entity,
  Relationship,
  Revision,
  Changeset,
  SchemaObject,
} from "../../src/core/model.ts";
import type { ProjectSnapshot } from "../../src/core/project-snapshot.ts";

export type WorkspaceEntity = Entity & { key: string; title: string; statement: string };
export type WorkspaceRelationship = Relationship & { scope: string };
type RevisionMetadata = Omit<Revision, "kind" | "snapshot">;
export type WorkspaceRevision = RevisionMetadata &
  (
    | { kind: "entity"; snapshot: WorkspaceEntity | null }
    | { kind: "relationship"; snapshot: WorkspaceRelationship | null }
    | { kind: "schema"; snapshot: SchemaObject | null }
  );

// One presentation adapter for exported fixtures and native reads. Never mutate native records.
export function projectWorkspace(
  snapshot: ProjectSnapshot,
  revisions: Revision[],
  changesets: Changeset[],
  preferredRoot?: string,
) {
  const names = new Map(snapshot.entities.map((entity) => [entity.id, entity.key ?? entity.id]));
  // Deleted endpoints still need readable identities in historical relationship snapshots.
  for (const revision of revisions)
    if (revision.kind === "entity" && revision.snapshot) {
      const entity = revision.snapshot as Entity;
      names.set(entity.id, entity.key ?? entity.id);
    }
  const entity = (value: Entity) => ({
    ...value,
    key: value.key ?? value.id,
    title: String(value.fields.title ?? value.resource?.label ?? value.key ?? value.id),
    statement: String(value.fields.statement ?? ""),
  });
  const link = (value: Relationship) => ({
    ...value,
    source: names.get(value.source) ?? value.source,
    target: names.get(value.target) ?? value.target,
    scope: String(value.fields.scope ?? ""),
  });
  const relationships = snapshot.relationships.map(link);
  const { root, keys } = initialTrace(snapshot.entities, relationships, preferredRoot);
  return {
    schema: snapshot.schema ?? { version: 0, entityTypes: {}, relationshipTypes: {} },
    snapshotReference: { revision: snapshot.projectRevision, historicalSnapshotsLoaded: true },
    entities: snapshot.entities.map(entity),
    relationships,
    revisions: [...revisions]
      .sort((a, b) => a.projectRevision - b.projectRevision || a.ordinal - b.ordinal)
      .map((entry): WorkspaceRevision => {
        switch (entry.kind) {
          case "entity":
            return {
              ...entry,
              kind: "entity",
              snapshot: entry.snapshot ? entity(entry.snapshot as Entity) : null,
            };
          case "relationship":
            return {
              ...entry,
              kind: "relationship",
              snapshot: entry.snapshot ? link(entry.snapshot as Relationship) : null,
            };
          case "schema":
            return { ...entry, kind: "schema", snapshot: entry.snapshot as SchemaObject | null };
        }
      }),
    changesets: [...changesets].sort((a, b) => a.projectRevision - b.projectRevision),
    trace: {
      root,
      keys,
      links: relationships.filter(
        (value) => keys.includes(value.source) && keys.includes(value.target),
      ),
    },
  };
}

function initialTrace(
  entities: Entity[],
  relationships: { source: string; target: string }[],
  preferredRoot?: string,
) {
  const entityKeys = entities.map((value) => value.key ?? value.id);
  if (entityKeys.includes("PRS-01"))
    return {
      root: "PRS-01",
      keys: ["PRS-01", "SYS-03", "SYS-04", "SYS-09", "SYS-10", "VER-03"].filter((key) =>
        entityKeys.includes(key),
      ),
    };
  const root = preferredRoot ?? entityKeys[0] ?? "";
  const keys = root ? [root] : [];
  for (let index = 0; index < keys.length && keys.length < 8; index++) {
    const neighbors = relationships.flatMap((value) => {
      if (value.source === keys[index]) return [value.target];
      if (value.target === keys[index]) return [value.source];
      return [];
    });
    for (const next of neighbors) if (!keys.includes(next) && keys.length < 8) keys.push(next);
  }
  return { root, keys };
}
