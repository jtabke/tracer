import type {
  CoverageCatalogue,
  CoverageEvaluation,
  CoverageExpectation,
} from "../core/coverage.ts";
import type { Baseline } from "../core/baseline.ts";
import type { Entity, Relationship } from "../core/model.ts";
import type { Decoder } from "./decode.ts";
import {
  array,
  boolean,
  fields,
  integer,
  literal,
  nullable,
  number,
  object,
  optional,
  page,
  text,
  union,
} from "./decode.ts";

const count = integer();
const positive = integer(1);
const population = object({
  type: text,
  filter: optional(object({ field: text, equals: union(text, union(number, boolean)) })),
});
const expectation: Decoder<CoverageExpectation> = object({
  name: text,
  subject: population,
  relationshipType: text,
  direction: literal("incoming", "outgoing"),
  related: population,
  minimumDistinctTargets: positive,
});
const expectations: Decoder<CoverageCatalogue["expectations"]> = (value) => {
  const definitions = fields(value);
  if (Object.keys(definitions).length > 100) throw new Error("Invalid coverage catalogue");
  for (const rule of Object.values(definitions)) expectation(rule);
  return definitions as CoverageCatalogue["expectations"];
};
export function coverageDecoders(
  entity: Decoder<Entity>,
  relationship: Decoder<Relationship>,
  baseline: Decoder<Baseline>,
) {
  const context = object({
    projectRevision: positive,
    schemaVersion: positive,
    baseline: optional(baseline),
  });
  const catalogue: Decoder<CoverageCatalogue> = object({ context, expectations });
  const evaluation: Decoder<CoverageEvaluation> = object({
    context,
    expectationId: text,
    expectation,
    rows: page(
      object({
        subject: entity,
        distinctTargets: nullable(count),
        matchingRelationships: nullable(count),
        samples: array(object({ related: entity, relationship })),
        samplesComplete: boolean,
        unresolvedRelationships: count,
        state: literal("covered", "missing", "unknown"),
        reason: text,
      }),
    ),
    summary: object({
      scope: literal("page"),
      evaluated: count,
      covered: count,
      missing: count,
      unknown: count,
    }),
  });
  return { catalogue, evaluation };
}
