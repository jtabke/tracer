// Superseded shell retained only for component and contract regressions.
// Production mounts ui/unified-app.tsx; this file is never a product entry point.
import { lazy, Suspense, useEffect, useState } from "react";
import type { ChangesetInput, Operation } from "../src/application/commands.ts";
import type { ChainQuery } from "../src/application/views.ts";
import type { Schema, SchemaObject } from "../src/core/model.ts";
import type { DemoTask } from "../src/interfaces/demo-guide.ts";
import { ApiError, connect, read } from "../ui/api.ts";
import { TableWorkspace } from "./legacy-ui/components/chain-table.tsx";
import { ConfigurationWorkspace } from "../ui/configuration-workspace.tsx";
import { useConfigurationNavigation } from "./legacy-ui/components/use-configuration-navigation.ts";
import { ProjectHome, useProjectGuide } from "./legacy-ui/components/project-studio.tsx";
import type { ViewDefinition } from "../src/core/presentation.ts";
import type { Focus } from "../ui/editing.ts";
import { EvidenceView } from "../ui/evidence.tsx";
import {
  EvidenceReviewStage,
  type EvidenceReviewStageProps,
} from "../ui/evidence-review-stage.tsx";
import { useCaptureNavigation } from "./legacy-ui/components/use-capture-navigation.ts";
import { GraphView } from "./legacy-ui/components/graph.tsx";
import { MatrixView } from "./legacy-ui/components/matrix.tsx";
import { ModelOverview } from "./legacy-ui/components/model-overview.tsx";
import { MutationRecovery } from "../ui/mutation-recovery.tsx";
import "../ui/style.css";
import { useMutation } from "../ui/use-mutation.ts";
import { WorkView } from "./legacy-ui/components/work.tsx";
import type { WorkspaceIntent } from "./legacy-ui/components/workspace.tsx";
import { Workspace } from "./legacy-ui/components/workspace.tsx";
import "./legacy-ui/components/studio.css";
const DocumentationView = lazy(() =>
  import("../ui/documentation.tsx").then((module) => ({ default: module.DocumentationView })),
);
const queryViews = ["work", "graph", "table", "matrix"];
const views = [
  "project",
  "workspace",
  "evidence",
  "configurations",
  "model",
  "work",
  "graph",
  "table",
  "matrix",
  "docs",
];
const viewLabels: Record<string, string> = {
  project: "Project",
  workspace: "Work",
  evidence: "Evaluations",
  configurations: "Configurations",
  model: "Model",
  work: "Direct editor",
  graph: "Graph query",
  table: "Trace query",
  matrix: "Matrix query",
  docs: "Documentation",
};

