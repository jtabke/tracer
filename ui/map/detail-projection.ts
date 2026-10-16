import { entityAt, PAGE_SIZE, traceProjection } from "./model.ts";
import { buildDirectory, matchesArea } from "./organization.ts";
import type { MapIndex, Organization, Projection, TraceOptions } from "./types.ts";

export function flatDirectoryProjection(
  _index: MapIndex,
  organization: Organization,
  graph: Projection,
): Projection {
  const definitions = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodes = graph.nodes
    .filter((node) => !(node.kind === "group" && node.open))
    .map((node) => {
      const { parentId, ...flat } = node;
      return node.kind === "item"
        ? { ...flat, showFolder: true, folderPath: organization[node.id]?.path ?? ["Unfiled"] }
        : node.kind === "remainder"
          ? {
              ...flat,
              pageCount: definitions.get(parentId ?? "")?.pageCount,
              page: definitions.get(parentId ?? "")?.page,
            }
          : flat;
    });
  const ids = new Set(nodes.map((node) => node.id));
  return {
    ...graph,
    nodes,
    edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
  };
}

export function itemTraceProjection(
  index: MapIndex,
  organization: Organization,
  options: TraceOptions,
): Projection {
  const graph = traceProjection(index, options);
  const retained = new Set(options.keepIds ?? []);
  let added = 0;
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const offset = added;
      const origin = options.revealOrigin;
      const place = origin && !retained.has(node.id);
      if (place) added++;
      return {
        ...node,
        showFolder: true,
        folderPath: organization[node.id]?.path ?? ["Unfiled"],
        ...(place
          ? {
              initialPosition:
                options.layoutDirection === "RIGHT"
                  ? { x: origin!.x + 360, y: origin!.y + offset * 180 }
                  : { x: origin!.x + offset * 334, y: origin!.y + 200 },
            }
          : {}),
      };
    }),
  };
}

// A folder is a scope, not another box around its contents. Source pages bound
// the roots; actual recorded downstream/upstream links determine the other items.
export function folderTraceProjection(
  index: MapIndex,
  organization: Organization,
  options: TraceOptions & { folder: string; area?: string; page?: number },
): Projection {
  const directory = buildDirectory(index, organization);
  const group = directory.groups.get(options.folder);
  const members = (group?.members ?? [])
    .filter((id) => matchesArea(id, organization, options.area ?? "All areas"))
    .map((id) => entityAt(index, id))
    .sort((a, b) => a.key.localeCompare(b.key));
  const pageCount = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  const page = Math.max(0, Math.min(options.page ?? 0, pageCount - 1));
  const roots = members.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((entity) => entity.id);
  const graph = roots.length
    ? itemTraceProjection(index, organization, { ...options, roots })
    : {
        nodes: [],
        edges: [],
        rootIds: [],
        totalRecords: 0,
        individualCount: 0,
        scopedLinks: 0,
        scopeIds: [],
        scopedLinkIds: [],
        omittedRecords: 0,
        omittedEdges: 0,
        outsideLinks: index.links.length,
      };
  const inFolder = new Set(members.map((entity) => entity.id));
  return {
    ...graph,
    folderDetail: true,
    folderTotal: members.length,
    sourcePage: page,
    sourcePageCount: pageCount,
    linkedCount: graph.scopeIds.filter((id) => !inFolder.has(id)).length,
    offPageSources: members.length - roots.length,
  };
}
