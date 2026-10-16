import { useState } from "react";
import type { ChainQuery } from "../../../src/application/views.ts";
import type { SchemaObject } from "../../../src/core/model.ts";
import type { ViewDefinition } from "../../../src/core/presentation.ts";
import type { DemoGuide, DemoTask } from "../../../src/interfaces/demo-guide.ts";
import { ApiError, read } from "../../../ui/api.ts";
import { useRead } from "../../../ui/use-read.ts";
import { DemoGuide as PreparedTraces } from "./demo-guide.tsx";

export function useProjectGuide() {
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const result = useRead(
    "project-guide",
    retry,
    async () => {
      try {
        return await read("/api/demo-guide", {});
      } catch (error) {
        if (error instanceof ApiError && error.code === "not_found") return null;
        throw error;
      }
    },
    (failure) => setError(String(failure)),
  );
  return {
    guide: result.data,
    error: result.failed ? error : "",
    retry: () => setRetry((value) => value + 1),
  };
}

export function ProjectHome({
  schema,
  guide,
  visible,
  epoch,
  report,
  onTask,
  onChain,
  busy,
  onView,
  onOpen,
  onBrowse,
  onCreate,
}: {
  schema: SchemaObject | null;
  guide?: DemoGuide | null;
  visible: boolean;
  epoch: number;
  report(error: unknown): void;
  onTask(task: DemoTask): void;
  onChain(query: ChainQuery): void;
  busy: boolean;
  onView(name: string): void;
  onOpen(view: ViewDefinition): void;
  onBrowse(type: string): void;
  onCreate(): void;
}) {
  const { work, saved } = useProjectHomeRead(schema, visible, epoch, report);
  const types = work.data?.types ?? [];
  const title = guide?.title.split(" — ")[0] ?? "Your project";
  const savedViews = <HomeSavedViews saved={saved} onOpen={onOpen} />;
  const hasSaved = !!saved.data?.length;
  return (
    <section className="studio-home" aria-label="Project home">
      <ProjectHomeHeading
        title={title}
        guide={guide}
        schema={schema}
        onCreate={onCreate}
        onView={onView}
      />
      <div className="home-content">
        <div>
          {hasSaved && savedViews}
          <div className="home-section-heading">
            <h2>{guide ? "Explore the example" : "Working scopes"}</h2>
          </div>
          <HomeScopes
            guide={guide}
            empty={work.data?.total === 0}
            schema={schema}
            onTask={onTask}
            onView={onView}
          />
          <PreparedTraces guide={guide} busy={busy} onChain={onChain} />
          {!hasSaved && savedViews}
        </div>
        <HomeContext
          types={types}
          ready={work.ready}
          failed={work.failed}
          onBrowse={onBrowse}
          onView={onView}
        />
      </div>
    </section>
  );
}

