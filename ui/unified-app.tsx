import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { Entity, Schema } from "../src/core/model.ts";
import type { ProjectSnapshot } from "../src/core/project-snapshot.ts";
import type { DemoGuide } from "../src/interfaces/demo-guide.ts";
import { connect, read } from "./api.ts";
import type { Editing } from "./editing.ts";
import { mapData } from "./map-data.ts";
import { DevelopmentMap } from "./map/app.tsx";
import type { MutationExecutor } from "./mutation-controller.ts";
import { MutationRecovery } from "./mutation-recovery.tsx";
import type { NativeTask } from "./native-task.tsx";
import { NativeTasks } from "./native-task.tsx";
import "./unified-app.css";
import { useMutation } from "./use-mutation.ts";

function useProjectWorkspace() {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot>();
  const [guide, setGuide] = useState<DemoGuide | null>(null);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const projectId = selectedProject();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [epoch, setEpoch] = useState(0);
  const [task, setTask] = useState<NativeTask | null>(null);
  const [entity, setEntity] = useState<Entity>();
  const generation = useRef(0);
  const mutation = useMutation((failure) => setError(String(failure)));
  async function refresh() {
    const run = ++generation.current;
    setReady(false);
    try {
      await connect();
      const [next, info, catalogue] = await Promise.all([
        read("/api/project-snapshot", {}),
        read("/api/demo-guide", {}),
        read("/api/projects", {}),
      ]);
      if (run !== generation.current) return;
      setSnapshot(next);
      setEpoch((current) => current + 1);
      setGuide(info);
      setProjects(catalogue);
      setReady(true);
      setError("");
    } catch (failure) {
      if (run === generation.current) setError(String(failure));
    }
  }
  const openProject = useEffectEvent(refresh);
  const invalidateRefresh = useEffectEvent(() => {
    generation.current++;
  });
  useEffect(() => {
    void openProject();
    return () => {
      invalidateRefresh();
    };
  }, []);
  const changed = () => {
    void refresh();
  };
  const mutate: MutationExecutor = (path, input) =>
    !ready || mutation.blocked ? Promise.resolve(undefined) : mutation.run(path, input);
  const editing: Editing = {
    busy: !ready || mutation.blocked,
    epoch,
    error,
    report(failure) {
      setError(String(failure));
    },
    mutate,
    async commit(operations, schemaVersion) {
      const result = await mutate("/api/changesets", {
        operations,
        expectedSchemaVersion: schemaVersion,
      });
      if (!result) return false;
      changed();
      return true;
    },
  };
  async function saveSchema(schema: Schema, expectedVersion: number) {
    const result = await mutate("/api/schema", { schema, expectedVersion });
    if (!result) return false;
    changed();
    return true;
  }
  return {
    snapshot,
    guide,
    projects,
    projectId,
    ready,
    error,
    task,
    entity,
    mutation,
    refresh,
    changed,
    editing,
    saveSchema,
    setTask,
    setEntity,
  };
}

export function UnifiedApp() {
  const {
    snapshot,
    guide,
    projects,
    projectId,
    ready,
    error,
    task,
    entity,
    mutation,
    refresh,
    changed,
    editing,
    saveSchema,
    setTask,
    setEntity,
  } = useProjectWorkspace();
  const status = (
    <ProjectNotice
      ready={ready}
      loaded={!!snapshot}
      error={error}
      mutation={mutation}
      refresh={refresh}
      changed={changed}
      tools={
        <ProjectActions
          hasSchema={!!snapshot?.schema}
          onTask={setTask}
          blocked={!ready || mutation.blocked}
        />
      }
    />
  );
  const data = useMemo(
    () => (snapshot ? mapData(snapshot, guide?.title.split(" — ")[0] ?? "Local project") : null),
    [snapshot, guide],
  );
  if (!snapshot)
    return (
      <main className="project-opening">
        <h1>Tracer</h1>
        {status}
      </main>
    );

  return (
    <>
      <DevelopmentMap
        data={data!}
        sessionKey={projectId}
        projects={projects}
        onProject={(id) => switchProject(id, projectId, mutation.blocked)}
        status={`Saved project · revision ${snapshot.projectRevision}`}
        notice={status}
        actions={
          <ProjectActions
            hasSchema={!!snapshot.schema}
            onTask={setTask}
            blocked={!ready || mutation.blocked}
          />
        }
        inspectorActions={(selected) => (
          <button
            className="primary"
            disabled={!ready}
            onClick={() => {
              setEntity(snapshot.entities.find((item) => item.id === selected.id));
              setTask("item");
            }}
          >
            Edit item and connections
          </button>
        )}
      />
      <NativeTasks
        task={task}
        entity={entity}
        schema={snapshot.schema}
        editing={editing}
        onClose={() => setTask(null)}
        changed={changed}
        onSchema={saveSchema}
      />
    </>
  );
}

function ProjectNotice({
  ready,
  loaded,
  error,
  mutation,
  refresh,
  changed,
  tools,
}: {
  ready: boolean;
  loaded: boolean;
  error: string;
  mutation: ReturnType<typeof useMutation>;
  refresh(): Promise<void>;
  changed(): void;
  tools: React.ReactNode;
}) {
  return (
    <div className="project-notice">
      <button disabled={mutation.busy} onClick={() => void refresh()}>
        Refresh project
      </button>
      <details className="mobile-project-tools">
        <summary>Project tools</summary>
        {tools}
      </details>
      {!ready && (
        <span role="status">
          {loaded ? "Refreshing project; editing paused." : "Opening project…"}
        </span>
      )}
      {error && (
        <p role="alert">
          {error} {retainedReadNotice(loaded)}
        </p>
      )}
      <MutationRecovery mutation={mutation} refreshed={changed} resumed={() => void refresh()} />
    </div>
  );
}

function switchProject(id: string, current: string, blocked: boolean) {
  if (id === current) return;
  if (blocked) return;
  if (
    window.confirm(
      "Switch projects? Unsaved drafts and session organization will be discarded. Saved records remain in their own project.",
    )
  )
    window.location.assign("/?workspace=map&project=" + encodeURIComponent(id));
}

function retainedReadNotice(loaded: boolean) {
  return loaded
    ? "The previous map is retained; editing is paused until an authoritative refresh succeeds."
    : "";
}

function ProjectActions({
  hasSchema,
  onTask,
  blocked,
}: {
  hasSchema: boolean;
  blocked: boolean;
  onTask(task: NativeTask): void;
}) {
  return (
    <div className="project-actions">
      <button
        disabled={blocked}
        onClick={() => {
          if (
            window.confirm(
              "Open Graph / Matrix / History? Unsaved map drafts will be discarded; saved records remain in this project.",
            )
          ) {
            const url = new URL(location.href);
            url.searchParams.set("workspace", "workbench");
            location.assign(url);
          }
        }}
      >
        Graph / Matrix / History
      </button>
      <button disabled={!hasSchema} onClick={() => onTask("create")}>
        New item
      </button>
      <button onClick={() => onTask("schema")}>Configure model</button>
      <button onClick={() => onTask("evaluations")}>Evaluations</button>
      <button onClick={() => onTask("configurations")}>Configurations</button>
      <button onClick={() => onTask("docs")}>Documentation</button>
    </div>
  );
}

function selectedProject() {
  return new URLSearchParams(window.location.search).get("project") ?? "default";
}
