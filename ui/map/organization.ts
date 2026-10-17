import { PAGE_SIZE, entityAt, sortedRecords, typeNames } from "./model.ts";
import type { Directory, DirectoryGroup, MapIndex, Organization } from "./types.ts";

export function folderKey(type: string, path: string[] = []) {
  return path.length ? `folder:${encodeURIComponent([type, ...path].join("/"))}` : type;
}

export function buildDirectory(
  index: MapIndex,
  organization: Organization,
  ids: string[] = [...index.entities.keys()],
): Directory {
  const roots = new Map<string, DirectoryGroup>(),
    groups = new Map<string, DirectoryGroup>(),
    leaves = new Map<string, DirectoryGroup>();
  for (const type of Object.keys(index.fixture.schema.entityTypes)) {
    const root: DirectoryGroup = {
      key: type,
      id: `group:${type}`,
      type,
      path: [],
      title: typeNames[type] ?? type,
      members: [],
      children: [],
      directMembers: [],
    };
    roots.set(type, root);
    groups.set(type, root);
  }
  for (const id of ids) {
    const entity = index.entities.get(id);
    if (!entity) continue;
    let parent = roots.get(entity.type)!;
    parent.members.push(id);
    const assigned = organization[id]?.path ?? [];
    const path = assigned.length === 1 && assigned[0] === "Unfiled" ? [] : assigned;
    for (let depth = 1; depth <= path.length; depth++) {
      const part = path.slice(0, depth),
        key = folderKey(entity.type, part);
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          id: key,
          type: entity.type,
          path: part,
          title: part.at(-1)!,
          members: [],
          children: [],
          directMembers: [],
        };
        groups.set(key, group);
        parent.children.push(group);
      }
      group.members.push(id);
      parent = group;
    }
    parent.directMembers.push(id);
    leaves.set(id, parent);
  }
  for (const group of groups.values())
    group.children.sort((a, b) => a.title.localeCompare(b.title));
  return { roots, groups, leaves };
}

// Skip pass-through folders in presentation while retaining the full authored path.
export function displayFolderChildren(group: DirectoryGroup) {
  return group.children.map((child) => {
    let target = child;
    while (target.children.length === 1 && !target.directMembers.length)
      target = target.children[0];
    return { ...target, title: target.path.slice(group.path.length).join(" / ") };
  });
}

export function areaChoices(index: MapIndex, organization: Organization) {
  const names = [...new Set(Object.values(organization).flatMap((value) => value.areas))].sort();
  const counts = new Map<string, number>();
  let uncategorized = 0;
  for (const id of index.entities.keys()) {
    const areas = organization[id]?.areas ?? [];
    if (!areas.length) uncategorized++;
    for (const area of new Set(areas)) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [
    { name: "All areas", count: index.entities.size },
    ...names.map((name) => ({ name, count: counts.get(name) ?? 0 })),
    { name: "Uncategorized", count: uncategorized },
  ];
}

export function matchesArea(id: string, organization: Organization, area: string) {
  return (
    area === "All areas" ||
    (area === "Uncategorized"
      ? !organization[id]?.areas.length
      : organization[id]?.areas.includes(area))
  );
}

export function revealInDirectory(
  index: MapIndex,
  organization: Organization,
  ids: string[],
  expanded: string[],
  pages: Record<string, number>,
) {
  const tree = buildDirectory(index, organization),
    next = new Set(expanded),
    nextPages = { ...pages };
  for (const id of ids) {
    const entity = index.entities.get(id);
    if (!entity) continue;
    const leaf = tree.leaves.get(id)!;
    next.add(entity.type);
    for (let length = 1; length <= leaf.path.length; length++)
      next.add(folderKey(entity.type, leaf.path.slice(0, length)));
    const ordered = [...leaf.directMembers].sort((a, b) =>
      entityAt(index, a).key.localeCompare(entityAt(index, b).key),
    );
    nextPages[leaf.key] = Math.floor(ordered.indexOf(id) / PAGE_SIZE);
  }
  return { expanded: [...next], pages: nextPages };
}

export function areaRecords(
  index: MapIndex,
  organization: Organization,
  area: string,
  ids: string[] = [],
) {
  return sortedRecords(
    index,
    ids.filter((id) => matchesArea(id, organization, area)),
  );
}
