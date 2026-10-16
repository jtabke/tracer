import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WorkingSet } from "../../../src/application/views.ts";
import type { Entity, SchemaObject } from "../../../src/core/model.ts";
import { read } from "../../../ui/api.ts";
import type { Editing } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import { NativeTypeOptions } from "../../../ui/type-options.tsx";
import { useDebounced } from "../../../ui/use-debounced.ts";
import { usePageCursor } from "../../../ui/use-page-cursor.ts";
import type { Projection } from "../../../ui/use-projection.ts";
import { useProjection } from "../../../ui/use-projection.ts";
import { NewItemDialog } from "./workspace-dialogs.tsx";
import "./workspace-library.css";
import { WorkspacePager } from "./workspace-pager.tsx";
import type { WorkspaceIntent } from "./workspace.tsx";

export function WorkspaceBrowser({
  schema,
  intent,
  editing,
  rootId,
  visible,
  selectedRow,
  projectHeading,
  onGoContext,
  onChoose,
}: {
  intent?: WorkspaceIntent;
  schema: SchemaObject;
  editing: Editing;
  rootId: string;
  visible: boolean;
  selectedRow: RefObject<HTMLButtonElement | null>;
  projectHeading: RefObject<HTMLHeadingElement | null>;
  onGoContext(): void;
  onChoose(entity: Entity): void;
}) {
  const searchInput = useFindEntry(visible, intent);
  const { search, setSearch, type, setType, cursor, work } = useWorkspaceBrowserRead(
    intent,
    editing,
    projectHeading,
  );
  const { creating, setCreating, createdId, setCreatedId, createdBusy, openCreated } =
    useCreatedInspection(intent, editing, onChoose);
  useEffect(() => {
    selectedRow.current?.scrollIntoView({ block: "nearest" });
  }, [rootId, work.data, selectedRow]);
  const currentSchema = work.data?.schema ?? schema;
  const paused = editing.busy || work.loading || !work.data;
  const resetPage = cursor.reset;
  const clear = () => {
    setSearch("");
    setType("");
    resetPage();
  };
  return (
    <section className="workspace-browser" aria-label="Project browser">
      <div className="toolbar">
        <h2 ref={projectHeading} tabIndex={-1}>
          {type ? `Items · ${type.replaceAll("_", " ")}` : "Project items"}
        </h2>
        <button
          disabled={paused || !Object.keys(schema.entityTypes).length}
          onClick={() => setCreating(true)}
        >
          New item
        </button>
      </div>
      <CreatedItemNotice id={createdId} busy={createdBusy} open={openCreated} />
      <div className="workspace-library-filters" role="group" aria-label="Find project items">
        <label>
          Find items
          <input
            ref={searchInput}
            aria-label="Find workspace items"
            maxLength={200}
            value={search}
            placeholder="Key or content, across all pages"
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
          />
        </label>
        <WorkspaceTypeFilter
          schema={currentSchema}
          counts={work.data?.types ?? []}
          type={type}
          onChange={(value) => {
            setType(value);
            resetPage();
          }}
        />
        <button disabled={work.loading} onClick={clear}>
          Clear filters
        </button>
      </div>
      <WorkspacePage
        work={work}
        cursor={cursor}
        paused={paused}
        rootId={rootId}
        selectedRow={selectedRow}
        onChoose={onChoose}
        onGoContext={onGoContext}
      />
      {creating && (
        <NewItemDialog
          schema={currentSchema}
          initialType={type}
          editing={editing}
          paused={paused}
          onCreated={setCreatedId}
          onClose={() => setCreating(false)}
        />
      )}
    </section>
  );
}

function WorkspaceTypeFilter({
  schema,
  counts,
  type,
  onChange,
}: {
  schema: SchemaObject;
  counts: WorkingSet["types"];
  type: string;
  onChange(value: string): void;
}) {
  return (
    <label>
      Type
      <select
        aria-label="Workspace type"
        value={type}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All types</option>
        <NativeTypeOptions names={Object.keys(schema.entityTypes)} counts={counts} />
      </select>
    </label>
  );
}

function WorkspaceItem({
  entity,
  selected,
  paused,
  selectedRow,
  onChoose,
  onGoContext,
}: {
  entity: Entity;
  selected: boolean;
  paused: boolean;
  selectedRow: RefObject<HTMLButtonElement | null>;
  onChoose(entity: Entity): void;
  onGoContext(): void;
}) {
  const name = label(entity);
  const title = typeof entity.fields.title === "string" ? entity.fields.title : "";
  const action = (
    <button
      disabled={paused}
      aria-label={`Open ${name}`}
      aria-pressed={selected}
      ref={selected ? selectedRow : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onChoose(entity);
      }}
    >
      {entity.key ? <strong>{entity.key}</strong> : title || name}
    </button>
  );
  return (
    <tr
      aria-selected={selected}
      onClick={() => {
        if (!paused) onChoose(entity);
      }}
    >
      <td className="library-key">{entity.key ? action : "—"}</td>
      <td className="library-title">
        {entity.key ? title || "—" : action}
        {selected && (
          <button
            className="workspace-context-shortcut"
            onClick={(event) => {
              event.stopPropagation();
              onGoContext();
            }}
          >
            Go to selected context
          </button>
        )}
      </td>
      <td className="library-type">{entity.type.replaceAll("_", " ")}</td>
      <td className="library-version">v{entity.version}</td>
    </tr>
  );
}