export function App() {
  const {
    tab,
    opened,
    sharedFocus,
    setSharedFocus,
    intent,
    activate,
    browse,
    findItems,
    createItem,
    inspect,
    openTask,
    openChain,
    chainIntent,
    openView,
  } = useProjectNavigation();
  const { epoch, setEpoch, status, setStatus, error, setError, report, changed } =
    useProjectWriteState();
  const projectGuide = useProjectGuide();
  const mutation = useMutation(report);
  const busy = mutation.busy;
  const [temporal, setTemporal] = useState(false);
  const captureNavigation = useCaptureNavigation(tab, activate, findItems, viewLabels);
  const { visibleTab, openReceipt, navigate } = captureNavigation;
  const configurationNavigation = useConfigurationNavigation(captureNavigation);
  const { schema, setSchema, loading, refresh } = useProjectRead(report, () => {
    setEpoch((value) => value + 1);
    setStatus(
      "Current data refreshed. Unsaved drafts are retained; review their captured versions.",
    );
  });
  const schemaCommitBlocked = mutation.blocked || temporal;
  const commit = async (operations: Operation[], expectedSchemaVersion: number) => {
    if (schemaCommitBlocked) return false;
    const input: ChangesetInput = {
      operations: operations.map((operation) =>
        operation.op === "entity.create" || operation.op === "relationship.create"
          ? { ...operation, id: operation.id ?? crypto.randomUUID() }
          : operation,
      ),
      expectedSchemaVersion,
    };
    setStatus("");
    setError(undefined);
    const result = await mutation.run("/api/changesets", input);
    if (!result) return false;
    setStatus(`Saved changeset ${result.changeset.projectRevision}. All views refreshed.`);
    setEpoch((value) => value + 1);
    return true;
  };
  useSetupNavigation(schema, tab, activate);
  const saveSchema = async (draft: Schema, expectedVersion: number) => {
    if (schemaCommitBlocked) return false;
    setStatus("");
    setError(undefined);
    const value = await mutation.run("/api/schema", { schema: draft, expectedVersion });
    if (!value) return false;
    setSchema(value);
    setEpoch((value) => value + 1);
    setStatus(`Model saved as schema v${value.version}. Existing item drafts are retained.`);
    return true;
  };
  const mutate = guardedProjectMutation(mutation, schemaCommitBlocked, () => {
    setStatus("");
    setError(undefined);
  });
  const editing = {
    busy: schemaCommitBlocked,
    epoch,
    commit,
    mutate,
    report,
    error: error?.message,
  };
  const projectSchema = schema ?? null;
  return (
    <main className="precision-app studio-app">
      <StudioRail
        guide={projectGuide.guide}
        tab={tab}
        activate={navigate}
        toolsVisible={!captureNavigation.active}
      />

      <div className="studio-main">
        <ProjectHeader
          schema={schema}
          busy={busy || loading}
          refresh={refresh}
          title={captureNavigation.title}
          onFind={captureNavigation.find}
          projectName={projectGuide.guide?.title.split(" — ")[0] ?? "Local project"}
        />
        <CaptureResume
          navigation={captureNavigation}
          contextualReceiptId={configurationNavigation.intent?.origin?.receiptId}
        />
        <p className="status" role="status" aria-live="polite">
          {busy ? "Saving…" : status}
        </p>
        <ProjectError error={error} />
        <ProjectPanel name="docs" tab={visibleTab} opened={opened}>
          <Suspense fallback={<p role="status">Opening documentation…</p>}>
            <DocumentationView active={visibleTab === "docs"} />
          </Suspense>
        </ProjectPanel>
        <MutationRecovery
          mutation={mutation}
          refreshed={() => void refresh()}
          resumed={() => {
            setError(undefined);
            setStatus("Drafts retained. Continue after inspecting the saved records.");
          }}
        />
        <ProjectReadBoundary loading={loading} failed={schema === undefined}>
          <>
            <ProjectGuideNotice error={projectGuide.error} retry={projectGuide.retry} />
            <ProjectPanel name="project" tab={visibleTab} opened={opened}>
              <ProjectHome
                schema={projectSchema}
                guide={projectGuide.guide}
                visible={tab === "project"}
                epoch={epoch}
                report={report}
                onTask={openTask}
                onChain={openChain}
                busy={editing.busy}
                onView={activate}
                onOpen={openView}
                onBrowse={browse}
                onCreate={createItem}
              />
            </ProjectPanel>
            <ProjectPanel name="configurations" tab={visibleTab} opened={opened}>
              <ConfigurationWorkspace
                intent={configurationNavigation.intent}
                onReturn={configurationNavigation.returnToResult}
                returnLabel="Return to recorded result"
                epoch={epoch}
                busy={editing.busy}
                changed={changed}
                report={report}
              />
            </ProjectPanel>
            {temporal && (
              <p role="status">
                Native history selected. All mutations are disabled. Workspace, Model, Work, Table,
                Matrix and Evidence show current data, not reconstructed history.
              </p>
            )}
            <ProjectPanel name="model" tab={visibleTab} opened={opened}>
              <ModelOverview
                schema={projectSchema}
                visible={visibleTab === "model"}
                epoch={epoch}
                busy={schemaCommitBlocked}
                report={report}
                onSave={saveSchema}
                onCreate={createItem}
                onBrowse={browse}
                onInspect={inspect}
              />
            </ProjectPanel>
            <NativePanel
              name="workspace"
              tab={visibleTab}
              opened={opened}
              schema={projectSchema}
              fallback={<p>Configure model before browsing or creating items.</p>}
            >
              <Workspace
                schema={projectSchema!}
                editing={editing}
                onFocus={setSharedFocus}
                intent={intent}
                onOpenReceipt={openReceipt}
              />
            </NativePanel>
            <NativePanel name="work" tab={visibleTab} opened={opened} schema={projectSchema}>
              <WorkView
                schema={projectSchema!}
                editing={editing}
                sharedFocus={sharedFocus}
                onFocus={setSharedFocus}
                onTable={() => activate("table")}
              />
            </NativePanel>
            <NativePanel name="graph" tab={visibleTab} opened={opened} schema={projectSchema}>
              <GraphView
                schema={projectSchema!}
                editing={editing}
                sharedFocus={sharedFocus}
                onFocus={setSharedFocus}
                onTemporal={setTemporal}
                visible={visibleTab === "graph"}
                changed={changed}
              />
            </NativePanel>
            <NativePanel name="table" tab={visibleTab} opened={opened} schema={projectSchema}>
              <TableWorkspace
                schema={projectSchema!}
                editing={editing}
                sharedFocus={sharedFocus}
                onFocus={setSharedFocus}
                intent={chainIntent}
              />
            </NativePanel>
            <NativePanel name="matrix" tab={visibleTab} opened={opened} schema={projectSchema}>
              <MatrixView
                key={schema?.version}
                schema={projectSchema!}
                editing={editing}
                sharedFocus={sharedFocus}
                onFocus={setSharedFocus}
              />
            </NativePanel>
            <EvidenceCatalogue
              tab={visibleTab}
              opened={opened}
              schema={schema}
              epoch={epoch}
              changed={changed}
              report={report}
              mutate={mutate}
              busy={editing.busy}
              onOpenReceipt={openReceipt}
            />
            <CapturedResult
              onOpenConfiguration={configurationNavigation.open}
              navigation={captureNavigation}
              epoch={epoch}
              changed={changed}
              mutate={mutate}
              report={report}
              busy={editing.busy}
            />
          </>
        </ProjectReadBoundary>
      </div>
    </main>
  );
}

