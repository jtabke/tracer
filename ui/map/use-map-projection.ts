import { useMemo } from "react";
import { projectMap } from "./map-projection.ts";
import type { BranchStep, MapIndex, Organization, WorkingView } from "./types.ts";

// Selection, tray, and label changes do not invalidate graph topology or placement.
export function useMapProjection(
  index: MapIndex,
  organization: Organization,
  view: WorkingView,
  branches: BranchStep[],
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
  } = view;
  const layoutDirection = view.display.direction;
  return useMemo(
    () =>
      projectMap(
        index,
        organization,
        {
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
        },
        {
          expandedFrom: branches.map((step) => step.id),
          keepIds: branches.at(-1)?.keepIds ?? [],
          revealOrigin: branches.at(-1)?.origin,
          layoutDirection,
        },
      ),
    [
      index,
      organization,
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
      branches,
      layoutDirection,
    ],
  );
}
