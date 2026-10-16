import type { ProjectSnapshot } from "../src/core/project-snapshot.ts";
export function mapData(snapshot: ProjectSnapshot, title: string) {
  return {
    title,
    schema: snapshot.schema ?? { entityTypes: {}, relationshipTypes: {} },
    defaultScope: "requirements",
    scopes: {
      requirements: preferredTypes(snapshot),
      development: Object.keys(snapshot.schema?.entityTypes ?? {}),
      all: Object.keys(snapshot.schema?.entityTypes ?? {}),
    },
    entities: snapshot.entities.map((entity) => ({
      ...entity,
      key: entity.key ?? entity.id,
      fields: {
        ...entity.fields,
        title: String(entity.fields.title ?? entity.key ?? entity.id),
        statement: String(entity.fields.statement ?? ""),
      },
    })),
    relationships: snapshot.relationships,
  };
}

function preferredTypes(snapshot: ProjectSnapshot) {
  const types = Object.keys(snapshot.schema?.entityTypes ?? {});
  const primary = new Set([
    "user_need",
    "product_requirement",
    "subsystem_requirement",
    "verification_protocol",
    "validation_protocol",
    "product",
    "goal",
    "target",
    "function",
    "requirement",
    "design",
    "evaluation",
  ]);
  const selected = types.filter((type) => primary.has(type));
  return selected.length ? selected : types;
}
