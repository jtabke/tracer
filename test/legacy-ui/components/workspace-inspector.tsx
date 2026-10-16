import type { Entity, Relationship, SchemaObject } from "../../../src/core/model.ts";
import type { Editing } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import { ObjectEditor } from "../../../ui/object-editor.tsx";
import { readable } from "./graph-model.ts";
import { CandidateContext } from "./workspace-candidate-context.tsx";
import { WorkspaceConfigurations } from "./workspace-configurations.tsx";
import { RevisionHistory, Statements } from "./workspace-dialogs.tsx";
import { WorkspaceReceipts } from "./workspace-receipts.tsx";

type InspectorProps = {
  entity?: Entity;
  fieldsInSurface?: string[];
  focusedRead?: boolean;
  onCreate?(): void;
  createDisabled?: boolean;
  link?: Relationship;
  selectedLink?: Relationship;
  nodes: Entity[];
  schema: SchemaObject;
  editing: Editing;
  paused: boolean;
  outsideScope: boolean;
  authoring: {
    dirty: boolean;
    onDirty(dirty: boolean): void;
    expanded: boolean;
    onExpanded(expanded: boolean): void;
  };
  onMap(): void;
  onNavigate?(entity: Entity): void;
  onOpenReceipt?(receiptId: string, inputId?: string): void;
  onRemove(): void;
  onExplore?(): void;
  canExplore?: boolean;
};

export function WorkspaceInspector(props: InspectorProps) {
  return (
    <aside className="workspace-inspector" aria-label="Workspace inspector">
      {props.outsideScope && (
        <p role="status">
          Selection is outside the loaded context. Its last-loaded revision and draft are retained;
          writes are paused. Return to its scope or select it in the project browser.
        </p>
      )}
      <InspectorContent {...props} />
    </aside>
  );
}
function EntityInspector({
  entity,
  schema,
  editing,
  paused,
  dirty,
  onDirty,
  onMap,
  onExplore,
  expanded,
  onExpanded,
  onOpenReceipt,
  fieldsInSurface,
  focusedRead,
  onCreate,
  createDisabled,
  onNavigate,
}: {
  entity: Entity;
  fieldsInSurface?: string[];
  focusedRead?: boolean;
  onCreate?(): void;
  createDisabled?: boolean;
  schema: SchemaObject;
  editing: Editing;
  paused: boolean;
  dirty: boolean;
  onDirty(dirty: boolean): void;
  onMap(): void;
  onNavigate?(entity: Entity): void;
  onExplore?(): void;
  expanded: boolean;
  onExpanded(expanded: boolean): void;
  onOpenReceipt?(receiptId: string, inputId?: string): void;
}) {
  return (
    <>
      <h2 tabIndex={-1}>{label(entity)}</h2>
      <small>
        {entity.type} · loaded v{entity.version}
      </small>
      <InspectorFocusControl expanded={expanded} onExpanded={onExpanded} />
      <ObjectEditor
        value={entity}
        definition={schema.entityTypes[entity.type]}
        schemaVersion={schema.version}
        editing={editing}
        onDirty={onDirty}
        disabled={paused}
        prefix="Workspace"
        multiline
        itemName="item"
        local
        onEditing={onExpanded}
        fieldsInSurface={fieldsInSurface}
        formVisible={expanded || focusedRead === true}
      />
      <InspectorContextActions
        entity={entity}
        disabled={paused || dirty}
        onExplore={onExplore}
        onCreate={onCreate}
        createDisabled={createDisabled}
        onMap={onMap}
      />
      <WorkspaceReceipts entityId={entity.id} epoch={editing.epoch} onOpenReceipt={onOpenReceipt} />
      <CandidateContext
        entity={entity}
        editing={editing}
        candidate={false}
        disabled={paused}
        onNavigate={onNavigate}
      />
      <WorkspaceConfigurations entityId={entity.id} epoch={editing.epoch} />
      <RevisionHistory entity={entity} editing={editing} />
    </>
  );
}
function InspectorContextActions({
  entity,
  disabled,
  onExplore,
  onCreate,
  createDisabled,
  onMap,
}: {
  entity: Entity;
  disabled: boolean;
  onExplore?(): void;
  onCreate?(): void;
  createDisabled?: boolean;
  onMap(): void;
}) {
  return (
    <div className="inspector-context-actions">
      {onExplore && (
        <button disabled={disabled} onClick={onExplore}>
          Show relationships for {label(entity)}
        </button>
      )}
      {onCreate && (
        <button disabled={createDisabled} onClick={onCreate}>
          Create in context
        </button>
      )}
      <button disabled={disabled} onClick={onMap}>
        Connect existing item
      </button>
    </div>
  );
}
function InspectorFocusControl({
  expanded,
  onExpanded,
}: {
  expanded: boolean;
  onExpanded(expanded: boolean): void;
}) {
  if (!expanded) return null;
  return (
    <button className="text-action" aria-pressed={expanded} onClick={() => onExpanded(!expanded)}>
      Return to scope
    </button>
  );
}
function LinkInspector({
  link,
  selectedLink,
  nodes,
  schema,
  editing,
  paused,
  dirty,
  onDirty,
  onRemove,
}: {
  link: Relationship;
  selectedLink: Relationship;
  nodes: Entity[];
  schema: SchemaObject;
  editing: Editing;
  paused: boolean;
  dirty: boolean;
  onDirty(dirty: boolean): void;
  onRemove(): void;
}) {
  return (
    <>
      <h2 tabIndex={-1}>{readable(link.type)}</h2>
      <p>
        Selected connection v{selectedLink.version}
        {link.version !== selectedLink.version
          ? `; current v${link.version}. Reselect before removing.`
          : ""}
      </p>
      <p>
        {endpointName(nodes, link.source)} → {endpointName(nodes, link.target)}
      </p>
      <details>
        <summary>Connection identity</summary>
        <p>
          {link.id} · {link.source} → {link.target}
        </p>
      </details>
      <ObjectEditor
        key={link.id}
        value={link}
        definition={schema.relationshipTypes[link.type]}
        schemaVersion={schema.version}
        relationship
        editing={editing}
        onDirty={onDirty}
        disabled={paused}
        prefix="Mapping"
        multiline
      />
      {[link.source, link.target].map((id) => {
        const node = nodes.find((item) => item.id === id);
        return node ? (
          <div key={id}>
            <h3>
              {label(node)} · current v{node.version}
            </h3>
            <Statements entity={node} />
            <RevisionHistory key={id} entity={node} editing={editing} />
          </div>
        ) : null;
      })}
      <button disabled={paused || dirty} onClick={onRemove}>
        Remove mapping
      </button>
    </>
  );
}

