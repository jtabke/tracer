import type { FamilyWorkspace, Graph } from "../../../src/application/views.ts";
import type { Entity, Relationship } from "../../../src/core/model.ts";
import { label } from "../../../ui/fields.tsx";
import { statementText } from "../../../ui/statement-text.ts";
import type { RelationshipSlot } from "./relationship-slots.ts";
import { ConnectionRecord } from "./workspace-connection.tsx";
import { WorkspaceCoverage } from "./workspace-coverage.tsx";
import { Statements } from "./workspace-dialogs.tsx";
import { WorkspaceGraph } from "./workspace-graph.tsx";
import { WorkspaceReading } from "./workspace-reading.tsx";
import { WorkspaceTrace } from "./workspace-trace.tsx";

export type WorkspaceActions = {
  paused: boolean;
  dirty: boolean;
  onChoose(entity: Entity): void;
  onInspect(link: Relationship): void;
  onReceipt?(receiptId: string, inputId?: string): void;
  onMap(entity: Entity, slot?: RelationshipSlot): void;
  graphRead?: {
    epoch: number;
    report(error: unknown): void;
    onRead(graph: Graph | undefined, ready: boolean, active: boolean): void;
  };
};
function Lane({
  member,
  data,
  links,
  view,
  artifact,
  selectedId,
  compact,
  actions,
}: {
  member: Entity;
  compact: boolean;
  data: FamilyWorkspace;
  links: Relationship[];
  view: string;
  artifact?: string;
  selectedId?: string;
  actions: WorkspaceActions;
}) {
  const count = data.connections.find((value) => value.entityId === member.id)!;
  const title = String(member.fields.title ?? "");
  const statement = statementText(member);
  const emphasized = artifact
    ? links.some((link) => link.source === artifact || link.target === artifact)
    : selectedId === member.id;
  function renderStatement() {
    if (compact)
      return (
        <>
          <p className="workspace-member-preview">{statement}</p>
          <details className="workspace-member-statement">
            <summary>Read complete statement</summary>
            <Statements entity={member} />
          </details>
        </>
      );
    return (
      <>
        {statement.length > 320 ? (
          <details>
            <summary>Stored statement</summary>
            <p>{statement}</p>
          </details>
        ) : (
          <p>{statement}</p>
        )}
      </>
    );
  }
  function renderMember() {
    return (
      <>
        <div>
          <button
            disabled={actions.paused}
            aria-pressed={selectedId === member.id}
            onClick={() => actions.onChoose(member)}
          >
            {label(member)} · v{member.version}
          </button>
          {title && title !== label(member) && <h3 className="workspace-member-title">{title}</h3>}
          {renderStatement()}
        </div>
      </>
    );
  }
  function renderConnections() {
    return (
      <>
        <div>
          <p className="muted">
            {count.loaded} / {count.total} incident connections loaded
            {count.loaded < count.total ? " · more outside this view" : ""}
          </p>
          {!count.total && (
            <p>No recorded connections. Implementation and results remain unknown.</p>
          )}
          {!!count.total && !links.length && (
            <p>No additional connections shown beyond the chosen family.</p>
          )}
          {view === "coverage" &&
            links.map((link) => (
              <ConnectionRecord key={link.id} link={link} data={data} actions={actions} />
            ))}
          <button disabled={actions.paused || actions.dirty} onClick={() => actions.onMap(member)}>
            Connect {label(member)}
          </button>
        </div>
      </>
    );
  }
  return (
    <article className={`workspace-lane ${emphasized ? "is-emphasized" : ""}`}>
      {renderMember()}
      {renderConnections()}
    </article>
  );
}
function Group({
  node,
  links,
  data,
  active,
  actions,
  onArtifact,
}: {
  node: Entity;
  links: Relationship[];
  data: FamilyWorkspace;
  active: boolean;
  actions: WorkspaceActions;
  onArtifact(node: Entity): void;
}) {
  return (
    <article className={active ? "is-emphasized" : ""}>
      <div className="workspace-endpoint">
        <button
          disabled={actions.paused || actions.dirty}
          aria-pressed={active}
          aria-label={`Inspect ${label(node)}`}
          onClick={() => onArtifact(node)}
        >
          <strong>{label(node)}</strong>{" "}
          <span>
            {String(node.fields.title ?? "")} · {node.type}
          </span>
        </button>
        <details>
          <summary>Read {label(node)} details</summary>
          <Statements entity={node} />
        </details>
      </div>
      {links.map((link) => (
        <ConnectionRecord key={link.id} link={link} data={data} actions={actions} />
      ))}
    </article>
  );
}
function groupedLinks(data: FamilyWorkspace, links: Relationship[]) {
  const members = new Set(data.members.map((member) => member.id));
  const groups = new Map<string, Relationship[]>();
  for (const link of links)
    for (const id of new Set([link.source, link.target])) {
      if (members.has(id)) continue;
      groups.set(id, [...(groups.get(id) ?? []), link]);
    }
  return groups;
}
export function WorkspaceContext({
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
}: {
  data: FamilyWorkspace;
  meaning: string;
  direction: string;
  view: string;
  artifact?: string;
  selectedId?: string;
  actions: WorkspaceActions;
  onArtifact(node: Entity): void;
  columns: RelationshipSlot[];
  onColumns(columns: RelationshipSlot[]): void;
}) {
  if (view === "graph")
    return (
      <WorkspaceGraph
        key={`${meaning}:${direction}`}
        data={data}
        selectedId={selectedId}
        actions={actions}
      />
    );
  return (
    <>
      {!data.members.length && (
        <p>
          No family members in this scope. Choose another relationship/direction or record a
          connection; this is not a coverage verdict.
        </p>
      )}
      <FamilyProjection
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
      />
    </>
  );
}

