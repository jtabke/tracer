import type { ComponentProps } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FamilyWorkspace, Graph } from "../../../src/application/views.ts";
import type { Entity, Relationship, SchemaObject } from "../../../src/core/model.ts";
import type { FamilyView, ViewDefinition } from "../../../src/core/presentation.ts";
import { read } from "../../../ui/api.ts";
import type { Editing, Focus } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import { usePageCursor } from "../../../ui/use-page-cursor.ts";
import { useProjection, type Projection } from "../../../ui/use-projection.ts";
import type { RelationshipSlot } from "./relationship-slots.ts";
import { SavedViewPanel } from "./saved-views.tsx";
import { useWorkspaceCreation } from "./use-workspace-creation.tsx";
import { useWorkspaceReader } from "./use-workspace-reader.ts";
import { WorkspaceBrowser } from "./workspace-browser.tsx";
import { MappingDialog } from "./workspace-dialogs.tsx";
import { WorkspaceInspector } from "./workspace-inspector.tsx";
import {
  workspaceSelectedEntityId,
  workspaceSelection,
  workspaceWriteState,
} from "./workspace-selection.ts";
import { WorkspaceSurface } from "./workspace-surface.tsx";
import "./workspace.css";

export type WorkspaceIntent = {
  sequence: number;
  type?: string;
  find?: boolean;
  id?: string;
  create?: boolean;
  scope?: { relationship: string; direction: "incoming" | "outgoing" };
  presentation?: { layout: FamilyView["layout"]; columns: RelationshipSlot[] };
  task?: { title: string; explanation: string };
};

type WorkspaceProps = {
  intent?: WorkspaceIntent;
  schema: SchemaObject;
  editing: Editing;
  onFocus(value: Focus): void;
  onOpenReceipt?(
    receiptId: string,
    inputId?: string,
    context?: { subjectId: string; returnLabel: string },
  ): boolean | void;
};

export function Workspace(props: WorkspaceProps) {
  const controller = workspaceRenderProps(useWorkspaceController(props));
  return (
    <section
      ref={controller.reader.surface}
      className={controller.className}
      aria-label="Connected workspace"
    >
      <WorkspaceTaskContext {...controller.context} />
      <WorkspaceNavigation
        {...controller.navigation}
        library={<WorkspaceViewLibrary {...controller.library} />}
      />
      {controller.creation.stage}
      <div
        className="workspace-browser-region"
        hidden={controller.creation.active || controller.reader.active || controller.browserHidden}
      >
        <WorkspaceBrowser {...controller.browser} />
      </div>
      <div className="workspace-connected-region" hidden={controller.creation.active}>
        {!!controller.rootId && <WorkspaceConnectedContext {...controller.connected} />}
      </div>
      <WorkspaceMapping {...controller.mapping} />
    </section>
  );
}

