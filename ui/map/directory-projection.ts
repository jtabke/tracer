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
import { buildDirectory, displayFolderChildren, matchesArea } from "./organization.ts";
import type {
  DirectoryGroup,
  MapEntity,
  MapIndex,
  NodeDefinition,
  Organization,
  Projection,
  ProjectionOptions,
} from "./types.ts";

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
