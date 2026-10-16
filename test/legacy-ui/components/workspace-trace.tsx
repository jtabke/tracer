import type { FamilyWorkspace } from "../../../src/application/views.ts";
import type { Entity } from "../../../src/core/model.ts";
import { label } from "../../../ui/fields.tsx";
import { readable } from "./graph-model.ts";
import { RelationshipColumnsHead } from "./relationship-column-heading.tsx";
import type { RelationshipSlot } from "./relationship-slots.ts";
import { relationshipSlots } from "./relationship-slots.ts";
import { ConnectionRecord } from "./workspace-connection.tsx";
import type { WorkspaceActions } from "./workspace-context.tsx";
import { Statements } from "./workspace-dialogs.tsx";
import { FamilyStatement } from "./workspace-statement.tsx";
import { columnLinks, familySlots, loadedSharing, slotKey } from "./workspace-trace-model.ts";

export function WorkspaceTrace({
  data,
  columns,
  onColumns,
  actions,
  selectedId,
  artifact,
  onArtifact,
}: {
  data: FamilyWorkspace;
  columns: RelationshipSlot[];
  onColumns(columns: RelationshipSlot[]): void;
  actions: WorkspaceActions;
  selectedId?: string;
  artifact?: string;
  onArtifact(entity: Entity): void;
}) {
  return (
    <>
      <WorkspaceColumnChoices data={data} columns={columns} onColumns={onColumns} />
      {!columns.length ? (
        <p>
          Choose relationships to read beside the sibling statements—for example, their designs and
          evaluations.
        </p>
      ) : (
        <div className="workspace-grid-scroll" role="region" aria-label="Family trace" tabIndex={0}>
          <table
            className="workspace-coverage workspace-trace"
            style={{ minWidth: `${320 + columns.length * 230}px` }}
          >
            <caption>Recorded connections for each item · sorted by key or title</caption>
            <RelationshipColumnsHead columns={columns} identityTitle="Sibling statement" />
            <tbody>
              {data.members
                .toSorted((a, b) => label(a).localeCompare(label(b), undefined, { numeric: true }))
                .map((member) => (
                  <tr
                    key={member.id}
                    className={traceRowClass(data, member, columns, selectedId, artifact)}
                  >
                    <td>
                      <FamilyStatement entity={member} actions={actions} selectedId={selectedId} />
                    </td>
                    {columns.map((slot) => (
                      <TraceCell
                        key={slotKey(slot)}
                        member={member}
                        slot={slot}
                        data={data}
                        actions={actions}
                        onArtifact={onArtifact}
                        selectedId={selectedId}
                      />
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function WorkspaceColumnChoices({
  data,
  columns,
  onColumns,
}: {
  data: FamilyWorkspace;
  columns: RelationshipSlot[];
  onColumns(columns: RelationshipSlot[]): void;
}) {
  const choices = familySlots(data);
  return (
    <fieldset className="workspace-trace-columns">
      <legend>Compare connections</legend>
      <div className="workspace-column-choices">
        {[...new Map([...columns, ...choices].map((slot) => [slotKey(slot), slot])).values()].map(
          (slot) => {
            const checked = columns.some((value) => slotKey(value) === slotKey(slot));
            const available = choices.some((value) => slotKey(value) === slotKey(slot));
            return (
              <label key={slotKey(slot)}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && columns.length >= 6}
                  onChange={() =>
                    onColumns(
                      checked
                        ? columns.filter((value) => slotKey(value) !== slotKey(slot))
                        : [...columns, slot],
                    )
                  }
                />
                {slot.direction === "incoming" ? "←" : "→"} {readable(slot.relationshipType)} ·{" "}
                {slot.targetType}
                {!available && " · unavailable in this family"}
              </label>
            );
          },
        )}
      </div>
      {columns.length >= 6 && (
        <small>Six-column limit reached. Remove a column to choose another.</small>
      )}
    </fieldset>
  );
}
function TraceCell({
  member,
  slot,
  data,
  actions,
  onArtifact,
  selectedId,
}: {
  member: Entity;
  slot: RelationshipSlot;
  data: FamilyWorkspace;
  actions: WorkspaceActions;
  onArtifact(entity: Entity): void;
  selectedId?: string;
}) {
  const allowed = relationshipSlots(data.schema, member.type).some(
    (value) => slotKey(value) === slotKey(slot),
  );
  const links = columnLinks(data, member, slot);
  const count = data.connections.find((value) => value.entityId === member.id)!;
  return (
    <td>
      {!allowed ? (
        <span className="muted">Not permitted for this item type</span>
      ) : (
        <>
          {links.map((link) => {
            const node = data.nodes.find(
              (value) => value.id === (slot.direction === "incoming" ? link.source : link.target),
            )!;
            const sharing = loadedSharing(data, node.id, slot);
            return (
              <article key={link.id} className="workspace-trace-target">
                <button
                  className="text-action"
                  disabled={actions.paused || actions.dirty}
                  aria-pressed={selectedId === node.id}
                  aria-label={`Inspect ${label(node)}`}
                  onClick={() => onArtifact(node)}
                >
                  <strong>{label(node)}</strong> · v{node.version}
                </button>
                <p>{String(node.fields.title ?? "")}</p>
                {sharing > 1 && <small>Shared by {sharing} loaded family items</small>}
                <details>
                  <summary>Statement and connection</summary>
                  <Statements entity={node} />
                  <ConnectionRecord link={link} data={data} actions={actions} />
                </details>
              </article>
            );
          })}
          {!links.length && (
            <p className="mapping-empty">
              {count.loaded < count.total
                ? "Not shown · more connections outside this read"
                : "No recorded link"}
            </p>
          )}
          <button
            className="text-action"
            disabled={actions.paused || actions.dirty}
            onClick={() => actions.onMap(member, slot)}
          >
            + Connect {slot.targetType}
          </button>
        </>
      )}
    </td>
  );
}

function traceRowClass(
  data: FamilyWorkspace,
  member: Entity,
  columns: RelationshipSlot[],
  selected?: string,
  artifact?: string,
) {
  if (selected === member.id) return "is-emphasized";
  if (
    artifact &&
    columns.some((slot) =>
      columnLinks(data, member, slot).some(
        (link) => link.source === artifact || link.target === artifact,
      ),
    )
  )
    return "shares-selection";
  return "";
}