function useWorkspaceController({
  schema,
  editing,
  onFocus,
  intent,
  onOpenReceipt,
}: WorkspaceProps) {
  const { selectedRow, projectHeading, contextHeading } = useWorkspaceHeadings();
  const scope = useWorkspaceScope();
  const {
    rootId,
    meaning,
    setMeaning,
    direction,
    setDirection,
    cursor,
    traceHistory,
    navigate,
    selectRoot,
    returnToScope,
    exploreFrom,
  } = scope;
  const [view, setView] = useState("relationships"),
    [mapping, setMapping] = useState<RelationshipSlot | null | undefined>();
  const [traceColumns, setTraceColumns] = useState<RelationshipSlot[]>([]);
  const [browserOpen, setBrowserOpen] = useState(false);
  const requestBrowserFocus = useBrowserReturnFocus({ selectedRow, projectHeading });
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const { family, data, trace, inspection, currentSchema, paused, inspectorPaused, creation } =
    useWorkspaceReadContext(schema, editing, onFocus, scope, view, contextHeading);
  const {
    selected,
    setSelected,
    selectedLink,
    setSelectedLink,
    artifact,
    returnSelection,
    expandedEditor,
    setExpandedEditor,
    dirty,
    setDirty,
    current,
    currentLink,
    selectionLoaded,
    chooseSelection,
    chooseRecorded,
    inspect,
    focusArtifact,
  } = inspection;
  const reader = useWorkspaceReader(currentLink?.id ?? current?.id, () => setExpandedEditor(false));
  const openCaptured = receiptFromReader(onOpenReceipt, reader, setExpandedEditor);
  const choose = readerChoice(
    workspaceChoose(chooseSelection, selectRoot, setBrowserOpen, setInspectorOpen),
    reader,
  );
  const navigateRecorded = readerChoice(
    workspaceChoose(chooseRecorded, selectRoot, setBrowserOpen, setInspectorOpen),
    reader,
  );
  useRequestedInspection(
    intent,
    (entity, root) => choose(entity, root, intent?.scope),
    editing.report,
    (value) => applyPresentation(value, setView, setTraceColumns),
  );
  useBrowserIntent(intent, readerBrowser(setBrowserOpen, setExpandedEditor, reader));
  const showBrowser = () => {
    reader.hide();
    setExpandedEditor(false);
    setBrowserOpen(true);
    requestBrowserFocus();
  };
  const goToContext = () => enterContext(setBrowserOpen, contextHeading);
  const explore = workspaceExplorer(
    current,
    data,
    !dirty && !inspectorPaused,
    exploreFrom,
    choose,
    { layout: view as FamilyView["layout"], columns: traceColumns },
    (value) => {
      applyPresentation(value, setView, setTraceColumns);
      reader.hide();
    },
  );
  const returnToContext = () =>
    returnToScope(choose, (value) => {
      applyPresentation(value, setView, setTraceColumns);
      reader.hide();
    });
  const remove = () =>
    removeConnection(selectedLink, paused, currentSchema, editing, () => {
      setSelectedLink(undefined);
      setDirty(false);
    });
  const actions = {
    paused,
    dirty,
    graphRead: { epoch: editing.epoch, report: editing.report, onRead: trace.onRead },
    onChoose: choose,
    onInspect: readerInspection(inspect, reader),
    onReceipt: workspaceReceiptAction(openCaptured, rootId, data?.root),
    onMap: workspaceMap(setSelected, setSelectedLink, setMapping),
  };
  const presentation = workspacePresentation(
    rootId,
    browserOpen,
    traceHistory.at(-1)?.root,
    current,
  );
  const setPresentation = (value?: WorkspaceIntent["presentation"]) =>
    applyPresentation(value, setView, setTraceColumns);
  const openSavedView = (definition: ViewDefinition) =>
    openFamilyView(definition, choose, setPresentation);
  return {
    project: { schema, editing, intent, currentSchema, onOpenReceipt: openCaptured },
    scope: { rootId, meaning, direction, setMeaning, setDirection, navigate, cursor },
    headings: { selectedRow, projectHeading, contextHeading },
    inspection: {
      selected,
      selectedLink,
      current,
      currentLink,
      artifact,
      returnSelection,
      focusArtifact: readerInspection(focusArtifact, reader),
      dirty,
      setDirty,
      expandedEditor,
      setExpandedEditor,
      selectionLoaded,
    },
    display: {
      browserOpen,
      setBrowserOpen,
      inspectorOpen,
      setInspectorOpen,
      view,
      setView,
      traceColumns,
      setTraceColumns,
      presentation,
    },
    read: { family, data, trace, inspectorPaused },
    commands: {
      choose,
      showBrowser,
      goToContext,
      returnToContext,
      openSavedView,
      remove,
      explore,
      navigateRecorded,
      setMapping,
    },
    mapping,
    creation,
    reader,
    actions,
  };
}

function useWorkspaceReadContext(
  schema: SchemaObject,
  editing: Editing,
  onFocus: (value: Focus) => void,
  scope: ReturnType<typeof useWorkspaceScope>,
  view: string,
  contextHeading: React.RefObject<HTMLHeadingElement | null>,
) {
  const family = useProjection(
    "/api/family",
    familyQuery(scope.rootId, scope.meaning, scope.direction, scope.cursor.after),
    editing.epoch,
    editing.report,
  );
  useContextEntry(scope.rootId, contextHeading);
  const data = family.data;
  const trace = useWorkspaceTraceRead(data, editing.epoch, view);
  const inspection = useWorkspaceInspection(trace.data, onFocus, editing);
  const { current, selectionLoaded, dirty } = inspection;
  const currentSchema = inspection.schema ?? workspaceInspectionSchema(trace.data, schema);
  const { paused, inspectorPaused } = workspaceWriteState(
    editing.busy,
    workspaceReadPending(family.loading, trace.pending),
    !!data,
    selectionLoaded,
  );
  const creation = useWorkspaceCreation(
    current,
    currentSchema,
    data?.members ?? [],
    trace.data?.nodes ?? [],
    editing,
    inspectorPaused,
    dirty,
    data?.root,
    inspection.authoritative,
  );
  return { family, data, trace, inspection, currentSchema, paused, inspectorPaused, creation };
}

