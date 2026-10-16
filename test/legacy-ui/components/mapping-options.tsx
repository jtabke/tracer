import type { ReactNode } from "react";
import type { Editing } from "../../../ui/editing.ts";
import type { RelationshipSlot } from "./relationship-slots.ts";
import type { useMappingDraft } from "./use-mapping-draft.ts";
import { WorkspaceCandidates } from "./workspace-candidates.tsx";

export function MappingOptions({
  draft,
  editing,
  initialSlot,
  expanded = false,
}: {
  draft: ReturnType<typeof useMappingDraft>;
  editing: Editing;
  initialSlot?: RelationshipSlot;
  expanded?: boolean;
}) {
  const change = (action: () => void) => {
    if (
      (draft.target || Object.values(draft.values).some(Boolean)) &&
      !window.confirm("Discard this connection draft to change its meaning or direction?")
    )
      return;
    action();
    draft.setTarget(undefined);
    draft.setValues({});
  };
  return (
    <>
      {initialSlot && !expanded && (
        <p className="picker-scope">
          {draft.direction === "incoming" ? "←" : "→"} {draft.meaning.replaceAll("_", " ")}
        </p>
      )}
      <ConnectionOptions expanded={expanded} open={!initialSlot}>
        <label>
          Read direction
          <select
            aria-label="Mapping direction"
            value={draft.direction}
            onChange={(event) =>
              change(() => draft.setDirection(event.target.value as "incoming" | "outgoing"))
            }
          >
            <option value="outgoing" disabled={!draft.directions.includes("outgoing")}>
              From this item →
            </option>
            <option value="incoming" disabled={!draft.directions.includes("incoming")}>
              Into this item ←
            </option>
          </select>
        </label>
        <label>
          Relationship
          <select
            aria-label="Mapping relationship"
            value={draft.meaning}
            onChange={(event) => change(() => draft.setMeaning(event.target.value))}
          >
            {draft.meanings.map((name) => (
              <option key={name} value={name}>
                {name.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </ConnectionOptions>
      <WorkspaceCandidates
        key={`${draft.direction}:${draft.meaning}`}
        initialType={initialSlot?.targetType}
        contextual={!!initialSlot}
        types={draft.types}
        editing={editing}
        target={draft.target}
        onChoose={draft.setTarget}
        onReadReady={draft.setCandidateReady}
      />
    </>
  );
}
function ConnectionOptions({
  expanded,
  open,
  children,
}: {
  expanded: boolean;
  open: boolean;
  children: ReactNode;
}) {
  if (expanded) return <div className="connection-options-toolbar">{children}</div>;
  return (
    <details className="picker-options" open={open}>
      <summary>Change connection options</summary>
      {children}
    </details>
  );
}
