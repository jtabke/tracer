import type { Entity } from "../../../src/core/model.ts";
import { label } from "../../../ui/fields.tsx";
import { statementText } from "../../../ui/statement-text.ts";
import type { WorkspaceActions } from "./workspace-context.tsx";

/** The same complete statement and guarded item selection in both aligned family projections. */
export function FamilyStatement({
  entity,
  actions,
  selectedId,
}: {
  entity: Entity;
  actions: WorkspaceActions;
  selectedId?: string;
}) {
  const title = String(entity.fields.title ?? "");
  const statement = statementText(entity);
  return (
    <>
      <button
        className="text-action"
        aria-pressed={selectedId === entity.id}
        disabled={actions.paused}
        onClick={() => actions.onChoose(entity)}
      >
        {label(entity)} · v{entity.version}
      </button>
      {title && title !== label(entity) && (
        <strong className="workspace-statement-title">{title}</strong>
      )}
      {statement !== title && <p>{statement}</p>}
      <small>{entity.type}</small>
    </>
  );
}
