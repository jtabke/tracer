import type { RefObject } from "react";
import { useLayoutEffect, useRef } from "react";
import type { FamilyWorkspace } from "../../../src/application/views.ts";
import type { Entity, SchemaObject } from "../../../src/core/model.ts";
import { label } from "../../../ui/fields.tsx";
import { readable } from "./graph-model.ts";
import type { WorkspaceActions } from "./workspace-context.tsx";
import { WorkspaceContext } from "./workspace-context.tsx";
import { WorkspacePager } from "./workspace-pager.tsx";

export function WorkspaceSurface({
  navigation,
  paging,
  data,
  loading,
  schema,
  meaning,
  direction,
  onScope,
  view,
  onView,
  artifact,
  selectedId,
  returnSelection,
  actions,
  onArtifact,
  columns,
  onColumns,
}: {
  navigation: {
    contextHeading: RefObject<HTMLHeadingElement | null>;
    onReturnToList(): void;
    returnContext?: string;
    onReturnContext(): void;
  };
  paging: { previous: boolean; onPrevious(): void; onNext(): void };
  data?: FamilyWorkspace;
  loading: boolean;
  schema: SchemaObject;
  meaning: string;
  direction: "incoming" | "outgoing";
  onScope(meaning: string, direction: "incoming" | "outgoing"): void;
  view: string;
  onView(view: string): void;
  artifact?: string;
  selectedId?: string;
  returnSelection?: Entity;
  actions: WorkspaceActions;
  onArtifact(node: Entity): void;
  columns: import("./relationship-slots.ts").RelationshipSlot[];
  onColumns(columns: import("./relationship-slots.ts").RelationshipSlot[]): void;
}) {
  const { contextHeading, onReturnToList, returnContext, onReturnContext } = navigation;
  const { previous, onPrevious, onNext } = paging;
  return (
    <div className="workspace-surface">
      <ScopeReturn context={returnContext} paused={actions.paused} onReturn={onReturnContext} />
      <ContextHeader
        contextHeading={contextHeading}
        root={data?.root}
        onReturnToList={onReturnToList}
        view={view}
        onView={onView}
        actions={actions}
      />
      <ScopeControls
        schema={schema}
        meaning={meaning}
        direction={direction}
        onScope={onScope}
        data={data}
      />
      <ReadNotices data={data} loading={loading} dirty={actions.dirty} />
      <LoadedContext
        data={data}
        meaning={meaning}
        direction={direction}
        view={view}
        artifact={artifact}
        selectedId={selectedId}
        actions={actions}
        onArtifact={onArtifact}
        columns={columns}
        onColumns={onColumns}
        returnSelection={returnSelection}
        previous={previous}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </div>
  );
}
function ScopeReturn({
  context,
  paused,
  onReturn,
}: {
  context?: string;
  paused: boolean;
  onReturn(): void;
}) {
  if (!context) return null;
  return (
    <button disabled={paused} onClick={onReturn}>
      Return to relationships for {context}
    </button>
  );
}
function ScopeControls({
  schema,
  meaning,
  direction,
  onScope,
  data,
}: {
  schema: SchemaObject;
  meaning: string;
  direction: "incoming" | "outgoing";
  onScope(meaning: string, direction: "incoming" | "outgoing"): void;
  data?: FamilyWorkspace;
}) {
  return (
    <div className="workspace-scope">
      <label>
        Family scope
        <select
          aria-label="Family scope"
          value={`${direction}:${meaning}`}
          onChange={(event) =>
            onScope(
              event.target.value.slice(9),
              event.target.value.slice(0, 8) as "incoming" | "outgoing",
            )
          }
        >
          <option value={`${direction}:`}>Starting item only</option>
          {(["incoming", "outgoing"] as const).map((value) => (
            <optgroup
              key={value}
              label={value === "incoming" ? "Into the starting item" : "From the starting item"}
            >
              {Object.keys(schema.relationshipTypes).map((name) => (
                <option key={name} value={`${value}:${name}`}>
                  {value === "incoming" ? "←" : "→"} {readable(name)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {data && (
        <small className="workspace-scope-count">
          {meaning
            ? `${data.members.length} items · ${data.membership.length} connections loaded${data.nextAfter ? " · more on the next page" : ""}`
            : `Starting item only · snapshot revision ${data.projectRevision}`}
        </small>
      )}
    </div>
  );
}

function LoadedContext({
  data,
  meaning,
  direction,
  view,
  artifact,
  selectedId,
  actions,
  onArtifact,
  columns,
  onColumns,
  returnSelection,
  previous,
  onPrevious,
  onNext,
}: Pick<
  Parameters<typeof WorkspaceSurface>[0],
  | "data"
  | "meaning"
  | "direction"
  | "view"
  | "artifact"
  | "selectedId"
  | "actions"
  | "onArtifact"
  | "columns"
  | "onColumns"
  | "returnSelection"
> & { previous: boolean; onPrevious(): void; onNext(): void }) {
  return (
    <>
      {data && (
        <>
          <WorkspaceContext
            columns={columns}
            onColumns={onColumns}
            data={data}
            meaning={meaning}
            direction={direction}
            view={view}
            artifact={artifact}
            selectedId={selectedId}
            actions={actions}
            onArtifact={onArtifact}
          />
          {artifact && (
            <button
              disabled={actions.paused}
              onClick={() => actions.onChoose(returnSelection ?? data.root)}
            >
              Return to {label(returnSelection ?? data.root)}
            </button>
          )}
          <WorkspacePager
            noun="family"
            previous={previous}
            next={!!data.nextAfter}
            paused={actions.paused}
            onPrevious={onPrevious}
            onNext={onNext}
          />
          {data.nextAfter && <p>More membership edges exist outside this page.</p>}
        </>
      )}
    </>
  );
}

function ReadNotices({
  data,
  loading,
  dirty,
}: {
  data?: FamilyWorkspace;
  loading: boolean;
  dirty: boolean;
}) {
  return (
    <>
      {dirty && (
        <p role="status">
          Connected-item Inspect is paused until you save or discard the draft. Read connected item
          details here without leaving your draft.
        </p>
      )}
      {loading && <p role="status">Reading one consistent context…</p>}
      {!data && !loading && (
        <p role="alert">
          Context read failed. Drafts are retained; writes are paused. Refresh to retry.
        </p>
      )}
    </>
  );
}

function ContextHeader({
  contextHeading,
  root,
  onReturnToList,
  view,
  onView,
  actions,
}: {
  contextHeading: RefObject<HTMLHeadingElement | null>;
  root?: Entity;
  onReturnToList(): void;
  view: string;
  onView(value: string): void;
  actions: WorkspaceActions;
}) {
  const modes = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = modes.current;
    if (!element) return;
    const reveal = () => revealRepresentation(element);
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(element);
    return () => observer.disconnect();
  }, [view]);
  return (
    <div className="workspace-bar">
      <h2
        ref={contextHeading}
        tabIndex={-1}
        aria-label={root ? `${label(root)} context` : "Selected context"}
      >
        {root ? (
          <>
            <button
              className="scope-identity text-action"
              disabled={actions.paused}
              aria-label={`Inspect starting item ${label(root)}`}
              onClick={() => actions.onChoose(root)}
            >
              {label(root)}
            </button>
            <span className="scope-title" title={String(root.fields.title ?? "")}>
              {String(root.fields.title ?? "")}
            </span>
          </>
        ) : (
          "Connected workspace"
        )}
      </h2>
      <div className="workspace-view-controls">
        <button className="workspace-return" onClick={onReturnToList}>
          Return to project items
        </button>
        <div
          ref={modes}
          className="workspace-view-switch"
          role="group"
          aria-label="Workspace representation"
        >
          {[
            ["trace", "Table"],
            ["graph", "Graph"],
            ["relationships", "Relationships"],
            ["coverage", "Coverage"],
            ["reading", "Reading"],
          ].map(([name, title]) => (
            <button key={name} aria-pressed={view === name} onClick={() => onView(name)}>
              {title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function revealRepresentation(element: HTMLDivElement) {
  if (!element.clientWidth) return;
  const selected = element.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (!selected) return;
  const bounds = element.getBoundingClientRect();
  const item = selected.getBoundingClientRect();
  if (item.left < bounds.left) element.scrollLeft += item.left - bounds.left;
  else if (item.right > bounds.right) element.scrollLeft += item.right - bounds.right;
}
