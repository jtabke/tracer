import { useReactFlow } from "@xyflow/react";
import React from "react";
import { mapScopes } from "./controls.tsx";
import { connectionNames, relevantRelationships } from "./filters.ts";
import { absolutePositions } from "./flow-geometry.ts";
import { presentMap } from "./map-presentation.ts";
import { mapSelection } from "./map-selection.ts";
import { entityAt, PAGE_SIZE, traceProjection, typeNames } from "./model.ts";
import {
  areaChoices,
  areaRecords,
  buildDirectory,
  matchesArea,
  revealInDirectory,
} from "./organization.ts";
import { traceEmphasis } from "./trace-emphasis.ts";
import type {
  BranchStep,
  DirectoryGroup,
  FlowEdge,
  FlowNode,
  MapProps,
  Selection,
  ViewSnapshot,
} from "./types.ts";
import { useMapLayout } from "./use-map-layout.ts";
import { useMapOrganization } from "./use-map-organization.ts";
import { useMapProjection } from "./use-map-projection.ts";
import { useMapSearch } from "./use-map-search.ts";
import { useMapTools } from "./use-map-tools.ts";
import { useMapView } from "./use-map-view.ts";
import { useMapWindow } from "./use-map-window.ts";
import { useSessionViews } from "./use-session-views.ts";
import { useTraceSession } from "./use-trace-session.ts";
import { initialView, viewOf } from "./view-state.ts";
const NO_BRANCHES: BranchStep[] = [];

