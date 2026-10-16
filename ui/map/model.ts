import { medicalStageOrder } from "./presentation.ts";
import type {
  EdgeDefinition,
  Fixture,
  MapEntity,
  MapIndex,
  MapLink,
  NodeDefinition,
  Projection,
  ProjectionOptions,
  TraceOptions,
} from "./types.ts";

export const PAGE_SIZE = 5;
export const TRACE_LIMIT = 30;
export const EDGE_LIMIT = 250;

const medicalNames: Record<string, string> = {
  device: "Product",
  user_need: "User needs",
  product_requirement: "Product requirements",
  subsystem_requirement: "Subsystem requirements",
  component_requirement: "Component requirements",
  design_output: "Design outputs",
  verification_protocol: "Verification plans",
  validation_protocol: "Validation plans",
  test_run: "Recorded runs",
  risk: "Risks",
  risk_control: "Risk controls",
  design_change: "Design changes",
  evaluation_configuration: "Evaluation configurations",
};

export const typeNames = new Proxy(medicalNames, {
  get(target, key) {
    return (
      (typeof key === "string" ? target[key] : undefined) ??
      (typeof key === "string"
        ? key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
        : undefined)
    );
  },
});

export function indexFixture(fixture: Fixture): MapIndex {
  const entities = new Map(fixture.entities.map((e) => [e.id, e]));
  const byType = new Map<string, MapEntity[]>(
    Object.keys(fixture.schema.entityTypes).map((type) => [type, []]),
  );
  for (const entity of fixture.entities) byType.get(entity.type)!.push(entity);
  for (const list of byType.values()) list.sort((a, b) => a.key.localeCompare(b.key));
  const links = fixture.relationships.map((link) => {
    const source = entities.get(link.source),
      target = entities.get(link.target);
    if (!source || !target) throw new Error(`Missing endpoint for ${link.id}`);
    const route = fixture.schema.relationshipTypes[link.type]?.workflow?.find(
      (path) => path.source === source.type && path.target === target.type,
    );
    return {
      ...link,
      nativeSource: link.source,
      nativeTarget: link.target,
      source: route?.direction === "reverse" ? link.target : link.source,
      target: route?.direction === "reverse" ? link.source : link.target,
      label: route?.direction === "reverse" ? route.label : link.type.replaceAll("_", " "),
    };
  });
  return {
    fixture,
    entities,
    byType,
    links,
    linkById: new Map(links.map((link) => [link.id, link])),
    byEntity: indexEntityLinks(links),
  };
}

export function searchItems(
  index: MapIndex,
  query: string,
  limit: number = 8,
  options: { type?: string; offset?: number } = {},
) {
  const q = query.trim().toLowerCase();
  if (!q) return { total: 0, items: [] };
  const matches = [...index.entities.values()].filter(
    (e) =>
      (!options.type || e.type === options.type) &&
      `${e.key} ${e.fields.title} ${e.fields.statement}`.toLowerCase().includes(q),
  );
  matches.sort((a, b) => a.key.localeCompare(b.key));
  const offset = Math.max(0, options.offset ?? 0);
  return { total: matches.length, items: matches.slice(offset, offset + limit) };
}

export function bundleLinks(links: MapLink[], representative: Map<string, string>) {
  const bundles = new Map<string, EdgeDefinition>();
  for (const link of links) {
    const source = representative.get(link.source),
      target = representative.get(link.target);
    if (!source || !target) continue;
    const id = JSON.stringify([source, target, link.type]);
    let bundle = bundles.get(id);
    if (!bundle) {
      bundle = {
        id,
        source,
        target,
        type: link.type,
        label: link.label,
        linkIds: [],
        allowed: false,
      };
      bundles.set(id, bundle);
    }
    bundle.linkIds.push(link.id);
  }
  return [...bundles.values()];
}

