import {
  flatDirectoryProjection,
  folderTraceProjection,
  itemTraceProjection,
} from "./detail-projection.ts";
import { modelProjection } from "./model.ts";
import { directoryProjection } from "./organization.ts";
import type {
  MapIndex,
  Organization,
  ProjectionOptions,
  TraceOptions,
  WorkingView,
} from "./types.ts";

function projectScope(
  index: MapIndex,
  organization: Organization,
  state: Pick<
    WorkingView,
    | "focus"
    | "depth"
    | "direction"
    | "relations"
    | "types"
    | "expanded"
    | "pages"
    | "detail"
    | "area"
    | "folderScope"
    | "revealed"
    | "showBoundary"
  >,
  branchOptions: Partial<TraceOptions>,
) {
  const {
    focus,
    depth,
    direction,
    relations,
    types,
    expanded,
    pages,
    detail,
    area,
    folderScope,
    revealed,
    showBoundary,
  } = state;
  const trace = { depth, direction, relations, ...branchOptions };
  if (focus && index.entities.has(focus))
    return itemTraceProjection(index, organization, { root: focus, ...trace });
  const directory = {
    types,
    relations,
    expanded,
    pages,
    organization,
    area,
    folder: folderScope,
    mode: detail,
    revealed,
    showBoundary,
  };
  if (revealed.length)
    return flatDirectoryProjection(index, organization, directoryProjection(index, directory));
  if (folderScope)
    return folderTraceProjection(index, organization, {
      folder: folderScope,
      area,
      page: pages[folderScope],
      ...trace,
    });
  return overviewProjection(index, directory);
}

function overviewProjection(
  index: MapIndex,
  options: ProjectionOptions & { organization: Organization },
) {
  const { types, relations, expanded, pages, area, mode, showBoundary } = options;
  if (mode === "folders" || area !== "All areas" || showBoundary)
    return directoryProjection(index, {
      ...options,
      expanded: overviewExpanded(options),
    });
  return modelProjection(index, { types, relations, expanded, pages });
}

function overviewExpanded({ mode, expanded }: Pick<ProjectionOptions, "mode" | "expanded">) {
  return mode === "folders" ? expanded.filter((key) => !key.startsWith("folder:")) : expanded;
}

export function projectMap(...args: Parameters<typeof projectScope>) {
  return {
    rootIds: [] as string[],
    sourcePage: 0,
    sourcePageCount: 1,
    boundaryLinks: 0,
    limitedGroups: 0,
    outsideLinks: 0,
    ...projectScope(...args),
  };
}