function workspaceRenderProps(controller: ReturnType<typeof useWorkspaceController>) {
  const { schema, editing, intent, currentSchema, onOpenReceipt } = controller.project;
  const { rootId, meaning, direction, setMeaning, setDirection, navigate, cursor } =
    controller.scope;
  const { selectedRow, projectHeading, contextHeading } = controller.headings;
  const {
    selected,
    selectedLink,
    current,
    currentLink,
    artifact,
    returnSelection,
    focusArtifact,
    dirty,
    setDirty,
    expandedEditor,
    setExpandedEditor,
    selectionLoaded,
  } = controller.inspection;
  const {
    browserOpen,
    setBrowserOpen,
    inspectorOpen,
    setInspectorOpen,
    view,
    setView,
    traceColumns,
    setTraceColumns,
    presentation,
  } = controller.display;
  const { family, data, trace, inspectorPaused } = controller.read;
  const {
    choose,
    showBrowser,
    goToContext,
    returnToContext,
    openSavedView,
    remove,
    explore,
    setMapping,
    navigateRecorded,
  } = controller.commands;
  const { mapping, creation, actions, reader } = controller;
  return {
    rootId,
    className: readerClass(
      workspaceClass(rootId, browserOpen, inspectorOpen, expandedEditor),
      reader,
    ),
    browserHidden: presentation.browserHidden,
    creation,
    reader,
    context: { intent, rootId: data?.root.id, meaning, direction, loading: family.loading },
    navigation: {
      rootId,
      browserOpen,
      inspectorOpen: readerVisibility(reader, inspectorOpen, false),
      dirty,
      onCloseBrowser: () => setBrowserOpen(false),
      onInspector: () => toggleReader(reader, inspectorOpen, setInspectorOpen),
    },
    library: {
      data,
      loading: family.loading,
      busy: editing.busy,
      schema: currentSchema,
      meaning,
      direction,
      view,
      columns: traceColumns,
      onOpen: openSavedView,
    },
    browser: {
      intent,
      schema,
      editing,
      rootId,
      visible: !presentation.browserHidden,
      selectedRow,
      projectHeading,
      onGoContext: goToContext,
      onChoose: (entity: Entity) => choose(entity, true),
    },
    connected: {
      surface: {
        columns: traceColumns,
        onColumns: setTraceColumns,
        navigation: {
          contextHeading,
          onReturnToList: showBrowser,
          returnContext: presentation.returnContext,
          onReturnContext: returnToContext,
        },
        data,
        loading: family.loading,
        schema: currentSchema,
        meaning,
        direction,
        onScope: (name: string, value: "incoming" | "outgoing") => {
          setMeaning(name);
          setDirection(value);
          navigate(rootId, name, value);
        },
        view,
        onView: setView,
        artifact,
        selectedId: workspaceSelectedEntityId(selected, selectedLink),
        returnSelection,
        actions,
        onArtifact: focusArtifact,
        paging: {
          previous: cursor.hasPrevious,
          onPrevious: cursor.previous,
          onNext: () => cursor.next(data?.nextAfter),
        },
      },
      inspector: {
        authoring: {
          expanded: expandedEditor,
          onExpanded: readerEditing(setExpandedEditor, reader),
          dirty,
          onDirty: setDirty,
        },
        entity: current,
        focusedRead: reader.active,
        onCreate: readerCreateAction(reader, creation.open),
        createDisabled: creation.disabled,
        fieldsInSurface: statementInSurface(
          data,
          current,
          view,
          traceColumns,
          expandedEditor || reader.active,
        ),
        link: currentLink,
        selectedLink,
        nodes: trace.data?.nodes ?? [],
        schema: currentSchema,
        editing,
        paused: inspectorPaused,
        outsideScope: !!data && !selectionLoaded,
        onMap: () => setMapping(null),
        onNavigate: navigateRecorded,
        onOpenReceipt: workspaceReceiptAction(onOpenReceipt, current?.id ?? rootId, data?.root),
        onRemove: () => void remove(),
        canExplore: presentation.canExplore,
        onExplore: explore,
      },
      inspectorOpen: readerVisibility(reader, inspectorOpen, expandedEditor),
      reader,
      returnLabel: `Return to ${data ? label(data.root) : "Work"} scope`,
    },
    mapping: {
      source: current,
      selection: mapping,
      schema: currentSchema,
      editing,
      paused: inspectorPaused,
      onClose: () => setMapping(undefined),
    },
  };
}

