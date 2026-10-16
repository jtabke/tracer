import { useState } from "react";
import type { Entity, SchemaObject } from "../../../src/core/model.ts";
import type { Editing } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import type { CreationContext } from "./workspace-authoring.tsx";
import { WorkspaceAuthoring } from "./workspace-authoring.tsx";

/** A retained creation owner; returning to a scope only hides the stage. */
export function useWorkspaceCreation(
  source: Entity | undefined,
  schema: SchemaObject,
  siblings: Entity[],
  nodes: Entity[],
  editing: Editing,
  paused: boolean,
  dirty: boolean,
  origin?: Entity,
  authoritative?: Entity,
) {
  const [context, setContext] = useState<CreationContext>();
  const [active, setActive] = useState(false);
  const disabled = dirty || paused || !!context;
  const open = () => {
    if (!source || disabled) return;
    setContext({ source, schema, siblings, scopeLabel: label(origin ?? source) });
    setActive(true);
  };
  const close = () => {
    setContext(undefined);
    setActive(false);
  };
  const stage = context && (
    <>
      {!active && (
        <div className="workspace-resume">
          <span>Creation context retained · {label(context.source)}</span>
          <button onClick={() => setActive(true)}>Return to item creation</button>
        </div>
      )}
      <WorkspaceAuthoring
        context={context}
        editing={editing}
        paused={paused || !creationSourceReady(context.source, nodes, authoritative)}
        active={active}
        onScope={() => setActive(false)}
        onClose={close}
      />
    </>
  );
  return { active, disabled, open, stage };
}

function creationSourceReady(source: Entity, nodes: Entity[], authoritative?: Entity) {
  return nodes.some((node) => node.id === source.id) || authoritative?.id === source.id;
}
