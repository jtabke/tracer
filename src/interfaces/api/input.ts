import type { Operation } from "../../application/commands.ts";
import type { CoverageExpectation, CoverageExpectations } from "../../core/coverage.ts";
import type { Schema } from "../../core/model.ts";
import { ensure, knownProperties, record, validateSchema } from "../../core/model.ts";
import { validWorkingRecipe } from "../../core/working-context.ts";
import type { Decoder } from "../decode.ts";
import {
  array,
  boolean,
  fields,
  integer,
  literal,
  number,
  object,
  optional,
  text,
  union,
} from "../decode.ts";

export type OptionalFields<T> = keyof T extends never
  ? Record<string, never>
  : { [K in keyof T as undefined extends T[K] ? never : K]: T[K] } & {
      [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
    };

/** Request objects reject extras; historical response objects keep extensions. */
export function strictObject<S extends Record<string, Decoder<unknown>>>(
  shape: S,
): Decoder<OptionalFields<{ [K in keyof S]: ReturnType<S[K]> }>> {
  const decode = object(shape);
  return (value: unknown) => {
    ensure(record(value), "validation", "Request must be an object");
    knownProperties(value, Object.keys(shape));
    return decode(value) as OptionalFields<{ [K in keyof S]: ReturnType<S[K]> }>;
  };
}
export const inputSchema: Decoder<Schema> = (value) => {
  validateSchema(value);
  return value;
};
const population = strictObject({
  type: text,
  filter: optional(strictObject({ field: text, equals: union(text, union(number, boolean)) })),
});
const expectation: Decoder<CoverageExpectation> = strictObject({
  name: text,
  subject: population,
  relationshipType: text,
  direction: literal("incoming", "outgoing"),
  related: population,
  minimumDistinctTargets: number,
});
export const expectations: Decoder<CoverageExpectations> = (value) => {
  ensure(record(value), "validation", "Expectations must be an object");
  const result: CoverageExpectations = {};
  for (const [key, item] of Object.entries(value))
    Object.defineProperty(result, key, { value: expectation(item), enumerable: true });
  return result;
};
const entity = strictObject({ type: text, key: optional(text), fields });
const relationship = strictObject({ type: text, source: text, target: text, fields });
const endpointGuards = strictObject({ sourceVersion: number, targetVersion: number });
const operations: { [K in Operation["op"]]: Decoder<Extract<Operation, { op: K }>> } = {
  "entity.create": strictObject({
    op: literal("entity.create"),
    id: optional(text),
    input: entity,
  }),
  "entity.update": strictObject({
    op: literal("entity.update"),
    id: text,
    expectedVersion: number,
    input: strictObject({ fields, key: optional(text) }),
  }),
  "entity.remove": strictObject({
    op: literal("entity.remove"),
    id: text,
    expectedVersion: number,
    cascade: optional(boolean),
  }),
  "relationship.create": strictObject({
    op: literal("relationship.create"),
    id: optional(text),
    input: relationship,
    expectedEndpoints: optional(endpointGuards),
    rejectExisting: optional(boolean),
  }),
  "relationship.update": strictObject({
    op: literal("relationship.update"),
    id: text,
    expectedVersion: number,
    input: relationship,
  }),
  "relationship.remove": strictObject({
    op: literal("relationship.remove"),
    id: text,
    expectedVersion: number,
  }),
};
export const operation: Decoder<Operation> = (value) => {
  ensure(
    record(value) && typeof value.op === "string" && Object.hasOwn(operations, value.op),
    "validation",
    "Unknown operation",
  );
  return operations[value.op as Operation["op"]](value);
};
export const locator = union(
  strictObject({ system: literal("git"), repository: text, path: text, ref: text }),
  strictObject({ system: literal("file"), path: text }),
);
export const declaration = strictObject({
  entityId: text,
  expectedVersion: optional(number),
  revision: optional(number),
  observationId: optional(text),
  fields: optional(array(text)),
  path: optional(array(text)),
  expectedPathVersions: optional(array(number)),
});

export const workingContextInput: Decoder<
  import("../../core/working-context.ts").WorkingContextQuery
> = strictObject({
  focusId: text,
  recipe: (value) => {
    ensure(validWorkingRecipe(value), "validation", "Invalid working recipe");
    return value;
  },
  after: optional(text),
  limit: optional(integer()),
  trace: optional(
    strictObject({
      rowId: text,
      routeKey: text,
      stage: optional(integer()),
      after: optional(text),
      limit: optional(integer()),
    }),
  ),
  receipts: optional(strictObject({ after: optional(text), limit: optional(integer()) })),
});
