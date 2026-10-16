import type { Entity, Relationship, Revision, Changeset } from "../../../src/core/model.ts";
import type { ProjectSnapshot } from "../../../src/core/project-snapshot.ts";

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
    title: String(value.fields.title ?? value.key ?? value.id),
    statement: String(value.fields.statement ?? ""),
  });
  const link = (value: Relationship) => ({
    ...value,
    source: names.get(value.source) ?? value.source,
    target: names.get(value.target) ?? value.target,
    scope: String(value.fields.scope ?? ""),
  });
  const relationships = snapshot.relationships.map(link);
  const entityKeys = snapshot.entities.map((value) => value.key ?? value.id);
  const root = entityKeys.includes("PRS-01") ? "PRS-01" : (preferredRoot ?? entityKeys[0]);
  const keys = entityKeys.includes("PRS-01")
    ? ["PRS-01", "SYS-03", "SYS-04", "SYS-09", "SYS-10", "VER-03"].filter((key) =>
        entityKeys.includes(key),
      )
    : [root];
  if (root !== "PRS-01")
    for (let index = 0; index < keys.length && keys.length < 8; index++)
      for (const value of relationships) {
        const next =
          value.source === keys[index]
            ? value.target
            : value.target === keys[index]
              ? value.source
              : null;
        if (next && !keys.includes(next) && keys.length < 8) keys.push(next);
      }
  return {
    schema: snapshot.schema,
    snapshotReference: { revision: snapshot.projectRevision, historicalSnapshotsLoaded: true },
    entities: snapshot.entities.map(entity),
    relationships,
    revisions: [...revisions]
      .sort((a, b) => a.projectRevision - b.projectRevision || a.ordinal - b.ordinal)
      .map((entry) => ({
        ...entry,
        snapshot: !entry.snapshot
          ? null
          : entry.kind === "entity"
            ? entity(entry.snapshot as Entity)
            : entry.kind === "relationship"
              ? link(entry.snapshot as Relationship)
              : entry.snapshot,
      })),
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
