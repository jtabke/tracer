import { exactConfigurationInputFields } from "./api/configuration-input.ts";
import { strictObject } from "./api/input.ts";
import { validateConfigurationCapture } from "../core/configuration-capture-validation.ts";
import { resourceInput, referenceInput } from "./api/input.ts";
import type { Baseline } from "../core/baseline.ts";
import type { Configuration, PinnedEntity } from "../core/configuration.ts";
import type {
  CapturedInput,
  ComparedState,
  Comparison,
  ExternalIdentity,
  Observation,
  Receipt,
  Review,
} from "../core/evidence.ts";
import type { Changeset, Entity, Relationship, Revision, SchemaObject } from "../core/model.ts";
import { validateSchema } from "../core/model.ts";
import type { SavedView } from "../core/presentation.ts";
import { viewDefinition } from "../core/presentation.ts";
import { coverageDecoders } from "./coverage-decoders.ts";
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
  text,
  union,
} from "./decode.ts";

export const schema: Decoder<SchemaObject> = (value) => {
  // Historical schemas may contain extension properties accepted by older writers.
  validateSchema(value, false);
  object({ id: literal("project"), version: number })(value);
  return value as SchemaObject;
};
const provenance = { id: text, at: text, actor: text, reason: optional(text) };
export const entity: Decoder<Entity> = object({
  id: text,
  version: number,
  type: text,
  key: optional(text),
  resource: optional(resourceInput),
  fields,
});
export const relationship: Decoder<Relationship> = object({
  id: text,
  version: number,
  type: text,
  source: text,
  target: text,
  reference: optional(referenceInput),
  fields,
});
const stored = union(schema, union(relationship, entity));
export const changeset: Decoder<Changeset> = object({
  ...provenance,
  projectRevision: number,
  schemaVersion: number,
});
export const revision: Decoder<Revision> = object({
  revisionId: text,
  changesetId: text,
  projectRevision: number,
  ordinal: number,
  schemaVersion: number,
  kind: literal("schema", "entity", "relationship"),
  id: text,
  version: number,
  snapshot: nullable(stored),
});
export const pin: Decoder<PinnedEntity> = object({
  entity,
  revisionId: text,
  changesetId: text,
  projectRevision: number,
  schema,
});
export const baseline: Decoder<Baseline> = object({
  ...provenance,
  name: text,
  projectRevision: number,
  changesetId: text,
  schemaVersion: number,
  capturedAtProjectRevision: number,
});
export const savedView: Decoder<SavedView> = object({
  id: text,
  name: text,
  version: number,
  definition: viewDefinition,
});
export const coverage = coverageDecoders(entity, relationship, baseline);
export const external: Decoder<ExternalIdentity> = object({
  id: text,
  at: text,
  actor: text,
  system: literal("git", "file"),
  externalId: text,
  ownership: literal("external"),
});
const locator = union(
  object({ system: literal("git"), repository: text, path: text, ref: text }),
  object({ system: literal("file"), path: text }),
);
export const observation: Decoder<Observation> = object({
  ...provenance,
  entityId: text,
  locator,
  availability: literal("available", "unknown"),
  commit: optional(text),
  hash: optional(text),
});
const configurationShape = object({
  ...provenance,
  name: text,
  subject: entity,
  members: array(pin),
  capture: optional(
    object({
      contract: literal("configuration_capture"),
      version: literal(1),
      intent: strictObject(exactConfigurationInputFields),
      context: object({ schema, projectRevision: integer(), evidenceRevision: integer() }),
      content: array(
        object({ entityId: text, observation: nullable(observation), reason: optional(text) }),
      ),
    }),
  ),
  relationships: optional(
    array(
      object({
        relationship,
        revisionId: text,
        changesetId: text,
        projectRevision: number,
        schema,
      }),
    ),
  ),
});
export const configuration: Decoder<Configuration> = (value) => {
  const decoded = configurationShape(value);
  validateConfigurationCapture(decoded);
  return decoded;
};
const capturedInput: Decoder<CapturedInput> = object({
  contentRetention: optional(literal("native-history", "external-content-not-retained")),
  entityId: text,
  facet: optional(literal("native", "content")),
  role: optional(text),
  expectedVersion: optional(number),
  revision: optional(number),
  observationId: optional(text),
  fields: optional(array(text)),
  path: optional(array(text)),
  entity,
  observation: optional(observation),
  links: array(relationship),
  pin: optional(pin),
});
const capturedRelationship = object({
  relationship,
  schema,
  source: entity,
  target: entity,
  revisionId: text,
  changesetId: text,
  projectRevision: number,
  role: optional(text),
});
const relationshipComparison = object({
  id: text,
  recorded: capturedRelationship,
  current: nullable(relationship),
  hasChanged: boolean,
  hasUnknown: boolean,
  state: literal("current", "changed", "unknown"),
  reasons: array(text),
});
export const receipt: Decoder<Receipt> = object({
  ...provenance,
  output: entity,
  schema,
  outcome: text,
  inputs: array(capturedInput),
  relationshipInputs: optional(array(capturedRelationship)),
  supersedes: optional(text),
  configuration: optional(object({ id: text, name: text, subject: entity })),
});
const compared = {
  relationshipInputs: optional(array(relationshipComparison)),
  receiptId: text,
  state: literal("current", "changed", "unknown"),
  hasChanged: boolean,
  hasUnknown: boolean,
  inputs: array(
    object({
      entityId: text,
      dependencyPath: array(text),
      state: literal("current", "changed", "unknown"),
      hasChanged: boolean,
      hasUnknown: boolean,
      reasons: array(text),
      recorded: capturedInput,
      current: object({
        entity: nullable(entity),
        observation: nullable(observation),
        links: array(nullable(relationship)),
      }),
    }),
  ),
};
export const comparedState: Decoder<ComparedState> = object(compared);
export const review: Decoder<Review> = object({
  ...provenance,
  receiptId: text,
  decision: literal("accepted", "acknowledged", "needs_reevaluation"),
  rationale: text,
  comparison: comparedState,
  token: text,
});
const reviewState = object({
  state: literal("unreviewed", "accepted", "acknowledged", "needs_reevaluation"),
  decision: optional(review),
  previous: optional(review),
});
export const workingComparison = object({ ...compared, token: text, review: reviewState });
export const comparison: Decoder<Comparison> = object({
  ...compared,
  token: text,
  review: reviewState,
  supersededBy: array(text),
});
export const evidence = {
  external,
  observation,
  receipt,
  review,
};
const direction = literal("incoming", "outgoing");
const column = object({ relationshipType: text, targetType: text, direction });
const chainQuery = object({
  type: text,
  steps: array(object({ type: text, relationshipType: text, direction: optional(direction) })),
  search: optional(text),
  after: optional(text),
  limit: optional(number),
});
export const guide = object({
  title: text,
  description: text,
  tasks: array(
    object({
      title: text,
      root: text,
      rootId: text,
      relationship: text,
      direction,
      explanation: text,
      presentation: optional(object({ layout: literal("trace"), columns: array(column) })),
    }),
  ),
  chains: array(object({ title: text, query: chainQuery })),
});
export function delta<T>(value: Decoder<T>) {
  return object({
    id: text,
    state: literal("added", "removed", "modified", "unchanged"),
    before: nullable(value),
    after: nullable(value),
  });
}
export const workRecord = object({
  id: text,
  type: text,
  key: optional(text),
  version: integer(1),
  title: text,
});
export const workEvidence = object({
  receiptId: text,
  output: workRecord,
  outcome: text,
  changedInputs: integer(),
  unknownInputs: integer(),
  reviewState: literal("unreviewed", "accepted", "acknowledged", "needs_reevaluation"),
  reviewReason: text,
});
export function workQueue<T>(item: Decoder<T>) {
  return object({
    available: boolean,
    explanation: text,
    evaluated: integer(),
    items: array(item),
  });
}

export function reachability() {
  return object({
    paths: array(object({ entityId: text, depth: integer(), relationshipIds: array(text) })),
    expandedIds: array(text),
    frontierIds: array(text),
  });
}

export const changesetResult = object({
  changeset,
  results: array(
    union(
      relationship,
      union(entity, object({ id: text, version: number, deleted: literal(true) })),
    ),
  ),
});
