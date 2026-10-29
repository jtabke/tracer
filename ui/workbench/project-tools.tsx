import { ProjectToolIcon } from "./project-tool-icon.tsx";
import "./project-tool-menu.css";
import { projectTaskGroups, selectedRecordTask } from "../project-task-navigation.tsx";
import type { InitialView } from "../../src/core/presentation.ts";
import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MutationControllerContext } from "../use-mutation.ts";
import { NativeTasks, type NativeTask } from "../native-task.tsx";
import type * as Native from "./native-client.ts";
import type { Editing } from "../editing.ts";
import type { Schema } from "../../src/core/model.ts";

type Options = {
  changed(): Promise<void>;
  current(): boolean;
  selected(): string;
  settled(): void;
  onMap(): void;
};
export function createProjectTools(native: typeof Native, options: Options) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const dirty = new Set<string>();
  let open: ((task?: NativeTask) => void) | undefined;
  return {
    open: (task?: NativeTask) => open?.(task),
    hasDrafts: () => dirty.size > 0,
    update: (epoch: number) =>
      root.render(
        <ProjectTools
          native={native}
          options={options}
          epoch={epoch}
          onDirty={(task, value) => {
            if (value) dirty.add(task);
            else dirty.delete(task);
          }}
          register={(show) => {
            open = show;
          }}
        />,
      ),
  };
}
function ProjectTools({
  native,
  options,
  epoch,
  register,
  onDirty,
}: {
  native: typeof Native;
  options: Options;
  epoch: number;
  register(show: (task?: NativeTask) => void): void;
  onDirty(task: string, value: boolean): void;
}) {
  const [activated, setActivated] = useState(window.location.hash === "#model");
  const [task, setTask] = useState<NativeTask | null>(
    window.location.hash === "#model" ? "schema" : null,
  );
  const selectTask = (next: NativeTask | null) => {
    if (next === "schema" && window.location.hash !== "#model") {
      window.history.pushState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#model`,
      );
    } else if (next !== "schema" && window.location.hash === "#model") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    setTask(next);
  };
  useEffect(() => {
    const route = () => {
      setActivated(true);
      setTask(window.location.hash === "#model" ? "schema" : null);
    };
    window.addEventListener("popstate", route);
    return () => window.removeEventListener("popstate", route);
  }, []);
  useEffect(() => {
    const workspace = document.getElementById("app");
    const overflow = document.body.style.overflow;
    if (workspace) workspace.inert = task === "schema";
    if (task === "schema") document.body.style.overflow = "hidden";
    return () => {
      if (workspace) workspace.inert = false;
      document.body.style.overflow = overflow;
    };
  }, [task]);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const mutation = useSyncExternalStore(native.mutations.subscribe, native.mutations.snapshot);
  register((next) => {
    if (next) {
      setActivated(true);
      selectTask(next);
    } else setMenu(true);
  });
  const busy = !options.current() || ["saving", "unknown"].includes(mutation.status);
  const editing: Editing = {
    busy,
    epoch,
    error,
    report: (failure) => setError(String(failure)),
    mutate: async (path, input) => {
      if (busy) return undefined;
      const result = await native.mutations.run(path, input);
      if (result === undefined) {
        const resultState = native.mutations.snapshot();
        setError(
          resultState.status === "rejected"
            ? String(resultState.error)
            : "Save not confirmed. Return to the workspace to inspect the result before continuing.",
        );
      } else setError("");
      return result;
    },
    commit: async (operations, version) => {
      const result = await editing.mutate("/api/changesets", {
        operations,
        expectedSchemaVersion: version,
      });
      if (!result) return false;
      await options.changed();
      return true;
    },
  };
  async function saveSchema(schema: Schema, expectedVersion: number, initialViews?: InitialView[]) {
    const saved = await editing.mutate("/api/schema", {
      schema,
      expectedVersion,
      ...(initialViews ? { initialViews } : {}),
    });
    if (!saved) return false;
    await options.changed();
    return saved;
  }
  return (
    <div
      onInputCapture={(event) => {
        if ((event.target as HTMLElement).closest(".project-task-navigation")) return;
        if (
          task &&
          ![
            "schema",
            "create",
            "item",
            "references",
            "import",
            "export",
            "next-work",
            "assessments",
            "verification",
          ].includes(task)
        )
          onDirty(task, true);
      }}
    >
      {menu && (
        <ProjectMenu onClose={() => setMenu(false)}>
          <header className="project-tool-menu-header">
            <div>
              <h2>Project tools</h2>
              <p>Choose where to work.</p>
            </div>
            <button aria-label="Close project tools" onClick={() => setMenu(false)}>
              <ProjectToolIcon name="close" />
            </button>
          </header>
          <div className="project-tool-groups">
            {projectTaskGroups.map((group) => (
              <section className="project-tool-group" key={group.title}>
                <h3>{group.title}</h3>
                {group.tasks.map(({ task: name, title, description }) => (
                  <button
                    key={name}
                    aria-label={title}
                    aria-describedby={`project-tool-${name}-description`}
                    disabled={
                      selectedRecordTask(name) &&
                      !native.projectSnapshot.entities.some(
                        (entity) => (entity.key ?? entity.id) === options.selected(),
                      )
                    }
                    onClick={() => {
                      setMenu(false);
                      setActivated(true);
                      selectTask(name);
                    }}
                  >
                    <span className="project-tool-icon">
                      <ProjectToolIcon name={name} />
                    </span>
                    <span className="project-tool-copy">
                      <span>{title}</span>
                      <small id={`project-tool-${name}-description`}>{description}</small>
                    </span>
                  </button>
                ))}
              </section>
            ))}
          </div>
          <footer className="project-tool-menu-footer">
            <div className="project-tool-utilities">
              <button
                disabled={["saving", "unknown"].includes(mutation.status)}
                onClick={() => {
                  setMenu(false);
                  void options.changed();
                }}
              >
                <ProjectToolIcon name="refresh" />
                Refresh project
              </button>
              <button onClick={options.onMap}>
                <ProjectToolIcon name="map" />
                Development map
              </button>
            </div>
            <p>Unsaved drafts stay in this tab until reload.</p>
          </footer>
        </ProjectMenu>
      )}
      {activated && (
        <MutationControllerContext value={native.mutations}>
          <NativeTasks
            task={task}
            schema={native.projectSnapshot.schema}
            entities={native.projectSnapshot.entities}
            entity={native.projectSnapshot.entities.find(
              (entity) => (entity.key ?? entity.id) === options.selected(),
            )}
            editing={editing}
            onClose={() => {
              selectTask(null);
              options.settled();
              requestAnimationFrame(() =>
                document.querySelector<HTMLButtonElement>('[data-action="project-tools"]')?.focus(),
              );
            }}
            changed={() => {
              void options.changed();
            }}
            onSchema={saveSchema}
            onTaskDirty={onDirty}
            onTask={selectTask}
          />
        </MutationControllerContext>
      )}
    </div>
  );
}

function ProjectMenu({ children, onClose }: { children: React.ReactNode; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="project-tool-menu"
      aria-label="Project tools"
      onCancel={onClose}
    >
      {children}
    </dialog>
  );
}