function WorkspacePage({
  work,
  cursor,
  paused,
  rootId,
  selectedRow,
  onChoose,
  onGoContext,
}: {
  work: Projection<"/api/work">;
  cursor: ReturnType<typeof usePageCursor>;
  paused: boolean;
  rootId: string;
  selectedRow: RefObject<HTMLButtonElement | null>;
  onChoose(entity: Entity): void;
  onGoContext(): void;
}) {
  if (work.loading) return <p role="status">Loading items…</p>;
  const data = work.data;
  if (!data) return <p role="alert">Project read failed. Refresh to retry.</p>;
  return (
    <>
      <WorkspaceItemCount data={data} />
      <WorkspacePager
        noun="items"
        previous={cursor.hasPrevious}
        next={!!data.entities.nextAfter}
        paused={paused}
        onPrevious={cursor.previous}
        onNext={() => cursor.next(data.entities.nextAfter)}
      />
      <WorkspaceEmpty data={data} />
      {!!data.entities.items.length && (
        <div className="workspace-library-scroll">
          <table className="workspace-items workspace-library">
            <caption className="sr-only">Loaded project items</caption>
            <thead>
              <tr>
                <th scope="col" className="library-key">
                  Key
                </th>
                <th scope="col" className="library-title">
                  Title
                </th>
                <th scope="col" className="library-type">
                  Type
                </th>
                <th scope="col" className="library-version">
                  Revision
                </th>
              </tr>
            </thead>
            <tbody>
              {data.entities.items.map((entity) => (
                <WorkspaceItem
                  key={entity.id}
                  entity={entity}
                  selected={rootId === entity.id}
                  paused={paused}
                  selectedRow={selectedRow}
                  onChoose={onChoose}
                  onGoContext={onGoContext}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function WorkspaceEmpty({ data }: { data: WorkingSet }) {
  if (data.entities.items.length) return null;
  return (
    <div className="workspace-empty">
      <h3>{data.types.length ? "No matching items" : "Your project is empty"}</h3>
      <p>
        {data.types.length
          ? "Clear filters or try another name. No matches does not mean the project is empty."
          : "Create an intent or requirement, then connect related items as your project grows."}
      </p>
    </div>
  );
}

function WorkspaceItemCount({ data }: { data: WorkingSet }) {
  const projectTotal = data.types.reduce((sum, item) => sum + item.count, 0);
  return (
    <p className="muted">
      {data.entities.items.length} of {data.total}{" "}
      {data.total === projectTotal ? "project items" : `matches · ${projectTotal} project items`}
    </p>
  );
}

function useCreatedInspection(
  intent: WorkspaceIntent | undefined,
  editing: Editing,
  onChoose: (entity: Entity) => void,
) {
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState("");
  const [opening, setOpening] = useState(false);
  const chooseCurrent = useRef(onChoose);
  chooseCurrent.current = onChoose;
  const openCreated = async () => {
    setOpening(true);
    try {
      const page = await read("/api/family", { rootId: createdId, limit: 1 });
      chooseCurrent.current(page.root);
    } catch (error) {
      editing.report(error);
    } finally {
      setOpening(false);
    }
  };
  useEffect(() => {
    if (intent?.create) setCreating(true);
  }, [intent?.sequence]);
  return {
    creating,
    setCreating,
    createdId,
    setCreatedId,
    createdBusy: editing.busy || opening,
    openCreated,
  };
}

function useWorkspaceBrowserRead(
  intent: WorkspaceIntent | undefined,
  editing: Editing,
  projectHeading: RefObject<HTMLHeadingElement | null>,
) {
  const [search, setSearch] = useState(""),
    [type, setType] = useState("");
  const cursor = usePageCursor();
  useEffect(() => {
    if (intent?.type === undefined) return;
    setType(intent.type);
    cursor.reset();
    if (!intent.find) projectHeading.current?.focus();
  }, [intent?.sequence]);
  const term = useDebounced(search.trim());
  const work = useProjection(
    "/api/work",
    { search: term || undefined, type: type || undefined, after: cursor.after, limit: 30 },
    editing.epoch,
    editing.report,
  );
  return { search, setSearch, type, setType, cursor, work };
}

function useFindEntry(visible: boolean, intent?: WorkspaceIntent) {
  const searchInput = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (!visible || !intent?.find) return;
    searchInput.current?.focus();
    searchInput.current?.select();
  }, [visible, intent?.sequence]);

  return searchInput;
}

function CreatedItemNotice({
  id,
  busy,
  open,
}: {
  id: string;
  busy: boolean;
  open(): Promise<void>;
}) {
  if (!id) return null;
  return (
    <div role="status">
      <p>Item created without connections. Open it to inspect or connect existing information.</p>
      <button disabled={busy} onClick={() => void open()}>
        Open created item
      </button>
    </div>
  );
}
