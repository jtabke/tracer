import type { Fixture } from "./types.ts";

// Authored, fictional study organization. These assignments never modify fixture records.
export function studyOrganization(fixture: Fixture) {
  const explicit = new Map(
    Object.entries(fixture.authoredFolders ?? {}).flatMap(([path, keys]) =>
      keys.map((key) => [key, path.split("/")]),
    ),
  );
  // The small Aster example does not need a second folder level when an area
  // has just one subject in that item type. Keep real branching, and leave
  // explicitly authored studyFolder paths (including Connected study) intact.
  const subjects = new Map<string, Set<string>>();
  for (const entity of fixture.entities) {
    if (entity.studyFolder) continue;
    const path = explicit.get(entity.key.split(".")[0]);
    if (!path) continue;
    const key = `${entity.type}:${path[0]}`;
    if (!subjects.has(key)) subjects.set(key, new Set());
    subjects.get(key)!.add(path[1]);
  }
  return Object.fromEntries(
    fixture.entities.map((entity) => {
      if (fixture.studyOrganization?.[entity.id])
        return [entity.id, fixture.studyOrganization[entity.id]];
      let path = entity.studyFolder ?? explicit.get(entity.key.split(".")[0]) ?? ["Unfiled"];
      if (!entity.studyFolder && subjects.get(`${entity.type}:${path[0]}`)?.size === 1)
        path = path.slice(0, 1);
      const areas = entity.studyAreas ?? (path[0] === "Unfiled" ? [] : [path[0]]);
      return [entity.id, { path, areas }];
    }),
  );
}