function workspaceExplorer(
  current: Entity | undefined,
  data: FamilyWorkspace | undefined,
  allowed: boolean,
  explore: ReturnType<typeof useWorkspaceScope>["exploreFrom"],
  choose: ReturnType<typeof workspaceChoose>,
  presentation: WorkspaceIntent["presentation"],
  apply: (value: WorkspaceIntent["presentation"]) => void,
) {
  return () => {
    if (explore(current, data, allowed, choose, presentation))
      apply({ layout: "relationships", columns: [] });
  };
}
function workspaceMap(
  select: (entity: Entity) => void,
  selectLink: (link: Relationship | undefined) => void,
  map: (slot: RelationshipSlot | null) => void,
) {
  return (entity: Entity, slot?: RelationshipSlot) => {
    select(entity);
    selectLink(undefined);
    map(slot ?? null);
  };
}

function WorkspaceConnectedContext({
  surface,
  inspector,
  inspectorOpen,
  reader,
  returnLabel,
}: {
  surface: ComponentProps<typeof WorkspaceSurface>;
  inspector: ComponentProps<typeof WorkspaceInspector>;
  inspectorOpen: boolean;
  reader: ReturnType<typeof useWorkspaceReader>;
  returnLabel: string;
}) {
  return (
    <>
      <WorkspaceSurface {...surface} />
      <div ref={reader.region} className="workspace-detail-region" hidden={!inspectorOpen}>
        {reader.active && !inspector.authoring.expanded && (
          <button className="workspace-reader-return" onClick={reader.returnToScope}>
            {returnLabel}
          </button>
        )}
        <WorkspaceInspector {...inspector} />
      </div>
    </>
  );
}

type WorkspaceReader = ReturnType<typeof useWorkspaceReader>;
function receiptFromReader(
  open: WorkspaceProps["onOpenReceipt"],
  reader: WorkspaceReader,
  setExpanded: (expanded: boolean) => void,
): WorkspaceProps["onOpenReceipt"] {
  if (!open) return undefined;
  return (receiptId, inputId, context) => {
    const accepted = open(receiptId, inputId, context);
    if (accepted === false) return false;
    reader.hide();
    setExpanded(false);
    return accepted;
  };
}
function readerChoice(choose: ReturnType<typeof workspaceChoose>, reader: WorkspaceReader) {
  return (entity: Entity, root = false, scope?: WorkspaceIntent["scope"]) => {
    const accepted = choose(entity, root, scope);
    if (accepted) {
      if (root) reader.hide();
      else reader.open();
    }
    return accepted;
  };
}
function readerInspection<T>(inspect: (value: T) => boolean, reader: WorkspaceReader) {
  return (value: T) => {
    if (inspect(value)) reader.open();
  };
}
function readerClass(base: string, reader: WorkspaceReader) {
  return `${base}${reader.narrow ? " workspace-narrow" : ""}${reader.active ? " workspace-focused-read" : ""}`;
}
function readerVisibility(reader: WorkspaceReader, inspectorOpen: boolean, expanded: boolean) {
  return reader.narrow ? reader.active || expanded : inspectorOpen;
}
function toggleReader(reader: WorkspaceReader, open: boolean, setOpen: (open: boolean) => void) {
  if (!reader.narrow) {
    setOpen(!open);
    return;
  }
  if (reader.active) reader.returnToScope();
  else reader.open();
}
function readerEditing(setExpanded: (expanded: boolean) => void, reader: WorkspaceReader) {
  return (expanded: boolean) => {
    setExpanded(expanded);
    if (!expanded && reader.active) reader.returnToScope();
  };
}
function readerCreateAction(reader: WorkspaceReader, create: () => void) {
  return () => {
    create();
    reader.hide();
  };
}
function readerBrowser(
  setOpen: (open: boolean) => void,
  setExpanded: (expanded: boolean) => void,
  reader: WorkspaceReader,
) {
  return (open: boolean) => {
    if (open) {
      reader.hide();
      setExpanded(false);
    }
    setOpen(open);
  };
}
function statementInSurface(
  data: FamilyWorkspace | undefined,
  entity: Entity | undefined,
  view: string,
  columns: RelationshipSlot[],
  focused: boolean,
) {
  if (focused || !data || !entity || entity.id === data.root.id) return [];
  return memberStatementInSurface(data, entity, view, columns);
}
function memberStatementInSurface(
  data: FamilyWorkspace,
  entity: Entity,
  view: string,
  columns: RelationshipSlot[],
) {
  if (view !== "reading" && !(view === "trace" && columns.length)) return [];
  const member = data.members.find((member) => member.id === entity.id);
  if (member?.version !== entity.version) return [];
  return entity.fields.statement === undefined || entity.fields.statement === null
    ? ["title"]
    : ["statement"];
}