function ProjectGuideNotice({ error, retry }: { error: string; retry(): void }) {
  if (!error) return null;
  return (
    <p role="alert">
      Example guide could not be loaded. <button onClick={retry}>Retry example guide</button>
    </p>
  );
}

type CaptureNavigation = ReturnType<typeof useCaptureNavigation>;
function CaptureResume({
  navigation,
  contextualReceiptId,
}: {
  navigation: CaptureNavigation;
  contextualReceiptId?: string;
}) {
  if (!navigation.capture || navigation.active) return null;
  if (
    navigation.visibleTab === "configurations" &&
    navigation.capture.receiptId === contextualReceiptId
  )
    return null;
  return (
    <div className="studio-resume">
      <button onClick={navigation.resume}>{navigation.resumeLabel}</button>
    </div>
  );
}
function EvidenceCatalogue({
  tab,
  opened,
  schema,
  busy,
  ...props
}: {
  tab: string;
  opened: Set<string>;
  schema: SchemaObject | null | undefined;
  busy: boolean;
} & Pick<EvidenceReviewStageProps, "epoch" | "changed" | "mutate" | "report"> & {
    onOpenReceipt: CaptureNavigation["openReceipt"];
  }) {
  return (
    <ProjectPanel name="evidence" tab={tab} opened={opened}>
      <fieldset disabled={busy}>
        <legend className="sr-only">Current evidence</legend>
        {schema && <EvidenceView {...props} />}
      </fieldset>
    </ProjectPanel>
  );
}

function CapturedResult({
  navigation,
  ...props
}: {
  navigation: CaptureNavigation;
} & Pick<
  EvidenceReviewStageProps,
  "epoch" | "changed" | "mutate" | "report" | "busy" | "onOpenConfiguration"
>) {
  if (!navigation.capture) return null;
  return (
    <EvidenceReviewStage
      {...props}
      receiptId={navigation.capture.receiptId}
      focusInputId={navigation.capture.focusInputId}
      subjectId={navigation.capture.subjectId}
      returnLabel={navigation.capture.returnLabel}
      active={navigation.active}
      onDraftChange={navigation.setDirty}
      discardRevision={navigation.discardRevision}
      onReturn={navigation.returnToOrigin}
      onReceiptChangeBlocked={navigation.receiptChangeBlocked}
    />
  );
}

