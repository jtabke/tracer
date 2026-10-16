import { typeNames } from "../../ui/map/model.ts";
import { medicalStageOrder } from "../../ui/map/presentation.ts";

export const presets = {
  requirements: [
    "user_need",
    "product_requirement",
    "subsystem_requirement",
    "verification_protocol",
    "validation_protocol",
  ],
  development: medicalStageOrder,
  all: Object.keys(typeNames),
};

// Synthetic test data is not part of the product renderer.
export function makeScaleFixture(fixture, copies = 100) {
  const entities = [],
    relationships = [];
  for (let i = 0; i < copies; i++) {
    const suffix = `:scale:${i}`;
    for (const entity of fixture.entities)
      entities.push({
        ...entity,
        id: entity.id + suffix,
        key: `${entity.key}.${String(i + 1).padStart(3, "0")}`,
      });
    for (const link of fixture.relationships)
      relationships.push({
        ...link,
        id: link.id + suffix,
        source: link.source + suffix,
        target: link.target + suffix,
      });
  }
  return { ...fixture, title: "Synthetic scale study", entities, relationships };
}
