import type { FamilyWorkspace } from "../../../src/application/views.ts";
import type { Entity, Relationship } from "../../../src/core/model.ts";

/** A retained inspector draft is not proof its selected object was read in the current scope. */
export function workspaceSelection(
  data: FamilyWorkspace | undefined,
  entity?: Entity,
  relationship?: Relationship,
) {
  const current = data?.nodes.find((node) => node.id === entity?.id) ?? entity;
  const currentLink = data?.links.find((link) => link.id === relationship?.id) ?? relationship;
  const loaded = relationship
    ? !!data?.links.some((link) => link.id === relationship.id)
    : !entity || !!data?.nodes.some((node) => node.id === entity.id);
  return { current, currentLink, loaded };
}

/** Relationship inspection has its own draft owner; do not highlight an entity as selected. */
export function workspaceSelectedEntityId(entity?: Entity, relationship?: Relationship) {
  return relationship ? undefined : entity?.id;
}

/** A retained draft may be visible while its current scope has not authorized editing. */
export function workspaceWriteState(
  busy: boolean,
  loading: boolean,
  hasContext: boolean,
  selectionLoaded: boolean,
) {
  const paused = busy || loading || !hasContext;
  return { paused, inspectorPaused: paused || !selectionLoaded };
}