function workspaceReceiptAction(
  open:
    | ((
        receiptId: string,
        inputId?: string,
        context?: { subjectId: string; returnLabel: string },
      ) => void)
    | undefined,
  subjectId: string,
  root?: Entity,
) {
  if (!open) return undefined;
  const returnLabel = `Return to ${root ? label(root) : "Work"} scope`;
  return (receiptId: string, inputId?: string) =>
    open(receiptId, inputId, { subjectId, returnLabel });
}

function workspaceChoose(
  chooseSelection: (entity: Entity) => boolean,
  selectRoot: (id: string, scope?: WorkspaceIntent["scope"]) => void,
  setBrowserOpen: (open: boolean) => void,
  setInspectorOpen: (open: boolean) => void,
) {
  return (entity: Entity, root = false, scope?: WorkspaceIntent["scope"]) => {
    if (!chooseSelection(entity)) return false;
    if (root) {
      setBrowserOpen(false);
      selectRoot(entity.id, scope);
    }
    setInspectorOpen(true);
    return true;
  };
}

function WorkspaceTaskContext({
  intent,
  rootId,
  meaning,
  direction,
  loading,
}: {
  intent?: WorkspaceIntent;
  rootId?: string;
  meaning: string;
  direction: string;
  loading: boolean;
}) {
  if (
    loading ||
    !intent?.task ||
    rootId !== intent.id ||
    meaning !== intent.scope?.relationship ||
    direction !== intent.scope?.direction
  )
    return null;
  return (
    <details className="workspace-task-context">
      <summary>About this example workspace</summary>
      <h3>{intent.task.title}</h3>
      <p>{intent.task.explanation}</p>
    </details>
  );
}

function useRequestedInspection(
  intent: WorkspaceIntent | undefined,
  choose: (entity: Entity, root: boolean) => boolean,
  report: Editing["report"],
  onPresentation: (value: WorkspaceIntent["presentation"]) => void,
) {
  const inspectRequested = useRef(choose);
  inspectRequested.current = (entity, root) => {
    const accepted = choose(entity, root);
    if (accepted) onPresentation(intent?.presentation ?? { layout: "relationships", columns: [] });
    return accepted;
  };
  useEffect(() => {
    if (!intent?.id) return;
    let active = true;
    read("/api/family", { rootId: intent.id, limit: 1 })
      .then((page) => {
        if (active) inspectRequested.current(page.root, true);
      })
      .catch((error) => {
        if (active) report(error);
      });
    return () => {
      active = false;
    };
  }, [intent?.sequence]);
}

