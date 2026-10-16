import { useState } from "react";
import type { Entity, SchemaObject } from "../../../src/core/model.ts";
import type { Editing } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import { useProjection } from "../../../ui/use-projection.ts";
import { relationshipSlots } from "./relationship-slots.ts";
import { MappingDialog, NewItemDialog } from "./workspace-dialogs.tsx";

export type CreationContext = {
  source: Entity;
  schema: SchemaObject;
  siblings: Entity[];
  scopeLabel?: string;
};

/** Creation commits one identity; a separate guarded proposal connects it to its captured source. */
export function WorkspaceAuthoring({
  context,
  editing,
  paused,
  active,
  onScope,
  onClose,
}: {
  context: CreationContext;
  editing: Editing;
  paused: boolean;
  active: boolean;
  onScope(): void;
  onClose(): void;
}) {
  const [createdId, setCreatedId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [retry, setRetry] = useState(0);
  const created = useProjection(
    "/api/family",
    createdId ? { rootId: createdId, limit: 1 } : undefined,
    editing.epoch + retry,
    editing.report,
  );
  const target = created.data?.root;
  const slot = createdTargetSlot(context, target);
  return (
    <div className="workspace-author-stage" hidden={!active}>
      <button className="text-action" onClick={onScope}>
        Return to {context.scopeLabel ?? label(context.source)} scope
      </button>
      {!createdId ? (
        <NewItemDialog
          schema={context.schema}
          editing={editing}
          paused={paused}
          context={{ source: context.source, siblings: context.siblings }}
          onCreated={(id) => setCreatedId(id)}
          onClose={onClose}
        />
      ) : !connecting ? (
        <CreatedItemContinuation
          context={context}
          target={target}
          permitted={!!slot}
          loading={created.loading}
          failed={created.failed}
          connecting={connecting}
          connected={connected}
          paused={paused || !created.ready}
          onRetry={() => setRetry((value) => value + 1)}
          onConnect={() => setConnecting(true)}
          onClose={onClose}
        />
      ) : null}
      {connecting && target && slot && (
        <MappingDialog
          source={context.source}
          schema={context.schema}
          editing={editing}
          paused={paused || !created.ready}
          initialSlot={slot}
          initialTarget={target}
          stage
          onRecorded={() => setConnected(true)}
          onClose={() => setConnecting(false)}
        />
      )}
    </div>
  );
}
function createdTargetSlot(context: CreationContext, target?: Entity) {
  if (!target) return undefined;
  const compatible = relationshipSlots(context.schema, context.source.type).filter(
    (value) => value.targetType === target.type,
  );
  return compatible.find((value) => value.direction === "outgoing") ?? compatible[0];
}

function CreatedItemContinuation({
  context,
  target,
  permitted,
  loading,
  failed,
  connecting,
  connected,
  paused,
  onRetry,
  onConnect,
  onClose,
}: {
  context: CreationContext;
  target?: Entity;
  permitted: boolean;
  loading: boolean;
  failed: boolean;
  connecting: boolean;
  connected: boolean;
  paused: boolean;
  onRetry(): void;
  onConnect(): void;
  onClose(): void;
}) {
  return (
    <section className="workspace-create-result" aria-label="Created item continuation">
      <h2>{target ? label(target) : "Item"} created</h2>
      <p role="status">
        {connected
          ? "Connection recorded."
          : "Saved without connections. Review a connection to the captured source, or leave this item unlinked."}
      </p>
      <CreatedReadStatus loading={loading} failed={failed} onRetry={onRetry} />
      <CreatedConnectionNotice source={context.source} target={target} permitted={permitted} />
      {permitted && !connected && !connecting && (
        <button disabled={paused} onClick={onConnect}>
          Review connection to {label(context.source)}
        </button>
      )}
      {!connecting && (
        <button onClick={onClose}>
          {connected ? "Return to working scope" : "Leave item unlinked"}
        </button>
      )}
    </section>
  );
}

function CreatedReadStatus({
  loading,
  failed,
  onRetry,
}: {
  loading: boolean;
  failed: boolean;
  onRetry(): void;
}) {
  return (
    <>
      {loading && <p role="status">Reading the created item…</p>}
      {failed && (
        <>
          <p role="alert">
            The item was created, but its current state could not be read. Connections are paused.
          </p>
          <button onClick={onRetry}>Retry created item read</button>
        </>
      )}
    </>
  );
}
function CreatedConnectionNotice({
  source,
  target,
  permitted,
}: {
  source: Entity;
  target?: Entity;
  permitted: boolean;
}) {
  if (!target || permitted) return null;
  return (
    <p>
      No connection between {label(source)} and {target.type} is permitted by this captured model.
      The item remains unlinked.
    </p>
  );
}