export function ProjectError({
  error,
}: {
  error?: { message: string; attempted?: string; uncertain?: boolean };
}) {
  return (
    <>
      {" "}
      {error && (
        <aside role="alert" className="error">
          <strong>{error.message}</strong>
          <p>
            {error.uncertain
              ? "The save may have completed. Your draft is retained. Refresh and inspect current data/history before deciding whether to retry."
              : error.attempted
                ? "Nothing was saved by the rejected operation. Review the preserved proposal before retrying."
                : "This read failed. Refresh or narrow the view to retry; existing drafts remain in their view."}
          </p>
          {error.attempted && (
            <details open>
              <summary>Attempted changes</summary>
              <pre>{error.attempted}</pre>
            </details>
          )}
        </aside>
      )}
    </>
  );
}

export function ProjectTabs({ tab, activate }: { tab: string; activate: (name: string) => void }) {
  const primary = views.slice(0, 5);
  return (
    <nav className="studio-tabs" role="tablist" aria-label="Project views">
      {primary.map((name) => (
        <ProjectTab key={name} name={name} tab={tab} activate={activate} navigation={primary} />
      ))}
    </nav>
  );
}

function QueryTools({ tab, activate }: { tab: string; activate(name: string): void }) {
  const tools = queryViews;
  return (
    <nav className="studio-query-tools" role="tablist" aria-label="Query tools">
      <span>Queries</span>
      {tools.map((name) => (
        <ProjectTab key={name} name={name} tab={tab} activate={activate} navigation={tools} />
      ))}
    </nav>
  );
}

function ProjectTab({
  name,
  tab,
  activate,
  navigation = views,
}: {
  name: string;
  tab: string;
  activate(name: string): void;
  navigation?: string[];
}) {
  const selected = tab === name || (name === "workspace" && queryViews.includes(tab));
  const activeName = navigation.includes(tab)
    ? tab
    : navigation.includes("workspace") && queryViews.includes(tab)
      ? "workspace"
      : navigation[0];
  return (
    <button
      id={`tab-${name}`}
      role="tab"
      aria-selected={selected}
      aria-controls={`panel-${name}`}
      tabIndex={name === activeName ? 0 : -1}
      onClick={() => activate(name)}
      onKeyDown={(event) => {
        if (
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
        ) {
          event.preventDefault();
          const tabs = navigation;
          const next =
            event.key === "Home"
              ? tabs[0]
              : event.key === "End"
                ? tabs[tabs.length - 1]
                : tabs[
                    (tabs.indexOf(name) +
                      (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : tabs.length - 1)) %
                      tabs.length
                  ];
          activate(next);
          const target = document.getElementById(`tab-${next}`);
          const group = target?.closest("details");
          if (group) group.open = true;
          requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
        }
      }}
    >
      <span className="nav-symbol" aria-hidden="true">
        {<StudioIcon name={name} />}
      </span>
      {viewLabels[name]}
    </button>
  );
}

function StudioIcon({ name }: { name: string }) {
  const shapes: Record<string, React.ReactNode> = {
    project: <path d="M3 7h6l2-3h10v16H3z" />,
    workspace: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 4v16M8 9h13" />
      </>
    ),
    evidence: (
      <>
        <path d="M8 3h8M10 3v6l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3M7 16h10" />
      </>
    ),
    configurations: (
      <>
        <path d="m3 7 9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4" />
      </>
    ),
    model: (
      <>
        <rect x="2" y="3" width="6" height="6" rx="1" />
        <rect x="16" y="15" width="6" height="6" rx="1" />
        <path d="M8 6h8v12" />
      </>
    ),
    work: (
      <>
        <path d="m5 15 11-11 4 4L9 19l-5 1zM13 7l4 4" />
      </>
    ),
    graph: (
      <>
        <circle cx="5" cy="6" r="3" />
        <circle cx="19" cy="5" r="3" />
        <circle cx="12" cy="19" r="3" />
        <path d="M8 6h8M7 9l4 7M17 8l-4 8" />
      </>
    ),
    table: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M9 4v16M15 4v16" />
      </>
    ),
    matrix: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
      </>
    ),
    docs: <path d="M4 3h12l4 4v14H4zM16 3v5h4M8 12h8M8 16h8" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name]}
    </svg>
  );
}