function useWorkspaceScope() {
  const initial = new URLSearchParams(window.location.search);
  const [rootId, setRootId] = useState(initial.get("item") ?? "");
  const [meaning, setMeaning] = useState(initial.get("family") ?? "");
  const [direction, setDirection] = useState<"incoming" | "outgoing">(
    initial.get("direction") === "outgoing" ? "outgoing" : "incoming",
  );
  const cursor = usePageCursor();
  const [traceHistory, setTraceHistory] = useState<
    {
      root: Entity;
      meaning: string;
      direction: "incoming" | "outgoing";
      page: typeof cursor.snapshot;
      presentation: WorkspaceIntent["presentation"];
    }[]
  >([]);
  const navigate = (item: string, familyMeaning: string, familyDirection: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("item", item);
    if (familyMeaning) {
      url.searchParams.set("family", familyMeaning);
      url.searchParams.set("direction", familyDirection);
    } else {
      url.searchParams.delete("family");
      url.searchParams.delete("direction");
    }
    window.history.replaceState(null, "", url);
    cursor.reset();
  };
  const selectRoot = (id: string, scope?: WorkspaceIntent["scope"]) => {
    setTraceHistory([]);
    setRootId(id);
    if (scope) {
      setMeaning(scope.relationship);
      setDirection(scope.direction);
    }
    navigate(id, scope?.relationship ?? meaning, scope?.direction ?? direction);
  };
  const returnToScope = (
    choose: (entity: Entity) => boolean,
    onPresentation: (value: WorkspaceIntent["presentation"]) => void,
  ) => {
    const scope = traceHistory.at(-1);
    if (!scope || !choose(scope.root)) return;
    setRootId(scope.root.id);
    setMeaning(scope.meaning);
    setDirection(scope.direction);
    navigate(scope.root.id, scope.meaning, scope.direction);
    cursor.restore(scope.page);
    onPresentation(scope.presentation);
    setTraceHistory((history) => history.slice(0, -1));
  };
  const exploreFrom = (
    entity: Entity | undefined,
    data: FamilyWorkspace | undefined,
    allowed: boolean,
    choose: (entity: Entity) => boolean,
    presentation: WorkspaceIntent["presentation"],
  ) => {
    if (!entity || !data || !allowed || entity.id === rootId) return false;
    if (!choose(entity)) return false;
    setTraceHistory((history) => [
      ...history,
      { root: data.root, meaning, direction, page: cursor.snapshot, presentation },
    ]);
    setRootId(entity.id);
    setMeaning("");
    navigate(entity.id, "", direction);
    return true;
  };
  return {
    exploreFrom,
    returnToScope,
    selectRoot,
    rootId,
    setRootId,
    meaning,
    setMeaning,
    direction,
    setDirection,
    cursor,
    traceHistory,
    setTraceHistory,
    navigate,
  };
}