export function useMapController({
  data,
  actions,
  inspectorActions,
  status,
  notice,
  projects,
  onProject,
  sessionKey,
}: MapProps) {
  const flow = useReactFlow<FlowNode, FlowEdge>();
  const dataset = sessionKey;
  const typeCount = Object.keys(data.schema.entityTypes).length;
  const { index, view, changeView, presets, defaultPreset, relationTypes } = useMapView(data);
  const {
    area,
    folderScope,
    detail,
    representation,
    revealed,
    showBoundary,
    tray,
    preset,
    types,
    relations,
    expanded,
    pages,
    focus,
    depth,
    traceBranches,
    direction,
    selected,
    routeSelection,
    display,
  } = view;

  const selection: Partial<Selection> = selected ?? {};

  const {
    orgRevision,
    checkedRecords,
    organizeIds,
    organizationUndo,
    organization,
    directory,
    areas,
    browsingDirectory,
    setCustomOrganization,
    setOrgRevision,
    setCheckedRecords,
    setOrganizeIds,
    setOrganizationUndo,
    applyOrganization: applySessionOrganization,
  } = useMapOrganization(data, index, area);
  const {
    query,
    searchPage,
    searchType,
    search,
    searchRef,
    setQuery,
    setSearchPage,
    setSearchType,
  } = useMapSearch(index);
  const {
    savedViews,
    savingView,
    viewName,
    setSavingView,
    setViewName,
    saveWorkingView,
    navigation,
    setNavigation,
  } = useSessionViews(captureWork);
  const {
    browseRail,
    mobileDetailsOpen,
    panel,
    filterTab,
    mobileDetailsTrigger,
    panelTrigger,
    setBrowseRail,
    setMobileDetailsOpen,
    setPanel,
    setFilterTab,
    message,
    setMessage,
  } = useMapTools();
  const { walk, traceHistory, traceNotice, returnFrame, setWalk, setTraceHistory, setTraceNotice } =
    useTraceSession();
  function applyOrganization(action: string, value: string) {
    if (!applySessionOrganization(action, value)) return;
    changeView({ tray: null });
    camera.current = { fit: true };
    setMessage("Session organization updated. Undo is available.");
  }
  function undoOrganization() {
    if (!organizationUndo) return;
    const restoredDirectory = buildDirectory(index, organizationUndo);
    const validFolder = !folderScope || restoredDirectory.groups.has(folderScope);
    const validArea = areaChoices(index, organizationUndo).some((choice) => choice.name === area);
    setCustomOrganization(organizationUndo);
    setOrganizationUndo(null);
    setOrgRevision((current) => current + 1);
    changeView({
      folderScope: validFolder ? folderScope : null,
      area: validArea ? area : "All areas",
      expanded: expanded.filter((key) => restoredDirectory.groups.has(key)),
      selected: null,
      tray: null,
    });
    if (!validFolder) setNavigation([]);
    camera.current = { fit: true };
  }
  const branchKey = JSON.stringify([
    dataset,
    focus,
    folderScope,
    pages[folderScope ?? ""] ?? 0,
    depth,
    direction,
  ]);
  const branchSteps = traceBranches.key === branchKey ? traceBranches.steps : NO_BRANCHES;
  const projection = useMapProjection(index, organization, view, branchSteps);
  const layoutContextKey = JSON.stringify([
    dataset,
    area,
    folderScope,
    detail,
    orgRevision,
    focus,
    depth,
    direction,
    display.direction,
    display.spacing,
  ]);
  const { geometry, working, layoutError, zoom, setZoom, camera, moveNodes, arrangeLayout } =
    useMapLayout(flow, projection, display, layoutContextKey, focus, folderScope);

  const contextTypes = [
    ...new Set(
      projection.nodes
        .filter((node) => node.external)
        .map((node) => node.type ?? node.entity?.type)
        .filter((value): value is NonNullable<typeof value> => !!value),
    ),
  ];
  const applicableRelations =
    focus || folderScope
      ? relationTypes
      : relevantRelationships(data.schema, [...new Set([...types, ...contextTypes])]);
  const shownRelations = applicableRelations.filter((type) => relations.includes(type)).length;
  const scopeNames: Record<string, string> = { ...mapScopes, all: "All item types" };
  const modelLayoutKey = JSON.stringify([
    dataset,
    types,
    relations,
    expanded,
    pages,
    display.direction,
    display.spacing,
    detail,
    area,
    folderScope,
    revealed,
    showBoundary,
    orgRevision,
  ]);

  function arrange() {
    arrangeLayout();
    setMessage("Graph arranged. Filters, expanded groups and selection kept.");
  }
  function rememberCamera(anchorId?: string) {
    const node = anchorId ? flow.getNode(anchorId) : null;
    const anchor = node
      ? { id: node.id, ...absolutePositions(flow.getNodes()).get(node.id)! }
      : null;
    camera.current = {
      viewport: flow.getViewport(),
      anchor,
    };
  }
  function toggle(type: string) {
    const folder = directory.groups.get(type);
    if (detail === "folders" && folder?.path.length) {
      enterGroup(folder);
      return;
    }
    rememberCamera(
      projection.nodes.find(
        (node) => (node.groupKey ?? node.type) === type && node.kind === "group",
      )?.id ?? `group:${type}`,
    );
    camera.current.local = true;
    camera.current.previous = geometry;
    changeView({
      expanded: (current) =>
        current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
      selected: null,
    });
  }
  function next(type: string) {
    const group =
      projection.nodes.find(
        (node) => node.kind === "group" && (node.groupKey ?? node.type) === type,
      ) ?? projection.nodes.find((node) => node.kind === "remainder" && node.pageKey === type);
    rememberCamera(group?.id ?? `group:${type}`);
    camera.current.local = true;
    camera.current.previous = geometry;
    const totalPages =
      group?.pageCount ?? Math.ceil((index.byType.get(type)?.length ?? 0) / PAGE_SIZE);
    changeView({
      pages: (current) => ({
        ...current,
        [type]: ((current[type] ?? 0) + 1) % Math.max(1, totalPages),
      }),
    });
    setMessage(
      `Showing the next page of ${group?.title ?? typeNames[type]}. Other records remain grouped.`,
    );
  }
  function selectTraceItem(id: string) {
    changeView({
      routeSelection: {
        key: branchKey,
        route: traceEmphasis(
          projection,
          focus ? [focus] : (projection.rootIds ?? []),
          id,
          direction,
          activeRoute,
        ),
      },
      selected: { kind: "item", id },
    });
  }
  function locateTraceItem(id: string) {
    setMobileDetailsOpen(false);
    selectTraceItem(id);
    flow.fitView({ nodes: [{ id }], padding: 0.2, minZoom: 0.8, maxZoom: 1, duration: 0 });
  }
  function revealNext(id: string) {
    setTraceNotice(null);
    selectTraceItem(id);
    if (branchSteps.some((step) => step.id === id)) return;
    const next = traceProjection(index, { root: id, depth: 1, direction, relations });
    if (next.scopeIds.every((other) => projection.scopeIds.includes(other))) {
      setMessage(`No additional matching items from ${entityAt(index, id).key}.`);
      setTraceNotice({
        key: branchKey,
        relations: relations.join("|"),
        text: `No additional matching items from ${entityAt(index, id).key}.`,
      });
      return;
    }
    camera.current = { local: true, previous: geometry, viewport: flow.getViewport() };
    const keepIds = projection.nodes.map((node) => node.id);
    changeView({
      traceBranches: {
        key: branchKey,
        steps: [
          ...branchSteps,
          {
            id,
            keepIds,
            geometry,
            viewport: flow.getViewport(),
            selected,
            routeSelection,
            origin: geometry.nodes.find((node) => node.id === id)?.position,
            layoutKey: JSON.stringify([relations, display.direction, display.spacing, orgRevision]),
          },
        ],
      },
    });
    setMessage(
      `Revealed next connections from ${entityAt(index, id).key}. Existing items stay in place.`,
    );
  }
  function undoTraceReveal() {
    setTraceNotice(null);
    const last = branchSteps.at(-1);
    if (!last) return;
    camera.current =
      last.layoutKey ===
      JSON.stringify([relations, display.direction, display.spacing, orgRevision])
        ? { geometry: last.geometry, viewport: last.viewport, restore: true }
        : { local: true, previous: geometry, viewport: flow.getViewport() };
    changeView({
      selected: last.selected,
      routeSelection: last.routeSelection ?? { key: null, route: null },
      traceBranches: { key: branchKey, steps: branchSteps.slice(0, -1) },
    });
  }
  function openTrace(id: string, fromClick = false) {
    setMobileDetailsOpen(false);
    setTraceNotice(null);
    if (focus === id) {
      changeView({ selected: { kind: "item", id } });
      setQuery("");
      return;
    }
    const frame = captureWork();
    if (focus) setTraceHistory((current) => [...current, frame]);
    else setTraceHistory([]);
    changeView({ traceBranches: { key: null, steps: [] } });
    if (!focus)
      returnFrame.current = { ...frame, selected: fromClick ? { kind: "item", id } : selected };
    if (!focus) {
      changeView({ depth: 1, direction: "downstream" });
    }
    camera.current = { fit: true };
    changeView({ focus: id, selected: { kind: "item", id } });
    setQuery("");
    setPanel(null);
    changeView({ representation: "graph", tray: null });
  }
  function backToModel(all: boolean | React.MouseEvent = false) {
    const previous = all === true ? null : traceHistory.at(-1);
    if (all === true) setTraceHistory([]);
    if (previous) {
      camera.current =
        previous.width === window.innerWidth && previous.orgRevision === orgRevision
          ? { geometry: previous.geometry, viewport: previous.viewport, restore: true }
          : { fit: true };
      changeView(viewOf(previous, view));
      setTraceHistory((current) => current.slice(0, -1));
      setQuery("");
      setPanel(null);
      return;
    }
    const frame: Partial<ViewSnapshot> & ReturnType<typeof initialView> =
      returnFrame.current ?? initialView({ presets, defaultPreset, relationTypes });
    camera.current =
      frame.width === window.innerWidth
        ? { viewport: frame.viewport, restore: true }
        : { fit: true };
    if (frame.modelLayoutKey === modelLayoutKey) camera.current.geometry = frame.geometry;
    changeView({
      focus: null,
      representation: frame.representation,
      tray: frame.tray,
      traceBranches: frame.traceBranches,
      routeSelection: frame.routeSelection,
      depth: frame.depth,
      direction: frame.direction,
      selected: frame.selected,
    });
    setQuery("");
  }
  function choosePreset(value: string) {
    changeView({ traceBranches: { key: null, steps: [] } });
    const products = index.byType.get("device") ?? [];
    camera.current = {
      fit: true,
      ...(presets[value]?.includes("device") &&
      products.length === 1 &&
      matchesArea(products[0].id, organization, area)
        ? { frameIds: [products[0].id] }
        : {}),
    };
    changeView({ preset: value, types: presets[value], selected: null, tray: null });
  }

  function togglePanel(value: string, event: React.MouseEvent<HTMLElement>) {
    panelTrigger.current = event.currentTarget;
    setPanel((current) => (current === value ? null : value));
  }
  function openFilters(tab: string, event: React.MouseEvent<HTMLElement>) {
    panelTrigger.current = event.currentTarget;
    setFilterTab(tab);
    setPanel("filters");
  }
  function closeFilters() {
    setPanel(null);
    panelTrigger.current?.focus();
  }
  function changeTypes(nextTypes: string[]) {
    rememberCamera();
    changeView({ preset: "custom", types: nextTypes });
  }
  function changeRelations(nextRelations: string[]) {
    rememberCamera();
    changeView({ relations: nextRelations });
  }
  function resetFilters() {
    rememberCamera();
    if (!focus && !folderScope) {
      changeView({ types: presets.requirements, preset: "requirements" });
    }
    changeView({ relations: relationTypes });
    setMessage(
      focus
        ? "All connection kinds restored for this trace."
        : "Requirements flow and all connection kinds restored.",
    );
  }
  function captureWork() {
    return {
      ...view,
      viewport: flow.getViewport(),
      geometry,
      width: window.innerWidth,
      orgRevision,
      modelLayoutKey,
    };
  }
  function restoreWork(snapshot: ViewSnapshot) {
    setTraceHistory([]);
    camera.current =
      snapshot.width === window.innerWidth && snapshot.orgRevision === orgRevision
        ? { viewport: snapshot.viewport, geometry: snapshot.geometry, restore: true }
        : { fit: true };
    changeView({ ...viewOf(snapshot, view), focus: null, tray: null });
    setCheckedRecords(new Set());
    setPanel(null);
  }
  function changeArea(value: string) {
    setTraceHistory([]);
    changeView({ traceBranches: { key: null, steps: [] } });
    camera.current = { fit: true };
    changeView({ area: value, folderScope: null });
    setNavigation([]);
    changeView({ focus: null, selected: null, revealed: [], showBoundary: false, tray: null });
    setCheckedRecords(new Set());
    setPanel(null);
  }
  function enterGroup(group: DirectoryGroup | undefined) {
    if (!group || group.external || group.key === folderScope) return;
    const frame = captureWork();
    setNavigation((current) => [...current, frame]);
    changeView({ traceBranches: { key: null, steps: [] } });
    const first = areaRecords(index, organization, area, group.members)[0]?.id;
    camera.current = {
      fit: true,
      ...(first
        ? {
            frameIds: traceProjection(index, {
              root: first,
              depth: 1,
              direction: "downstream",
              relations,
            }).nodes.map((node) => node.id),
          }
        : {}),
    };
    changeView({
      folderScope: group.key,
      types: [group.type],
      preset: "custom",
      expanded: (current) => [...new Set([...current, group.key])],
      depth: 1,
      direction: "downstream",
      detail: "folders",
      representation: "graph",
      selected: null,
      revealed: [],
      showBoundary: false,
      tray: null,
    });
    setCheckedRecords(new Set());
    setPanel(null);
  }
  function leaveGroup() {
    const snapshot = navigation.at(-1);
    if (!snapshot) return;
    restoreWork(snapshot);
    setNavigation((current) => current.slice(0, -1));
  }
  function folderPage(page: number) {
    if (!folderScope) return;
    changeView({ traceBranches: { key: null, steps: [] } });
    const members = areaRecords(
      index,
      organization,
      area,
      directory.groups.get(folderScope)?.members,
    );
    const first = members[page * PAGE_SIZE]?.id;
    camera.current = {
      fit: true,
      ...(first
        ? {
            frameIds: traceProjection(index, {
              root: first,
              depth,
              direction,
              relations,
            }).nodes.map((node) => node.id),
          }
        : {}),
    };
    changeView({ pages: (old) => ({ ...old, [folderScope]: page }) });
  }
  function frameSelection() {
    const edge = projection.edges.find((value) => value.id === selection.id);
    const ids =
      selection.kind === "edge"
        ? [edge?.source, edge?.target].filter(
            (value): value is NonNullable<typeof value> => !!value,
          )
        : [selection.id].filter((value): value is NonNullable<typeof value> => !!value);
    if (ids.length)
      flow.fitView({
        nodes: ids.map((id) => ({ id })),
        padding: 0.3,
        minZoom: 0.65,
        maxZoom: 1,
        duration: 200,
      });
  }
  function inspectBundle(id: string) {
    const edge = projection.edges.find((value) => value.id === id);
    if (!edge) return;
    changeView({
      selected: { kind: "edge", id },
      tray: {
        id,
        linkIds: edge.linkIds,
        title: `${connectionNames[edge.type] ?? edge.label} · selected connections`,
      },
    });
    requestAnimationFrame(() =>
      flow.fitView({
        nodes: [{ id: edge.source }, { id: edge.target }],
        padding: 0.2,
        minZoom: 0.2,
        maxZoom: 1,
        duration: 0,
      }),
    );
  }
  function showEndpoints(ids: string[]) {
    if (focus) changeView({ focus: null });
    const next = revealInDirectory(index, organization, ids, expanded, pages);
    changeView({
      expanded: next.expanded,
      pages: next.pages,
      revealed: ids,
      detail: "folders",
      representation: "graph",
    });
    camera.current = { fit: true, frameIds: ids.slice(0, 1) };
    if (ids[0]) changeView({ selected: { kind: "item", id: ids[0] } });
    setMessage(
      `${ids.length} endpoints revealed. Outside items are context, not added to this category.`,
    );
  }
  function beginWalk(id: string, firstLink?: string) {
    const scope =
      projection.scopeIds ??
      (focus
        ? projection.nodes.filter((node) => node.kind === "item").map((node) => node.id)
        : types.flatMap((type) => (index.byType.get(type) ?? []).map((entity) => entity.id)));
    setWalk({
      start: id,
      firstLink,
      returnFocus: document.activeElement,
      startingScope: new Set(scope),
      origin: focus
        ? `Trace · ${entityAt(index, focus).key}`
        : folderScope
          ? `${typeNames[directory.groups.get(folderScope)?.type ?? ""]} / ${directory.groups.get(folderScope)?.path.join(" / ")}`
          : area === "All areas"
            ? "Data model"
            : `${area} development`,
    });
  }

  const toggleNode = toggle;
  const pageNode = next;
  useMapWindow(flow, projection, view, {
    walking: !!walk,
    organizeIds,
    panel,
    query,
    setOrganizeIds,
    setPanel,
    setQuery,
    panelTrigger,
    searchRef,
    clearSelection: () => changeView({ selected: null }),
  });

  const {
    visibleIds,
    selectedVisible,
    pathDetail,
    activeRoute,
    emphasisMode,
    emphasizing,
    nodes,
    edges,
  } = presentMap(index, directory, projection, geometry, view, branchKey, working, {
    toggle: toggleNode,
    next: pageNode,
    enter: enterGroup,
    inspect: inspectBundle,
  });
  const {
    selectedEntity,
    selectedGroup,
    selectedGroupNode,
    selectedDirectoryGroup,
    selectedItemLinks,
    inspector,
    outsideCategoryCount,
    hiddenSelection,
    scopedRecords,
    trayLinks,
    activeFolder,
  } = mapSelection(index, directory, projection, organization, view, selectedVisible);

  return {
    actions,
    activeFolder,
    activeRoute,
    applicableRelations,
    applyOrganization,
    undoOrganization,
    area,
    areas,
    arrange,
    backToModel,
    beginWalk,
    branchKey,
    branchSteps,
    browseRail,
    browsingDirectory,
    camera,
    changeArea,
    changeRelations,
    changeTypes,
    changeView,
    checkedRecords,
    choosePreset,
    closeFilters,
    contextTypes,
    data,
    dataset,
    depth,
    detail,
    direction,
    directory,
    display,
    edges,
    emphasisMode,
    emphasizing,
    enterGroup,
    expanded,
    filterTab,
    flow,
    focus,
    folderPage,
    folderScope,
    frameSelection,
    geometry,
    hiddenSelection,
    index,
    inspectBundle,
    inspector,
    inspectorActions,
    layoutError,
    leaveGroup,
    locateTraceItem,
    message,
    mobileDetailsOpen,
    mobileDetailsTrigger,
    moveNodes,
    nodes,
    notice,
    onProject,
    openFilters,
    openTrace,
    organization,
    organizationUndo,
    organizeIds,
    outsideCategoryCount,
    panel,
    panelTrigger,
    pathDetail,
    preset,
    projection,
    projects,
    query,
    relationTypes,
    relations,
    rememberCamera,
    representation,
    resetFilters,
    restoreWork,
    revealNext,
    revealed,
    saveWorkingView,
    savedViews,
    savingView,
    scopeNames,
    scopedRecords,
    search,
    searchPage,
    searchRef,
    searchType,
    selected,
    selectedDirectoryGroup,
    selectedEntity,
    selectedGroup,
    selectedGroupNode,
    selectedItemLinks,
    selectedVisible,
    selection,
    setBrowseRail,
    setCheckedRecords,
    setFilterTab,
    setMobileDetailsOpen,
    setNavigation,
    setOrganizeIds,
    setPanel,
    setQuery,
    setSavingView,
    setSearchPage,
    setSearchType,
    setViewName,
    setWalk,
    setZoom,
    showBoundary,
    showEndpoints,
    shownRelations,
    status,
    toggle,
    togglePanel,
    traceHistory,
    traceNotice,
    tray,
    trayLinks,
    typeCount,
    types,
    undoTraceReveal,
    view,
    viewName,
    visibleIds,
    walk,
    working,
    zoom,
  };
}
export type MapController = ReturnType<typeof useMapController>;
