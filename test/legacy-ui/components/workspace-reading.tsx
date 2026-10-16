import type { FamilyWorkspace } from "../../../src/application/views.ts";
import { label } from "../../../ui/fields.tsx";
import { statementText } from "../../../ui/statement-text.ts";
import type { WorkspaceActions } from "./workspace-context.tsx";

export function WorkspaceReading({
  data,
  actions,
  selectedId,
}: {
  data: FamilyWorkspace;
  actions: WorkspaceActions;
  selectedId?: string;
}) {
  return (
    <div className="workspace-reading" aria-label="Continuous reading">
      {data.members.map((member) => (
        <article key={member.id} className={selectedId === member.id ? "is-emphasized" : undefined}>
          <header className="workspace-reading-heading">
            <h3>{label(member)}</h3>
            <span>
              v{member.version} · {member.type}
            </span>
          </header>
          <p>{statementText(member)}</p>
          <button
            className="text-action"
            disabled={actions.paused}
            onClick={() => actions.onChoose(member)}
          >
            Inspect and edit {label(member)}
          </button>
          <button
            className="text-action"
            disabled={actions.paused || actions.dirty}
            onClick={() => actions.onMap(member)}
          >
            Connect {label(member)}
          </button>
        </article>
      ))}
    </div>
  );
}