function useWorkspaceInspection(
  data: FamilyWorkspace | undefined,
  onFocus: (value: Focus) => void,
  editing: Editing,
) {
  const [selected, setSelected] = useState<Entity>(),
    [selectedLink, setSelectedLink] = useState<Relationship>();
  const [artifact, setArtifact] = useState<string>(),
    [returnSelection, setReturnSelection] = useState<Entity>();
  const [expandedEditor, setExpandedEditor] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [recordedId, setRecordedId] = useState<string>();
  const recorded = useProjection(
    "/api/connections",
    recordedQuery(recordedId, selected, selectedLink),
    editing.epoch,
    editing.report,
  );
  const { current, currentLink, selectionLoaded, schema, authoritative } =
    recordedWorkspaceSelection(data, selected, selectedLink, recorded);
  const guarded = () =>
    !dirty || window.confirm("Discard the unsaved inspector draft to change selection?");
  useEffect(() => {
    if (data && !selected) setSelected(data.root);
  }, [data, selected]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  const chooseSelection = (entity: Entity) => {
    if (entity.id !== selected?.id || selectedLink) {
      if (!guarded()) return false;
      setExpandedEditor(false);
      setDirty(false);
    }
    setSelected(entity);
    setRecordedId(undefined);
    setSelectedLink(undefined);
    setArtifact(undefined);
    onFocus({ id: entity.id, type: entity.type });
    return true;
  };
  const chooseRecorded = (entity: Entity) => {
    if (!chooseSelection(entity)) return false;
    setRecordedId(entity.id);
    return true;
  };
  const inspect = (link: Relationship) => {
    if (link.id === selectedLink?.id) return true;
    if (!guarded()) return false;
    setSelectedLink(link);
    setRecordedId(undefined);
    setExpandedEditor(false);
    setDirty(false);
    return true;
  };
  const focusArtifact = (entity: Entity) => {
    if (artifact === entity.id) return true;
    if (!guarded()) return false;
    if (!artifact) setReturnSelection(current);
    setArtifact(entity.id);
    setExpandedEditor(false);
    setSelected(entity);
    setRecordedId(undefined);
    setSelectedLink(undefined);
    setDirty(false);
    return true;
  };
  return {
    selected,
    setSelected,
    selectedLink,
    setSelectedLink,
    artifact,
    returnSelection,
    expandedEditor,
    setExpandedEditor,
    dirty,
    setDirty,
    current,
    currentLink,
    selectionLoaded,
    chooseSelection,
    chooseRecorded,
    inspect,
    focusArtifact,
    schema,
    authoritative,
  };
}

function recordedQuery(id?: string, entity?: Entity, link?: Relationship) {
  return id && id === entity?.id && !link ? { id, limit: 1 } : undefined;
}

function recordedWorkspaceSelection(
  data: FamilyWorkspace | undefined,
  entity: Entity | undefined,
  link: Relationship | undefined,
  recorded: Projection<"/api/connections">,
) {
  const scoped = workspaceSelection(data, entity, link);
  return {
    current: recorded.ready ? recorded.data?.entity : scoped.current,
    currentLink: scoped.currentLink,
    selectionLoaded: scoped.loaded || recorded.ready,
    schema: recorded.ready ? recorded.data?.schema : undefined,
    authoritative: recorded.ready ? recorded.data?.entity : undefined,
  };
}

function useWorkspaceHeadings() {
  const selectedRow = useRef<HTMLButtonElement>(null);
  const projectHeading = useRef<HTMLHeadingElement>(null);
  const contextHeading = useRef<HTMLHeadingElement>(null);
  return { selectedRow, projectHeading, contextHeading };
}
function useBrowserReturnFocus({
  selectedRow,
  projectHeading,
}: Pick<ReturnType<typeof useWorkspaceHeadings>, "selectedRow" | "projectHeading">) {
  const [request, setRequest] = useState(0);
  useLayoutEffect(() => {
    if (request) (selectedRow.current ?? projectHeading.current)?.focus();
  }, [request]);
  return () => setRequest((value) => value + 1);
}

function workspaceClass(rootId: string, browser: boolean, inspector: boolean, expanded: boolean) {
  return [
    "precision-workspace",
    !rootId && "workspace-overview",
    browser && "browser-open",
    !inspector && "details-closed",
    expanded && "workspace-authoring",
  ]
    .filter(Boolean)
    .join(" ");
}
function WorkspaceNavigation({
  rootId,
  browserOpen,
  inspectorOpen,
  dirty,
  onCloseBrowser,
  onInspector,
  library,
}: {
  rootId: string;
  browserOpen: boolean;
  inspectorOpen: boolean;
  dirty: boolean;
  onCloseBrowser(): void;
  onInspector(): void;
  library: React.ReactNode;
}) {
  return (
    <div className="workspace-navigation">
      {rootId && browserOpen && (
        <button aria-expanded={true} onClick={onCloseBrowser}>
          Hide project browser
        </button>
      )}
      {library}
      {rootId && (
        <button aria-expanded={inspectorOpen} onClick={onInspector}>
          {inspectorOpen ? "Hide details" : "Show details"}
          {dirty ? " · unsaved draft" : ""}
        </button>
      )}
    </div>
  );
}

function useBrowserIntent(intent: WorkspaceIntent | undefined, setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (intent?.type !== undefined || intent?.create) setOpen(true);
  }, [intent?.sequence]);
}

function WorkspaceMapping({
  source,
  selection,
  schema,
  editing,
  paused,
  onClose,
}: {
  source?: Entity;
  selection: RelationshipSlot | null | undefined;
  schema: SchemaObject;
  editing: Editing;
  paused: boolean;
  onClose(): void;
}) {
  if (selection === undefined || !source) return null;
  return (
    <MappingDialog
      source={source}
      initialSlot={selection ?? undefined}
      schema={schema}
      editing={editing}
      paused={paused}
      onClose={onClose}
    />
  );
}

async function removeConnection(
  selectedLink: Relationship | undefined,
  paused: boolean,
  currentSchema: SchemaObject,
  editing: Editing,
  onRemoved: () => void,
) {
  if (
    !selectedLink ||
    paused ||
    !window.confirm(
      "Remove this recorded connection? Its history remains; other mappings are unchanged.",
    )
  )
    return;
  if (
    await editing.commit(
      [{ op: "relationship.remove", id: selectedLink.id, expectedVersion: selectedLink.version }],
      currentSchema.version,
    )
  ) {
    onRemoved();
  }
}

function workspacePresentation(
  rootId: string,
  browserOpen: boolean,
  previousRoot: Entity | undefined,
  current: Entity | undefined,
) {
  return {
    browserHidden: !!rootId && !browserOpen,
    returnContext: previousRoot ? label(previousRoot) : undefined,
    canExplore: current?.id !== rootId,
  };
}

function familyQuery(
  rootId: string,
  relationshipType: string,
  direction: "incoming" | "outgoing",
  after: string | undefined,
) {
  if (!rootId) return undefined;
  return { rootId, relationshipType: relationshipType || undefined, direction, after, limit: 12 };
}

