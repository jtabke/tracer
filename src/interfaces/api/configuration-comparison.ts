import { ensure, json } from "../../core/model.ts";
import { canonical } from "../../core/evidence.ts";
import { configurationDifferenceView } from "../../core/configuration-comparison.ts";
import type { Json } from "../../core/model.ts";
import type {
  ConfigurationComparison,
  ConfigurationPair,
} from "../../core/configuration-comparison.ts";
import { configuration } from "../api-models.ts";
import { array, boolean, literal, object, text, union } from "../decode.ts";

const jsonValue = (value: unknown): Json => {
  ensure(json(value), "validation", "Invalid selected JSON value");
  return value as Json;
};
const selectedValue = union(
  object({ present: literal(false) }),
  object({ present: literal(true), value: jsonValue }),
);
const change = object({ path: array(text), before: selectedValue, after: selectedValue });
const difference = object({
  id: text,
  state: literal("added", "removed", "modified", "unchanged", "unknown"),
  revisionChanged: boolean,
  schemaChanged: boolean,
  versionOnly: boolean,
  changes: array(change),
});
const decode = object({
  contract: literal("configuration_comparison"),
  version: literal(1),
  basis: object({
    beforeId: text,
    afterId: text,
    policy: literal("exact-selected-state-v1"),
    beforeDigest: text,
    afterDigest: text,
    digest: text,
  }),
  before: configuration,
  after: configuration,
  comparability: object({
    state: literal("exact", "qualified", "incompatible"),
    issues: array(object({ code: text, explanation: text })),
    engineeringMeaning: literal("not_assessed"),
  }),
  members: array(difference),
  contextChanges: array(change),
  relationships: array(difference),
  content: array(
    object({
      entityId: text,
      selectionChanged: boolean,
      content: literal("same", "different", "unknown"),
    }),
  ),
  completeness: object({
    population: literal("all_selected_states"),
    topology: literal("declared", "unknown"),
    content: literal("declared", "unknown"),
    projectDeletion: literal("not_inferred"),
    passage: literal("not_assessed"),
    externalBytes: literal("not_retained"),
  }),
});
export function configurationComparison(
  value: unknown,
  query: ConfigurationPair,
): ConfigurationComparison {
  const result = decode(value);
  ensure(
    result.basis.beforeId === query.beforeId &&
      result.basis.afterId === query.afterId &&
      result.before.id === query.beforeId &&
      result.after.id === query.afterId,
    "validation",
    "Configuration comparison belongs to another selected pair",
  );
  const projection = configurationDifferenceView(result.before, result.after);
  for (const key of Object.keys(projection) as (keyof typeof projection)[])
    ensure(
      canonical(result[key]) === canonical(projection[key]),
      "validation",
      "Configuration comparison is incomplete or inconsistent with its captured states",
    );
  ensure(
    [result.basis.digest, result.basis.beforeDigest, result.basis.afterDigest].every((value) =>
      /^sha256:[a-f0-9]{64}$/.test(value),
    ),
    "validation",
    "Invalid configuration comparison digest",
  );
  return result;
}
