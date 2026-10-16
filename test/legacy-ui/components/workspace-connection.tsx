import type { FamilyWorkspace } from "../../../src/application/views.ts";
import type { Relationship } from "../../../src/core/model.ts";
import { label } from "../../../ui/fields.tsx";
import { readable } from "./graph-model.ts";
import type { WorkspaceActions } from "./workspace-context.tsx";

export function ConnectionRecord({
  link,
  data,
  actions,
}: {
  link: Relationship;
  data: FamilyWorkspace;
  actions: WorkspaceActions;
}) {
  const source = data.nodes.find((node) => node.id === link.source)!;
  const target = data.nodes.find((node) => node.id === link.target)!;
  const captured = link.fields.source_version;
  return (
    <div className="workspace-connection">
      <button
        className="text-action"
        disabled={actions.paused}
        onClick={() => actions.onInspect(link)}
      >
        <strong>
          {label(source)} → {label(target)}
        </strong>{" "}
        · {readable(link.type)}
      </button>
      {captured !== undefined && Number(captured) !== source.version && (
        <span className="mapping-old">
          Linked to source v{String(captured)} · current v{source.version}
        </span>
      )}
      {!!Object.keys(link.fields).length ? (
        <details className="workspace-connection-context">
          <summary>Connection context</summary>
          <dl>
            {Object.entries(link.fields).map(([name, value]) => (
              <div key={name}>
                <dt>{readable(name)}</dt>
                <dd>
                  {String(value)}
                  {name === "source_version" && <> · current source v{source.version}</>}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : (
        <small>Extent not recorded</small>
      )}
    </div>
  );
}
