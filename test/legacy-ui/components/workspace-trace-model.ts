import type { FamilyWorkspace } from "../../../src/application/views.ts";
import type { Entity } from "../../../src/core/model.ts";
import type { RelationshipSlot } from "./relationship-slots.ts";
import { relationshipSlots } from "./relationship-slots.ts";

import { traceColumnKey as slotKey } from "../../../src/core/presentation.ts";
export { traceColumnKey as slotKey } from "../../../src/core/presentation.ts";
export function familySlots(data: FamilyWorkspace) {
  const slots = data.members.flatMap((member) => relationshipSlots(data.schema, member.type));
  return [...new Map(slots.map((slot) => [slotKey(slot), slot])).values()];
}
export function columnLinks(data: FamilyWorkspace, member: Entity, slot: RelationshipSlot) {
  const incoming = slot.direction === "incoming";
  return [...new Map([...data.membership, ...data.links].map((link) => [link.id, link])).values()]
    .filter(
      (link) =>
        link.type === slot.relationshipType && (incoming ? link.target : link.source) === member.id,
    )
    .filter(
      (link) =>
        data.nodes.find((node) => node.id === (incoming ? link.source : link.target))?.type ===
        slot.targetType,
    );
}
export function loadedSharing(data: FamilyWorkspace, id: string, slot: RelationshipSlot) {
  const members = new Set(data.members.map((member) => member.id));
  const incoming = slot.direction === "incoming";
  return new Set(
    [...data.membership, ...data.links]
      .filter(
        (link) =>
          link.type === slot.relationshipType && (incoming ? link.source : link.target) === id,
      )
      .map((link) => (incoming ? link.target : link.source))
      .filter((id) => members.has(id)),
  ).size;
}