export function modelProjection(index: MapIndex, options: ProjectionOptions): Projection {
  const activeTypes = new Set(options.types),
    activeRelations = new Set(options.relations);
  const groups = options.types.map((type) => modelGroup(index, type, options));
  const nodes = groups.flatMap((group) => group.nodes);
  const representative = new Map(groups.flatMap((group) => [...group.representative]));
  const eligible = index.links.filter(
    (link) =>
      activeRelations.has(link.type) &&
      activeTypes.has(entityAt(index, link.source).type) &&
      activeTypes.has(entityAt(index, link.target).type),
  );
  const edges = [
    ...bundleLinks(eligible, representative),
    ...allowedModelEdges(index, activeTypes, activeRelations, eligible),
  ];
  return {
    nodes,
    stageOrder: medicalStageOrder,
    edges: edges.slice(0, EDGE_LIMIT),
    totalEdges: edges.length,
    totalRecords: groups.reduce((n, g) => n + g.total, 0),
    individualCount: groups.reduce((n, g) => n + g.visible, 0),
    scopedLinks: eligible.length,
    scopeIds: [...representative.keys()],
    scopedLinkIds: eligible.map((link) => link.id),
    outsideLinks: index.links.length - eligible.length,
    omittedEdges: Math.max(0, edges.length - EDGE_LIMIT),
    omittedRecords: 0,
  };
}

export function traceProjection(index: MapIndex, options: TraceOptions): Projection {
  const roots = [...new Set(options.roots ?? (options.root ? [options.root] : []))];
  if (!roots.length || roots.some((id) => !index.entities.has(id)))
    throw new Error("The focused record does not exist.");
  const relations = new Set(options.relations),
    eligible = index.links.filter((l) => relations.has(l.type));
  const { reached, queue, depthById } = traceReach(index, eligible, roots, options);
  // Root first, then shortest distance and stable identity. No duplicated shared records.
  queue.sort(
    (a, b) =>
      depthById.get(a)! - depthById.get(b)! ||
      entityAt(index, a).key.localeCompare(entityAt(index, b).key),
  );
  const retained = (options.keepIds ?? []).filter((id) => reached.has(id));
  const shown = [...new Set([...retained, ...queue])].slice(0, TRACE_LIMIT),
    shownIds = new Set(shown);
  const inside = eligible.filter((l) => shownIds.has(l.source) && shownIds.has(l.target));
  const edges = bundleLinks(inside, new Map(shown.map((id) => [id, id])));
  return {
    nodes: shown.map((id) => ({ id, kind: "item", entity: entityAt(index, id) })),
    edges: edges.slice(0, EDGE_LIMIT),
    totalEdges: edges.length,
    totalRecords: reached.size,
    individualCount: shown.length,
    scopedLinks: eligible.filter((l) => reached.has(l.source) && reached.has(l.target)).length,
    scopeIds: [...reached],
    rootIds: roots,
    scopedLinkIds: eligible
      .filter((l) => reached.has(l.source) && reached.has(l.target))
      .map((l) => l.id),
    outsideLinks: index.links.length - eligible.length,
    omittedEdges: Math.max(0, edges.length - EDGE_LIMIT),
    omittedRecords: reached.size - shown.length,
  };
}

export function sortedRecords(index: MapIndex, ids: string[]) {
  return ids.map((id) => entityAt(index, id)).sort((a, b) => a.key.localeCompare(b.key));
}

function indexEntityLinks(links: MapLink[]) {
  const result = new Map<string, MapLink[]>();
  for (const link of links)
    for (const id of new Set([link.nativeSource, link.nativeTarget])) {
      const bucket = result.get(id) ?? [];
      bucket.push(link);
      result.set(id, bucket);
    }
  return result;
}
export function linksFor(index: MapIndex, id: string | undefined) {
  return id ? (index.byEntity.get(id) ?? []) : [];
}

export function entityAt(index: MapIndex, id: string): MapEntity {
  const entity = index.entities.get(id);
  if (!entity) throw new Error(`Missing native item: ${id}`);
  return entity;
}