function HomeSavedViews({
  saved,
  onOpen,
}: {
  saved: ReturnType<typeof useProjectHomeRead>["saved"];
  onOpen(view: ViewDefinition): void;
}) {
  return (
    <div className="home-saved-section">
      <div className="home-section-heading">
        <h2>Saved views</h2>
      </div>
      {saved.loading && <p role="status">Loading saved views…</p>}
      {saved.failed && <p role="alert">Saved views could not be loaded. Refresh to retry.</p>}
      {saved.ready && !saved.data?.length && (
        <p className="muted">
          No saved views yet. Save a useful family or trace from its workspace.
        </p>
      )}
      <div className="home-saved">
        {saved.data?.map((view) => (
          <button key={view.id} onClick={() => onOpen(view.definition)}>
            <span aria-hidden="true">▤</span>
            <div>
              <strong>{view.name}</strong>
              <small>
                {view.definition.kind === "family" ? "Connected family" : "Trace table"} · saved v
                {view.version}
              </small>
            </div>
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HomeScopes({
  guide,
  empty,
  schema,
  onTask,
  onView,
}: {
  guide?: DemoGuide | null;
  empty: boolean;
  schema: SchemaObject | null;
  onTask(task: DemoTask): void;
  onView(name: string): void;
}) {
  return (
    <>
      {guide ? (
        <div className="home-scopes">
          {guide.tasks.map((task, index) => (
            <button
              key={task.title}
              className="home-scope"
              aria-label={`Explore scope · ${task.title}`}
              aria-describedby={`example-scope-${index}`}
              onClick={() => onTask(task)}
            >
              <span className="scope-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{task.title}</h3>
                <p id={`example-scope-${index}`}>{task.explanation}</p>
                <small>
                  {task.root} · {task.direction === "incoming" ? "←" : "→"}{" "}
                  {task.relationship.replaceAll("_", " ")}
                </small>
              </div>
              <span className="scope-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="home-start">
          <h3>{empty ? "Make your first connection" : "Choose where to begin"}</h3>
          <p>
            Select an item to explore its relationships. Save a scope from that workspace to return
            to it here.
          </p>
          <button onClick={() => onView(schema ? "workspace" : "model")}>
            {schema ? "Find a starting item" : "Define your project model"}
          </button>
        </div>
      )}
    </>
  );
}

function HomeContext({
  types,
  ready,
  failed,
  onBrowse,
  onView,
}: {
  types: { type: string; count: number }[];
  ready: boolean;
  failed: boolean;
  onBrowse(type: string): void;
  onView(name: string): void;
}) {
  return (
    <aside className="home-context">
      <p className="eyebrow">PROJECT LIBRARY</p>
      <h2>Connected work</h2>
      <p className="muted">
        {ready
          ? `${types.reduce((sum, type) => sum + type.count, 0)} items across ${types.length} types`
          : failed
            ? "Project library could not be loaded."
            : "Reading project…"}
      </p>
      <HomeTypeIndex types={types} onBrowse={onBrowse} className="home-type-index-desktop" />
      <details className="home-type-disclosure">
        <summary>
          Browse items by type <span>{types.length}</span>
        </summary>
        <HomeTypeIndex types={types} onBrowse={onBrowse} />
      </details>
      <div className="home-evidence-entry">
        <h3>What supports the design?</h3>
        <p>Read recorded outcomes and compare their captured inputs with the current design.</p>
        <button onClick={() => onView("evidence")}>
          Explore evaluations <span aria-hidden="true">→</span>
        </button>
      </div>
      <button className="home-model-entry" onClick={() => onView("model")}>
        Explore the project model →
      </button>
    </aside>
  );
}

function HomeTypeIndex({
  types,
  onBrowse,
  className = "",
}: {
  types: { type: string; count: number }[];
  onBrowse(type: string): void;
  className?: string;
}) {
  return (
    <div className={`home-type-index ${className}`}>
      {types.map((type) => (
        <button key={type.type} onClick={() => onBrowse(type.type)}>
          <span>{type.type.replaceAll("_", " ")}</span>
          <span>{type.count}</span>
        </button>
      ))}
    </div>
  );
}

function useProjectHomeRead(
  schema: SchemaObject | null,
  visible: boolean,
  epoch: number,
  report: (error: unknown) => void,
) {
  const work = useRead(
    "project-index",
    epoch,
    () => read("/api/work", { limit: 1 }),
    report,
    visible && !!schema,
  );
  const saved = useRead(
    "project-saved-views",
    epoch,
    () => read("/api/saved-views", {}),
    report,
    visible,
  );

  return { work, saved };
}

function ProjectHomeHeading({
  title,
  guide,
  schema,
  onCreate,
  onView,
}: {
  title: string;
  guide?: DemoGuide | null;
  schema: SchemaObject | null;
  onCreate(): void;
  onView(name: string): void;
}) {
  return (
    <div className="home-heading">
      <p className="eyebrow">PROJECT STUDIO</p>
      <h1>{title}</h1>
      <p>
        {guide?.description ??
          "Build a connected understanding of your product. Follow its intent, inspect the design, and keep evidence beside the decisions it supports."}
      </p>
      <div className="toolbar">
        <button className="primary" disabled={!schema} onClick={onCreate}>
          New item
        </button>
        <button onClick={() => onView(schema ? "workspace" : "model")}>
          {schema ? "Browse all items" : "Set up project model"}
        </button>
      </div>
    </div>
  );
}
