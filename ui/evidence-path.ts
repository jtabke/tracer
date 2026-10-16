import type { InputComparison } from "../src/core/evidence.ts";
import type { Entity } from "../src/core/model.ts";
import { label } from "./entity-label.ts";

/** Only immutable receipt endpoints have names here; intermediate IDs stay explicit. */
export function recordedDependencyPath(input: InputComparison, output: Entity): string {
  return input.dependencyPath
    .map((id) => {
      const entity =
        id === output.id ? output : id === input.entityId ? input.recorded.entity : undefined;
      return entity ? `${label(entity)} · recorded v${entity.version}` : id;
    })
    .join(" → ");
}