function useContextEntry(rootId: string, heading: React.RefObject<HTMLHeadingElement | null>) {
  useEffect(() => {
    if (!rootId) return;
    heading.current?.focus();
    if (window.matchMedia("(max-width: 1000px)").matches)
      heading.current?.scrollIntoView({ block: "start" });
  }, [rootId]);
}

function applyPresentation(
  presentation: WorkspaceIntent["presentation"],
  setView: (value: string) => void,
  setColumns: (value: RelationshipSlot[]) => void,
) {
  if (!presentation) return;
  setView(presentation.layout);
  setColumns(presentation.columns);
}
async function openFamilyView(
  definition: ViewDefinition,
  choose: (entity: Entity, root: boolean, scope: WorkspaceIntent["scope"]) => boolean,
  apply: (value: WorkspaceIntent["presentation"]) => void,
) {
  if (definition.kind !== "family") return false;
  const page = await read("/api/family", { rootId: definition.rootId, limit: 1 });
  if (
    definition.relationshipType &&
    !Object.hasOwn(page.schema.relationshipTypes, definition.relationshipType)
  )
    throw new Error(
      "Saved relationship is no longer declared. Choose a current scope and update this view.",
    );
  if (
    !choose(page.root, true, {
      relationship: definition.relationshipType ?? "",
      direction: definition.direction,
    })
  )
    return false;
  apply({ layout: definition.layout, columns: definition.columns });
  return true;
}

function currentFamilyView(
  data: FamilyWorkspace | undefined,
  meaning: string,
  direction: FamilyView["direction"],
  view: string,
  columns: RelationshipSlot[],
): FamilyView | undefined {
  if (!data) return undefined;
  return {
    kind: "family",
    rootId: data.root.id,
    ...(meaning ? { relationshipType: meaning } : {}),
    direction,
    layout: view as FamilyView["layout"],
    columns,
  };
}

function WorkspaceViewLibrary({
  data,
  loading,
  busy,
  schema,
  meaning,
  direction,
  view,
  columns,
  onOpen,
}: {
  data?: FamilyWorkspace;
  loading: boolean;
  busy: boolean;
  schema: SchemaObject;
  meaning: string;
  direction: FamilyView["direction"];
  view: string;
  columns: RelationshipSlot[];
  onOpen(value: ViewDefinition): Promise<boolean>;
}) {
  const definition = loading
    ? undefined
    : currentFamilyView(data, meaning, direction, view, columns);
  return (
    <div className="workspace-view-library">
      <SavedViewPanel
        definition={definition}
        schemaVersion={schema.version}
        disabled={busy || loading}
        onOpen={onOpen}
      />
    </div>
  );
}

function enterContext(
  setBrowserOpen: (value: boolean) => void,
  heading: React.RefObject<HTMLHeadingElement | null>,
) {
  setBrowserOpen(false);
  requestAnimationFrame(() => {
    heading.current?.focus();
    heading.current?.parentElement?.scrollIntoView({ block: "start" });
  });
}

function useWorkspaceTraceRead(data: FamilyWorkspace | undefined, epoch: number, view: string) {
  const [trace, setTrace] = useState<{
    graph?: Graph;
    epoch: number;
    ready: boolean;
    active: boolean;
  }>();
  const onRead = useCallback(
    (graph: Graph | undefined, ready: boolean, active: boolean) => {
      setTrace({ graph, ready, active, epoch });
    },
    [epoch],
  );
  const current = view === "graph" && trace?.epoch === epoch;
  const graph = current ? traceSelectionGraph(trace, data) : undefined;
  return {
    data:
      graph && data
        ? { ...data, schema: graph.schema, nodes: graph.nodes, links: graph.links }
        : data,
    pending: current && trace.active && !trace.ready,
    onRead,
  };
}

function workspaceReadPending(family: boolean, trace: boolean | undefined) {
  return family || !!trace;
}
function traceSelectionGraph(
  trace: { ready: boolean; graph?: Graph } | undefined,
  data: FamilyWorkspace | undefined,
) {
  if (!trace?.ready || !data) return undefined;
  return trace.graph?.rootId === data.root.id ? trace.graph : undefined;
}

function workspaceInspectionSchema(data: FamilyWorkspace | undefined, fallback: SchemaObject) {
  return data?.schema ?? fallback;
}