function modelGroup(index: MapIndex, type: string, options: ProjectionOptions) {
  const members = index.byType.get(type) ?? [],
    groupId = "group:" + type,
    open = options.expanded.includes(type);
  const pageCount = Math.max(1, Math.ceil(members.length / PAGE_SIZE)),
    page = Math.min(Math.max(0, options.pages[type] ?? 0), pageCount - 1);
  const visible = open ? members.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : [];
  const visibleIds = new Set(visible.map((entity) => entity.id));
  const nodes: NodeDefinition[] = [
    { id: groupId, kind: "group", type, open, total: members.length, page, pageCount },
  ];
  const representative = new Map(
    members.map((entity) => [
      entity.id,
      open ? (visibleIds.has(entity.id) ? entity.id : "remainder:" + type) : groupId,
    ]),
  );
  nodes.push(
    ...visible.map((entity) => ({
      id: entity.id,
      kind: "item" as const,
      entity,
      parentId: groupId,
    })),
  );
  if (open && visible.length < members.length)
    nodes.push({
      id: "remainder:" + type,
      kind: "remainder",
      parentId: groupId,
      type,
      count: members.length - visible.length,
    });
  return { nodes, representative, total: members.length, visible: visible.length };
}
function allowedModelEdges(
  index: MapIndex,
  types: Set<string>,
  relations: Set<string>,
  eligible: MapLink[],
) {
  return Object.entries(index.fixture.schema.relationshipTypes)
    .filter(([type]) => relations.has(type))
    .flatMap(([type, definition]) =>
      (definition.workflow ?? []).flatMap((path) =>
        allowedModelEdge(index, type, path, types, eligible),
      ),
    );
}
type WorkflowPath = NonNullable<
  MapIndex["fixture"]["schema"]["relationshipTypes"][string]["workflow"]
>[number];
function allowedModelEdge(
  index: MapIndex,
  type: string,
  path: WorkflowPath,
  types: Set<string>,
  eligible: MapLink[],
): EdgeDefinition[] {
  const source = path.direction === "reverse" ? path.target : path.source,
    target = path.direction === "reverse" ? path.source : path.target;
  if (!types.has(source) || !types.has(target)) return [];
  if (
    eligible.some(
      (link) =>
        link.type === type &&
        entityAt(index, link.source).type === source &&
        entityAt(index, link.target).type === target,
    )
  )
    return [];
  return [
    {
      id: "allowed:" + type + ":" + source + ":" + target,
      source: "group:" + source,
      target: "group:" + target,
      type,
      label: path.direction === "reverse" ? path.label : type.replaceAll("_", " "),
      allowed: true,
      linkIds: [],
    },
  ];
}
function incidentLinks(links: MapLink[]) {
  const incident = new Map<string, MapLink[]>();
  for (const link of links)
    for (const id of [link.source, link.target]) {
      const bucket = incident.get(id) ?? [];
      bucket.push(link);
      incident.set(id, bucket);
    }
  return incident;
}
function nextTraceItems(links: MapLink[], id: string, direction: TraceOptions["direction"]) {
  return links.flatMap((link) => {
    const forward = direction !== "upstream" && link.source === id,
      reverse = direction !== "downstream" && link.target === id;
    if (!forward && !reverse) return [];
    return [forward ? link.target : link.source];
  });
}
function traceReach(_index: MapIndex, eligible: MapLink[], roots: string[], options: TraceOptions) {
  const reached = new Set(roots),
    queue = [...roots],
    depthById = new Map(roots.map((id) => [id, 0]));
  const expanded = new Set(options.expandedFrom ?? []),
    incident = incidentLinks(eligible);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (depthById.get(id)! >= options.depth && !expanded.has(id)) continue;
    for (const other of nextTraceItems(incident.get(id) ?? [], id, options.direction)) {
      if (reached.has(other)) continue;
      reached.add(other);
      depthById.set(other, depthById.get(id)! + 1);
      queue.push(other);
    }
  }
  return { reached, queue, depthById };
}