function endpointName(nodes: Entity[], id: string) {
  const node = nodes.find((item) => item.id === id);
  return node ? label(node) : id;
}

function InspectorContent(props: InspectorProps) {
  const { entity, link, selectedLink, nodes, schema, editing, paused, authoring, onRemove } = props;
  if (link && selectedLink)
    return (
      <LinkInspector
        link={link}
        selectedLink={selectedLink}
        nodes={nodes}
        schema={schema}
        editing={editing}
        paused={paused}
        dirty={authoring.dirty}
        onDirty={authoring.onDirty}
        onRemove={onRemove}
      />
    );
  if (entity) return <EntityInspector key={entity.id} {...entityInspectorProps(props, entity)} />;
  return <p>Select an item or a recorded connection to inspect and edit it.</p>;
}
function entityInspectorProps(
  props: InspectorProps,
  entity: Entity,
): Parameters<typeof EntityInspector>[0] {
  return {
    entity,
    schema: props.schema,
    editing: props.editing,
    paused: props.paused,
    dirty: props.authoring.dirty,
    onDirty: props.authoring.onDirty,
    onMap: props.onMap,
    onNavigate: props.onNavigate,
    onOpenReceipt: props.onOpenReceipt,
    fieldsInSurface: props.fieldsInSurface,
    focusedRead: props.focusedRead,
    onCreate: props.onCreate,
    createDisabled: props.createDisabled,
    onExplore: props.canExplore === false ? undefined : props.onExplore,
    expanded: props.authoring.expanded,
    onExpanded: props.authoring.onExpanded,
  };
}