function FamilyProjection({
  data,
  meaning,
  view,
  artifact,
  selectedId,
  actions,
  onArtifact,
  columns,
  onColumns,
}: Parameters<typeof WorkspaceContext>[0]) {
  const memberships = new Set(data.membership.map((link) => link.id));
  const links = data.links.filter((link) => !memberships.has(link.id));
  const groups = groupedLinks(data, links);
  if (view === "graph")
    return <WorkspaceGraph data={data} selectedId={selectedId} actions={actions} />;
  if (view === "trace")
    return (
      <WorkspaceTrace
        data={data}
        columns={columns}
        onColumns={onColumns}
        actions={actions}
        selectedId={selectedId}
        artifact={artifact}
        onArtifact={onArtifact}
      />
    );
  if (view === "coverage")
    return (
      <WorkspaceCoverage
        data={data}
        actions={actions}
        selectedId={selectedId}
        artifact={artifact}
        columns={columns}
        onColumns={onColumns}
      />
    );
  if (view === "reading")
    return <WorkspaceReading data={data} actions={actions} selectedId={selectedId} />;
  return (
    <div className={meaning && view === "relationships" ? "workspace-comparison" : undefined}>
      <div className="workspace-lanes">
        {data.members.map((member) => (
          <Lane
            key={member.id}
            member={member}
            compact={!!meaning && view === "relationships"}
            data={data}
            links={links.filter((link) => link.source === member.id || link.target === member.id)}
            view={view}
            artifact={artifact}
            selectedId={selectedId}
            actions={actions}
          />
        ))}
      </div>
      {view === "relationships" && (
        <div className="workspace-groups" aria-label="Shared connected items">
          {[...groups].map(([id, items]) => (
            <Group
              key={id}
              node={data.nodes.find((node) => node.id === id)!}
              links={items}
              data={data}
              active={artifact === id}
              actions={actions}
              onArtifact={onArtifact}
            />
          ))}
        </div>
      )}
    </div>
  );
}
