import { ensure } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type { InputDeclaration, RelationshipDeclaration } from "../core/evidence.ts";
export function declaredFacts(
  bases: { inputs: InputDeclaration[]; relationshipInputs: RelationshipDeclaration[] }[],
) {
  const inputs = [
    ...new Map(
      bases.flatMap((basis) => basis.inputs).map((input) => [canonical(input), input]),
    ).values(),
  ];
  const relationships = new Map<string, RelationshipDeclaration>();
  for (const link of bases.flatMap((basis) => basis.relationshipInputs)) {
    const prior = relationships.get(link.id);
    ensure(
      !prior || prior.revision === link.revision,
      "validation",
      "Receipt cannot declare two states of one relationship; split the supporting basis",
    );
    relationships.set(link.id, link);
  }
  ensure(
    inputs.length + relationships.size <= 80,
    "validation",
    "Application capture exceeds 80 direct facts; narrow the supporting basis",
  );
  return {
    inputs: inputs.map((input, index) => ({ ...input, role: "application fact " + index })),
    relationshipInputs: [...relationships.values()],
  };
}
