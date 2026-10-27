import type { Entity, Relationship } from "../core/model.ts";
export function decodeEntity(row: Record<string, unknown>): Entity {
  return {
    id: String(row.id),
    version: Number(row.version),
    type: String(row.type),
    ...(row.human_key === null ? {} : { key: String(row.human_key) }),
    fields: JSON.parse(String(row.attributes_json)),
    ...(row.resource_json ? { resource: JSON.parse(String(row.resource_json)) } : {}),
  };
}
export function decodeRelationship(row: Record<string, unknown>): Relationship {
  return {
    id: String(row.id),
    version: Number(row.version),
    type: String(row.type),
    source: String(row.source_entity_id),
    target: String(row.target_entity_id),
    fields: JSON.parse(String(row.attributes_json)),
    ...(row.reference_json ? { reference: JSON.parse(String(row.reference_json)) } : {}),
  };
}
