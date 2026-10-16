import type { FamilyWorkspace } from "../../../src/application/views.ts";
import type { Entity } from "../../../src/core/model.ts";
import { label } from "../../../ui/fields.tsx";
import { readable } from "./graph-model.ts";
import { RelationshipColumnsHead } from "./relationship-column-heading.tsx";
import type { RelationshipSlot } from "./relationship-slots.ts";
import { relationshipSlots } from "./relationship-slots.ts";
import { ConnectionRecord } from "./workspace-connection.tsx";
import type { WorkspaceActions } from "./workspace-context.tsx";
import { FamilyStatement } from "./workspace-statement.tsx";
import { columnLinks, familySlots, slotKey } from "./workspace-trace-model.ts";
import { WorkspaceColumnChoices } from "./workspace-trace.tsx";

function CoverageCell({
  member,
  slot,
  data,
  actions,
}: {
  member: Entity;
  slot: RelationshipSlot;
  data: FamilyWorkspace;
  actions: WorkspaceActions;
}) {
  const allowed = relationshipSlots(data.schema, member.type).some(
    (candidate) => slotKey(candidate) === slotKey(slot),
  );
  if (!allowed)
    return (
      <td>
        <span className="muted">Not permitted</span>
      </td>
    );
  const links = columnLinks(data, member, slot);
  const count = data.connections.find((item) => item.entityId === member.id)!;
  return (
    <td>
      {links.map((link) => (
        <ConnectionRecord key={link.id} link={link} data={data} actions={actions} />
      ))}
      {!links.length && (
        <p className="mapping-empty">
          {count.loaded < count.total
            ? "Not shown · additional links outside this view"
            : "No recorded link"}
        </p>
      )}
      <button
        className="text-action"
        aria-label={`Connect ${label(member)} · ${slot.direction} ${readable(slot.relationshipType)} · ${slot.targetType}`}
        disabled={actions.paused || actions.dirty}
        onClick={() => actions.onMap(member, slot)}
      >
        + Connect {slot.targetType}
      </button>
    </td>
  );
}

export function WorkspaceCoverage({
  data,
  actions,
  selectedId,
  artifact,
  columns: selectedColumns,
  onColumns,
}: {
  data: FamilyWorkspace;
  actions: WorkspaceActions;
  selectedId?: string;
  artifact?: string;
  columns: RelationshipSlot[];
  onColumns(columns: RelationshipSlot[]): void;
}) {
  const all = familySlots(data),
    columns = (selectedColumns.length ? selectedColumns : all).slice(0, 12),
    usingSelection = selectedColumns.length > 0;
  return (
    <>
      <WorkspaceColumnChoices data={data} columns={selectedColumns} onColumns={onColumns} />
      <div
        className="workspace-grid-scroll"
        role="region"
        aria-label="Coverage comparison"
        tabIndex={0}
      >
        <table className="workspace-coverage">
          <caption>
            {usingSelection
              ? "Selections are shared with Table and controlled above."
              : "Permitted connection slots · no comparison choices selected."}{" "}
            An empty slot means no recorded link in this family read, not missing implementation.
            {!usingSelection &&
              all.length > columns.length &&
              ` ${all.length - columns.length} slots omitted; select them above to compare.`}
          </caption>
          <RelationshipColumnsHead columns={columns} identityTitle="Item / obligation" />
          <tbody>
            {data.members.map((member) => {
              const emphasis = artifact
                ? data.links.some(
                    (link) =>
                      [link.source, link.target].includes(member.id) &&
                      [link.source, link.target].includes(artifact),
                  )
                : selectedId === member.id;
              return (
                <tr key={member.id} className={`workspace-lane ${emphasis ? "is-emphasized" : ""}`}>
                  <td>
                    <FamilyStatement entity={member} actions={actions} selectedId={selectedId} />
                  </td>
                  {columns.map((slot) => (
                    <CoverageCell
                      key={slotKey(slot)}
                      member={member}
                      slot={slot}
                      data={data}
                      actions={actions}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
