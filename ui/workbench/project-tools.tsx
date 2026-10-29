import {
  projectTaskGroups,
  projectUtilities,
  selectedRecordTask,
} from "../project-task-navigation.tsx";
import type { InitialView } from "../../src/core/presentation.ts";
import { createRoot } from "react-dom/client";
import { useEffect, useState, useSyncExternalStore } from "react";
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
  onSettings(): void;
};
export function createProjectTools(native: typeof Native, options: Options) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const dirty = new Set<string>();
  let open: ((task: NativeTask) => void) | undefined;
  let opener: HTMLElement | null = null;
  let returnAction: string | null = null;
  const show = (task: NativeTask) => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    returnAction = opener?.dataset.action ?? null;
    open?.(task);
  };
  const restoreFocus = () => {
    const replacement = returnAction
      ? document.querySelector<HTMLElement>(`[data-action="${CSS.escape(returnAction)}"]`)
      : null;
    const target = opener?.isConnected ? opener : replacement;
    if (target?.getClientRects().length) target.focus();
    else
      document.querySelector<HTMLElement>('[data-action="open-navigation"]')?.getClientRects()
        .length
        ? document.querySelector<HTMLElement>('[data-action="open-navigation"]')?.focus()
        : document.querySelector<HTMLElement>('[data-action="search"]')?.focus();
  };
  const utilities = projectUtilities.map((utility) => ({
    ...utility,
    available: () =>
      utility.action !== "refresh-project" ||
      !["saving", "unknown"].includes(native.mutations.snapshot().status),
    run: () => (utility.action === "development-map" ? options.onMap() : void options.changed()),
  }));
  return {
    commands: (): [string, () => void][] => [
      ["Project settings", options.onSettings],
      ...projectTaskGroups
        .flatMap((group) => group.tasks)
        .filter(
          ({ task }) =>
            !selectedRecordTask(task) ||
            native.projectSnapshot.entities.some(
              (entity) => (entity.key ?? entity.id) === options.selected(),
            ),
        )
        .map(({ task, title }): [string, () => void] => [
          selectedRecordTask(task) ? `${title} · ${options.selected()}` : title,
          () => show(task),
        ]),
      ...utilities
        .filter((utility) => utility.available())
        .map((utility): [string, () => void] => [utility.title, utility.run]),
    ],
    open: show,
    hasDrafts: () => dirty.size > 0,
    update: (epoch: number) =>
      root.render(
        <ProjectTools
          native={native}
          options={options}
          restoreFocus={restoreFocus}
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
  restoreFocus,
  register,
  onDirty,
}: {
  native: typeof Native;
  options: Options;
  epoch: number;
  restoreFocus(): void;
  register(show: (task: NativeTask) => void): void;
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
  const [error, setError] = useState("");
  const mutation = useSyncExternalStore(native.mutations.subscribe, native.mutations.snapshot);
  register((next) => {
    setActivated(true);
    selectTask(next);
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
              requestAnimationFrame(restoreFocus);
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