export function projectError(error: unknown, attempted?: unknown) {
  return {
    message: `${error instanceof ApiError ? error.code : "validation"}: ${error instanceof Error ? error.message : String(error)}`,
    uncertain: error instanceof ApiError && error.code === "outcome_unknown",
    attempted:
      attempted === undefined ? undefined : JSON.stringify(attempted, null, 2).slice(0, 12000),
  };
}

function useProjectRead(report: (error: unknown) => void, refreshed: () => void) {
  const [schema, setSchema] = useState<SchemaObject | null>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    connect()
      .then(() => read("/api/schema", {}))
      .then((value) => {
        if (active) setSchema(value);
      })
      .catch((error) => {
        if (active) report(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const refresh = async () => {
    try {
      setSchema(await read("/api/schema", {}));
      refreshed();
    } catch (error) {
      report(error);
    }
  };
  return { schema, setSchema, loading, refresh };
}

type PanelProps = { name: string; tab: string; opened: Set<string>; children: React.ReactNode };
/** Open once, retain the same mounted draft owner across hidden tabs. */
export function ProjectPanel({ name, tab, opened, children }: PanelProps) {
  return (
    <div role="tabpanel" id={`panel-${name}`} aria-labelledby={`tab-${name}`} hidden={tab !== name}>
      {opened.has(name) && children}
    </div>
  );
}
/** Creating an element does not mount it: native children run only with a schema. */
export function NativePanel({
  schema,
  fallback,
  ...panel
}: PanelProps & { schema: SchemaObject | null; fallback?: React.ReactNode }) {
  return <ProjectPanel {...panel}>{schema ? panel.children : fallback}</ProjectPanel>;
}

function useProjectNavigation() {
  const initialView = initialProjectView();
  const [tab, setTab] = useState(initialView);
  const [opened, setOpened] = useState(new Set([initialView]));
  const [sharedFocus, setSharedFocus] = useState<Focus>();
  const [intent, setIntent] = useState<WorkspaceIntent>();
  const [chainIntent, setChainIntent] = useState<{ sequence: number; query: ChainQuery }>();
  const activate = (name: string) => {
    setTab(name);
    const url = new URL(window.location.href);
    url.searchParams.set("view", name);
    window.history.replaceState(null, "", url);
    setOpened((previous) => new Set([...previous, name]));
  };
  const browse = (type: string) => {
    setIntent((previous) => ({ sequence: (previous?.sequence ?? 0) + 1, type }));
    activate("workspace");
  };
  const findItems = () => {
    setIntent((previous) => ({ sequence: (previous?.sequence ?? 0) + 1, type: "", find: true }));
    activate("workspace");
  };
  const createItem = () => {
    setIntent((previous) => ({ sequence: (previous?.sequence ?? 0) + 1, create: true }));
    activate("workspace");
  };
  const inspect = (id: string) => {
    setIntent((previous) => ({ sequence: (previous?.sequence ?? 0) + 1, id }));
    activate("workspace");
  };
  const openTask = (task: DemoTask) => {
    setIntent((previous) => ({
      sequence: (previous?.sequence ?? 0) + 1,
      id: task.rootId,
      scope: { relationship: task.relationship, direction: task.direction },
      presentation: task.presentation,
      task: { title: task.title, explanation: task.explanation },
    }));
    activate("workspace");
  };
  const openChain = (query: ChainQuery) => {
    setChainIntent((previous) => ({ sequence: (previous?.sequence ?? 0) + 1, query }));
    activate("table");
  };
  const openView = (view: ViewDefinition) => {
    if (view.kind === "chain") {
      openChain({
        type: view.type,
        steps: view.steps,
        ...(view.search ? { search: view.search } : {}),
      });
      return;
    }
    setIntent((previous) => ({
      sequence: (previous?.sequence ?? 0) + 1,
      id: view.rootId,
      scope: { relationship: view.relationshipType ?? "", direction: view.direction },
      presentation: { layout: view.layout, columns: view.columns },
    }));
    activate("workspace");
  };
  return {
    openView,
    tab,
    opened,
    sharedFocus,
    setSharedFocus,
    intent,
    activate,
    browse,
    findItems,
    createItem,
    inspect,
    openTask,
    openChain,
    chainIntent,
  };
}
function useProjectWriteState() {
  const [epoch, setEpoch] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<ReturnType<typeof projectError>>();
  const report = (error: unknown, attempted?: unknown) => {
    setStatus("");
    setError(projectError(error, attempted));
  };
  return {
    epoch,
    setEpoch,
    status,
    setStatus,
    error,
    setError,
    report,
    changed: () => setEpoch((value) => value + 1),
  };
}

function guardedProjectMutation(
  mutation: ReturnType<typeof useMutation>,
  blocked: boolean,
  clearNotice: () => void,
): typeof mutation.run {
  return async (path, input) => {
    if (blocked) return undefined;
    clearNotice();
    return mutation.run(path, input);
  };
}

function useSetupNavigation(
  schema: SchemaObject | null | undefined,
  tab: string,
  activate: (name: string) => void,
) {
  useEffect(() => {
    if (schema === null && tab !== "docs") activate("model");
  }, [schema]);
}

function ProjectHeader({
  schema,
  busy,
  refresh,
  title,
  onFind,
  projectName,
}: {
  title: string;
  onFind(): void;
  projectName: string;
  schema: SchemaObject | null | undefined;
  busy: boolean;
  refresh(): Promise<void>;
}) {
  return (
    <header>
      <div>
        <p className="studio-breadcrumb">
          <span>{projectName}</span>
          <span aria-hidden="true">/</span>
          <strong>{title}</strong>
        </p>
      </div>
      <div className="toolbar">
        <button className="studio-find" onClick={onFind}>
          Find items
        </button>
        <details className="project-technical">
          <summary>Project details</summary>
          <span className="muted">
            {schema ? `Schema v${schema.version} · SQLite` : "Local project"}
          </span>
        </details>
        <button disabled={busy} onClick={() => void refresh()}>
          Refresh current data
        </button>
      </div>
    </header>
  );
}

function StudioRail({
  guide,
  tab,
  activate,
  toolsVisible,
}: {
  guide?: import("../src/interfaces/demo-guide.ts").DemoGuide | null;
  tab: string;
  activate(name: string): void;
  toolsVisible: boolean;
}) {
  return (
    <aside className="studio-rail" aria-label="Project navigation">
      <div className="studio-brand">
        <span className="brand-mark" aria-hidden="true">
          ↗
        </span>
        Tracer<span className="brand-caption">STUDIO</span>
      </div>
      <div className="rail-project">
        <span className="project-monogram" aria-hidden="true">
          {guide?.title[0] ?? "T"}
        </span>
        <div>
          <strong>{guide?.title.split(" — ")[0] ?? "Local project"}</strong>
          <small>{guide ? "Example project" : "Your workspace"}</small>
        </div>
      </div>
      <ProjectTabs tab={tab} activate={activate} />
      {toolsVisible && <QueryTools tab={tab} activate={activate} />}
      <button
        id="tab-docs"
        className="studio-documentation-entry"
        aria-current={tab === "docs" ? "page" : undefined}
        aria-controls="panel-docs"
        onClick={() => activate("docs")}
      >
        <StudioIcon name="docs" />
        Documentation
      </button>
      <div className="rail-bottom">
        <small>LOCAL WORKSPACE</small>
        <span>Saved in your project database</span>
      </div>
    </aside>
  );
}

function ProjectReadBoundary({
  loading,
  failed,
  children,
}: {
  loading: boolean;
  failed: boolean;
  children: React.ReactNode;
}) {
  if (loading) return <p>Opening project…</p>;
  if (failed)
    return (
      <section>
        <h2>Project could not be opened</h2>
        <p>Refresh to retry. A failed read is not an empty project.</p>
      </section>
    );
  return children;
}

function initialProjectView() {
  if (typeof window === "undefined") return "project";
  const params = new URLSearchParams(window.location.search);
  const selected = params.get("view");
  if (selected && views.includes(selected)) return selected;
  return params.has("item") ? "workspace" : "project";
}
