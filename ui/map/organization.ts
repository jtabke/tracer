import {
  EDGE_LIMIT,
  PAGE_SIZE,
  bundleLinks,
  entityAt,
  modelProjection,
  sortedRecords,
  typeNames,
} from "./model.ts";
import { medicalStageOrder } from "./presentation.ts";
import type {
  Directory,
  DirectoryGroup,
  Fixture,
  MapEntity,
  MapIndex,
  NodeDefinition,
  Organization,
  Projection,
  ProjectionOptions,
} from "./types.ts";

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
  return [
    { name: "All areas", count: index.entities.size },
    ...names.map((name) => ({
      name,
      count: [...index.entities.keys()].filter((id) => organization[id]?.areas.includes(name))
        .length,
    })),
    {
      name: "Uncategorized",
      count: [...index.entities.keys()].filter((id) => !organization[id]?.areas.length).length,
    },
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

export function directoryProjection(
  index: MapIndex,
  options: ProjectionOptions & { organization: Organization },
): Projection {
  const {
    organization,
    area = "All areas",
    folder = null,
    mode = "folders",
    revealed = [],
    showBoundary = false,
  } = options;
  const activeTypes = new Set(options.types),
    relations = new Set(options.relations);
  const full = buildDirectory(index, organization);
  const folderIds = folder ? new Set(full.groups.get(folder)?.members ?? []) : null;
  const scopeIds = [...index.entities.values()]
    .filter(
      (entity) =>
        activeTypes.has(entity.type) &&
        matchesArea(entity.id, organization, area) &&
        (!folderIds || folderIds.has(entity.id)),
    )
    .map((entity) => entity.id);
  const scope = new Set(scopeIds),
    pinned = new Set(revealed);
  const directory = buildDirectory(index, organization, scopeIds);
  const eligible = index.links.filter((link) => relations.has(link.type));
  const internal = eligible.filter((link) => scope.has(link.source) && scope.has(link.target));
  const boundary = eligible.filter((link) => scope.has(link.source) !== scope.has(link.target));
  const externalIds = new Set(
    boundary.flatMap((link) => [link.source, link.target]).filter((id) => !scope.has(id)),
  );
  const contextIds = new Set([...externalIds].filter((id) => showBoundary || pinned.has(id)));
  for (const id of pinned) if (index.entities.has(id) && !scope.has(id)) contextIds.add(id);
  const nodes: NodeDefinition[] = [],
    representative = new Map<string, string>(),
    expanded = new Set(options.expanded);
  let individualCount = 0,
    limitedGroups = 0;
  const contextCost =
    new Set([...contextIds].map((id) => entityAt(index, id).type)).size +
    [...contextIds].filter((id) => pinned.has(id)).length;
  const scopeBudget = 160 - contextCost;

  function appendSingleton(
    group: DirectoryGroup,
    parentId: string | undefined,
    members: MapEntity[],
  ) {
    if (!(members.length === 1 && (parentId || (index.byType.get(group.type) ?? []).length === 1)))
      return false;
    const entity = members[0];
    nodes.push({
      id: entity.id,
      kind: "item",
      entity,
      productContext: entity.type === "device",
      singletonContext: true,
      ...(parentId ? { parentId } : {}),
      showFolder: true,
      folderPath: organization[entity.id]?.path ?? ["Unfiled"],
    });
    representative.set(entity.id, entity.id);
    individualCount++;
    return true;
  }
  function prepareGroup(
    group: DirectoryGroup,
    members: MapEntity[],
    parentId: string | undefined,
    reserved: number,
  ) {
    const leaf = mode === "items" || !group.children.length || group.members.length <= PAGE_SIZE;
    const childGroups = displayFolderChildren(group);
    const records = leaf ? members : sortedRecords(index, group.directMembers ?? []);
    const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
    const page = Math.min(options.pages[group.key] ?? 0, pageCount - 1);
    const visible = new Set(
      records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((entity) => entity.id),
    );
    for (const entity of records) if (pinned.has(entity.id)) visible.add(entity.id);
    const cost =
      (leaf ? 0 : childGroups.length) + visible.size + (visible.size < records.length ? 1 : 0);
    const limited = expanded.has(group.key) && nodes.length + 1 + cost + reserved > scopeBudget;
    const open = expanded.has(group.key) && !limited;
    const node: NodeDefinition = {
      id: group.id,
      kind: "group",
      type: group.type,
      title: group.title,
      path: group.path,
      groupKey: group.key,
      open,
      total: members.length,
      page,
      pageCount,
      organization: true,
      budgetLimited: limited,
      childGroups: leaf ? 0 : childGroups.length,
      ...(parentId ? { parentId } : {}),
    };
    return { leaf, childGroups, records, visible, limited, open, node };
  }
  function appendRecords(group: DirectoryGroup, records: MapEntity[], visible: Set<string>) {
    for (const entity of records) {
      representative.set(entity.id, visible.has(entity.id) ? entity.id : `remainder:${group.key}`);
      if (visible.has(entity.id))
        nodes.push({
          id: entity.id,
          kind: "item",
          entity,
          parentId: group.id,
          showFolder: true,
          folderPath: organization[entity.id]?.path ?? [],
        });
    }
    individualCount += visible.size;
    if (visible.size < records.length)
      nodes.push({
        id: `remainder:${group.key}`,
        kind: "remainder",
        type: group.type,
        pageKey: group.key,
        parentId: group.id,
        count: records.length - visible.size,
      });
  }
  function appendChildren(
    group: DirectoryGroup,
    page: ReturnType<typeof prepareGroup>,
    reserved: number,
  ) {
    const { childGroups, records, visible } = page;
    for (const [i, child] of childGroups.entries())
      addGroup(
        child,
        group.id,
        reserved +
          childGroups.length -
          i -
          1 +
          visible.size +
          (visible.size < records.length ? 1 : 0),
      );
  }
  function addGroup(group: DirectoryGroup, parentId?: string, reserved = 0) {
    const members = sortedRecords(index, group.members);
    if (appendSingleton(group, parentId, members)) return;
    const page = prepareGroup(group, members, parentId, reserved);
    nodes.push(page.node);
    if (page.limited) limitedGroups++;
    if (!page.open) {
      for (const id of group.members) representative.set(id, group.id);
      return;
    }
    if (!page.leaf) appendChildren(group, page, reserved);
    appendRecords(group, page.records, page.visible);
  }
  function addScopeGroups() {
    if (folder) {
      const group = directory.groups.get(folder);
      if (group) addGroup(group);
    } else
      for (const [i, type] of options.types.entries()) {
        const root = directory.roots.get(type)!;
        if (area !== "All areas" && !root.members.length) continue;
        addGroup(root, undefined, options.types.length - i - 1);
      }
  }
  addScopeGroups();
  function addContextGroup(type: string) {
    const members = [...contextIds].filter((id) => entityAt(index, id).type === type);
    if (!members.length) return;
    if (members.length === 1) {
      const entity = entityAt(index, members[0]);
      nodes.push({
        id: entity.id,
        kind: "item",
        entity,
        external: true,
        showFolder: true,
        folderPath: organization[entity.id]?.path ?? [],
      });
      representative.set(entity.id, entity.id);
      individualCount++;
      return;
    }
    const id = `boundary:${type}`,
      visible = members.filter((member) => pinned.has(member));
    nodes.push({
      id,
      kind: "group",
      type,
      title: typeNames[type],
      external: true,
      organization: true,
      open: visible.length > 0,
      total: members.length,
      page: 0,
      pageCount: 1,
    });
    for (const member of members)
      representative.set(member, visible.includes(member) ? member : id);
    for (const member of visible)
      nodes.push({
        id: member,
        kind: "item",
        entity: entityAt(index, member),
        external: true,
        parentId: id,
      });
    individualCount += visible.length;
  }
  for (const type of Object.keys(index.fixture.schema.entityTypes)) addContextGroup(type);
  const drawnLinks = eligible.filter(
    (link) =>
      (scope.has(link.source) || scope.has(link.target)) &&
      representative.has(link.source) &&
      representative.has(link.target),
  );
  const edges = bundleLinks(drawnLinks, representative);
  if (area === "All areas" && !folder)
    edges.push(
      ...modelProjection(index, {
        types: options.types,
        relations: options.relations,
        expanded: [],
        pages: {},
      })
        .edges.filter((edge) => edge.allowed)
        .map((edge) => {
          const endpoint = (id: string) => {
            const type = id.startsWith("group:") ? id.slice(6) : null;
            const root = nodes.find((node) => node.singletonContext && node.entity?.type === type);
            return root?.id ?? id;
          };
          return { ...edge, source: endpoint(edge.source), target: endpoint(edge.target) };
        }),
    );
  return {
    nodes,
    edges: edges.slice(0, EDGE_LIMIT),
    stageOrder: medicalStageOrder,
    totalEdges: edges.length,
    scopeIds,
    scopedLinkIds: internal.map((link) => link.id),
    totalRecords: scopeIds.length,
    individualCount,
    scopedLinks: internal.length,
    outsideLinks: index.links.length - internal.length,
    boundaryLinks: boundary.length,
    boundaryRecords: externalIds.size,
    contextRecords: contextIds.size,
    omittedEdges: Math.max(0, edges.length - EDGE_LIMIT),
    omittedRecords: 0,
    limitedGroups,
  };
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
